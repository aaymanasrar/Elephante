// @ts-nocheck
'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle, Transform, Vec3, Camera } from 'ogl'

function parseHexColor(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  ]
}

function fract(x: number) { return x - Math.floor(x) }

function hash31(p: number): [number, number, number] {
  const r: [number, number, number] = [fract(p * 0.1031), fract(p * 0.103), fract(p * 0.0973)]
  const dot = r[0] * (r[1] + 33.33) + r[1] * (r[2] + 33.33) + r[2] * (r[0] + 33.33)
  return [fract(r[0] + dot), fract(r[1] + dot), fract(r[2] + dot)]
}

function hash33(v: [number, number, number]): [number, number, number] {
  let p: [number, number, number] = [fract(v[0] * 0.1031), fract(v[1] * 0.103), fract(v[2] * 0.0973)]
  const dot = p[0] * (p[1] + 33.33) + p[1] * (p[0] + 33.33) + p[2] * (p[1] + 33.33)
  p = [fract(p[0] + dot), fract(p[1] + dot), fract(p[2] + dot)]
  return [fract((p[0] + p[0]) * p[2]), fract((p[0] + p[1]) * p[0]), fract((p[1] + p[0]) * p[1])]
}

const vertex = `#version 300 es
precision highp float;
layout(location = 0) in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragment = `#version 300 es
precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec3 iMouse;
uniform vec3 iColor;
uniform vec3 iCursorColor;
uniform float iAnimationSize;
uniform int iBallCount;
uniform float iCursorBallSize;
uniform vec3 iMetaBalls[50];
uniform float iClumpFactor;
uniform bool enableTransparency;
out vec4 outColor;

float getMetaBallValue(vec2 c, float r, vec2 p) {
  vec2 d = p - c;
  float dist2 = dot(d, d);
  return (r * r) / dist2;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float scale = iAnimationSize / iResolution.y;
  vec2 coord = (fc - iResolution.xy * 0.5) * scale;
  vec2 mouseW = (iMouse.xy - iResolution.xy * 0.5) * scale;
  float m1 = 0.0;
  for (int i = 0; i < 50; i++) {
    if (i >= iBallCount) break;
    m1 += getMetaBallValue(iMetaBalls[i].xy, iMetaBalls[i].z, coord);
  }
  float m2 = getMetaBallValue(mouseW, iCursorBallSize, coord);
  float total = m1 + m2;
  float f = smoothstep(-1.0, 1.0, (total - 1.3) / min(1.0, fwidth(total)));
  vec3 cFinal = vec3(0.0);
  if (total > 0.0) {
    float alpha1 = m1 / total;
    float alpha2 = m2 / total;
    cFinal = iColor * alpha1 + iCursorColor * alpha2;
  }
  outColor = vec4(cFinal * f, enableTransparency ? f : 1.0);
}`

interface MetaBallsProps {
  className?: string
  color?: string
  cursorBallColor?: string
  speed?: number
  enableMouseInteraction?: boolean
  hoverSmoothness?: number
  animationSize?: number
  ballCount?: number
  clumpFactor?: number
  cursorBallSize?: number
  enableTransparency?: boolean
}

export default function MetaBalls({
  className = '',
  color = '#ffffff',
  cursorBallColor = '#ffffff',
  speed = 0.3,
  enableMouseInteraction = true,
  hoverSmoothness = 0.05,
  animationSize = 30,
  ballCount = 15,
  clumpFactor = 1,
  cursorBallSize = 3,
  enableTransparency = true,
}: MetaBallsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const dpr = 1
    const renderer = new Renderer({ dpr, alpha: true, premultipliedAlpha: false })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, enableTransparency ? 0 : 1)
    gl.canvas.style.position = 'absolute'
    gl.canvas.style.inset = '0'
    container.appendChild(gl.canvas)

    const camera = new Camera(gl, { left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 10 })
    camera.position.z = 1

    const geometry = new Triangle(gl)
    const [r1, g1, b1] = parseHexColor(color)
    const [r2, g2, b2] = parseHexColor(cursorBallColor)

    const metaBallsUniform: Vec3[] = []
    for (let i = 0; i < 50; i++) metaBallsUniform.push(new Vec3(0, 0, 0))

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Vec3(0, 0, 0) },
        iMouse: { value: new Vec3(0, 0, 0) },
        iColor: { value: new Vec3(r1, g1, b1) },
        iCursorColor: { value: new Vec3(r2, g2, b2) },
        iAnimationSize: { value: animationSize },
        iBallCount: { value: ballCount },
        iCursorBallSize: { value: cursorBallSize },
        iMetaBalls: { value: metaBallsUniform },
        iClumpFactor: { value: clumpFactor },
        enableTransparency: { value: enableTransparency },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    const scene = new Transform()
    mesh.setParent(scene)

    const effectiveBallCount = Math.min(ballCount, 50)
    const ballParams: { st: number; dtFactor: number; baseScale: number; toggle: number; radius: number }[] = []
    for (let i = 0; i < effectiveBallCount; i++) {
      const h1 = hash31(i + 1)
      ballParams.push({
        st: h1[0] * 2 * Math.PI,
        dtFactor: 0.1 * Math.PI + h1[1] * (0.4 * Math.PI - 0.1 * Math.PI),
        baseScale: 5.0 + h1[1] * 5.0,
        toggle: Math.floor(hash33(h1)[0] * 2),
        radius: 0.5 + hash33(h1)[2] * 1.5,
      })
    }

    const mouseBallPos = { x: 0, y: 0 }
    let pointerInside = false, pointerX = 0, pointerY = 0

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight
      renderer.setSize(w * dpr, h * dpr)
      gl.canvas.style.width = w + 'px'
      gl.canvas.style.height = h + 'px'
      program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, 0)
    }
    window.addEventListener('resize', resize)
    resize()

    const onPointerMove = (e: PointerEvent) => {
      if (!enableMouseInteraction) return
      const rect = container.getBoundingClientRect()
      pointerX = ((e.clientX - rect.left) / rect.width) * gl.canvas.width
      pointerY = (1 - (e.clientY - rect.top) / rect.height) * gl.canvas.height
    }
    const onPointerEnter = () => { if (enableMouseInteraction) pointerInside = true }
    const onPointerLeave = () => { if (enableMouseInteraction) pointerInside = false }
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerenter', onPointerEnter)
    container.addEventListener('pointerleave', onPointerLeave)

    const startTime = performance.now()
    let animId: number

    const update = (t: number) => {
      animId = requestAnimationFrame(update)
      const elapsed = (t - startTime) * 0.001
      program.uniforms.iTime.value = elapsed

      for (let i = 0; i < effectiveBallCount; i++) {
        const p = ballParams[i]
        const dt = elapsed * speed * p.dtFactor
        const th = p.st + dt
        metaBallsUniform[i].set(
          Math.cos(th) * p.baseScale * clumpFactor,
          Math.sin(th + dt * p.toggle) * p.baseScale * clumpFactor,
          p.radius
        )
      }

      let targetX, targetY
      if (pointerInside) {
        targetX = pointerX; targetY = pointerY
      } else {
        targetX = gl.canvas.width * 0.5 + Math.cos(elapsed * speed) * gl.canvas.width * 0.15
        targetY = gl.canvas.height * 0.5 + Math.sin(elapsed * speed) * gl.canvas.height * 0.15
      }
      mouseBallPos.x += (targetX - mouseBallPos.x) * hoverSmoothness
      mouseBallPos.y += (targetY - mouseBallPos.y) * hoverSmoothness
      program.uniforms.iMouse.value.set(mouseBallPos.x, mouseBallPos.y, 0)

      renderer.render({ scene, camera })
    }
    animId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerenter', onPointerEnter)
      container.removeEventListener('pointerleave', onPointerLeave)
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [color, cursorBallColor, speed, enableMouseInteraction, hoverSmoothness, animationSize, ballCount, clumpFactor, cursorBallSize, enableTransparency])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
