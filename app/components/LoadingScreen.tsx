'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    let animId: number, W = 0, H = 0
    interface P { x:number;y:number;vx:number;vy:number;r:number;alpha:number }
    let ps: P[] = []
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    const init = () => { ps = Array.from({length:55},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.4+.4,alpha:Math.random()*.45+.1})) }
    const draw = () => {
      ctx.clearRect(0,0,W,H)
      const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.55)
      g.addColorStop(0,'rgba(255,255,255,0.025)');g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
      for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const dx=ps[i].x-ps[j].x,dy=ps[i].y-ps[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<140){ctx.beginPath();ctx.strokeStyle=`rgba(255,255,255,${.055*(1-d/140)})`;ctx.lineWidth=.5;ctx.moveTo(ps[i].x,ps[i].y);ctx.lineTo(ps[j].x,ps[j].y);ctx.stroke()}}
      for(const p of ps){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${p.alpha})`;ctx.fill();p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0}
      animId=requestAnimationFrame(draw)
    }
    resize();init();draw()
    const r=()=>{resize();init()}
    window.addEventListener('resize',r)
    return ()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',r)}
  },[])
  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none"/>
}

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center overflow-hidden">
      <ParticleCanvas />

      <div className="relative z-10 flex flex-col items-center">

        {/* ── Star rays container ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">

          {/* Deep background glow — large, very soft, behind everything */}
          <div
            className="absolute rounded-full"
            style={{
              width: '600px',
              height: '600px',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 35%, transparent 70%)',
              filter: 'blur(60px)',
              animation: 'breathe 3s ease-in-out infinite',
            }}
          />

          {/* Outer ambient glow blob */}
          <div
            className="absolute rounded-full"
            style={{
              width: '280px',
              height: '280px',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 70%)',
              filter: 'blur(30px)',
              animation: 'breathe 3s ease-in-out infinite',
            }}
          />

          {/* SVG star rays — 8 lines radiating out */}
          <svg
            width="320"
            height="320"
            viewBox="0 0 320 320"
            className="absolute"
            style={{ animation: 'slowspin 18s linear infinite' }}
          >
            {/* 8 rays at 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315° */}
            {[0, 45, 90, 135].map((angle, i) => (
              <g key={i} transform={`rotate(${angle} 160 160)`}>
                {/* main ray */}
                <line
                  x1="160" y1="160"
                  x2="160" y2="20"
                  stroke="white"
                  strokeWidth={i % 2 === 0 ? '0.8' : '0.4'}
                  strokeLinecap="round"
                  style={{
                    opacity: i % 2 === 0 ? 0.18 : 0.09,
                    filter: 'blur(0.5px)',
                  }}
                />
                {/* opposite ray */}
                <line
                  x1="160" y1="160"
                  x2="160" y2="300"
                  stroke="white"
                  strokeWidth={i % 2 === 0 ? '0.8' : '0.4'}
                  strokeLinecap="round"
                  style={{
                    opacity: i % 2 === 0 ? 0.18 : 0.09,
                    filter: 'blur(0.5px)',
                  }}
                />
              </g>
            ))}

            {/* inner bright cross — sharper, shorter */}
            {[0, 90].map((angle, i) => (
              <g key={`cross-${i}`} transform={`rotate(${angle} 160 160)`}>
                <line x1="160" y1="160" x2="160" y2="90"
                  stroke="white" strokeWidth="1.2" strokeLinecap="round"
                  style={{ opacity: 0.35, filter: 'blur(0.3px)' }}
                />
                <line x1="160" y1="160" x2="160" y2="230"
                  stroke="white" strokeWidth="1.2" strokeLinecap="round"
                  style={{ opacity: 0.35, filter: 'blur(0.3px)' }}
                />
              </g>
            ))}
          </svg>

          {/* Inner close glow — tight halo around logo */}
          <div
            className="absolute rounded-full"
            style={{
              width: '140px',
              height: '140px',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)',
              filter: 'blur(12px)',
              animation: 'breathe 3s ease-in-out infinite',
            }}
          />
        </div>

        {/* ── Logo stack: blurred ghost + sharp top ── */}
        <div className="relative w-[100px] h-[100px]">

          {/* Layer 1 — heavy blur glow (widest spread) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/logo.png.png"
              alt=""
              width={100}
              height={100}
              className="object-contain invert"
              style={{ filter: 'invert(1) blur(14px)', opacity: 0.35 }}
              priority
            />
          </div>

          {/* Layer 2 — medium blur (mid glow) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/logo.png.png"
              alt=""
              width={100}
              height={100}
              className="object-contain"
              style={{ filter: 'invert(1) blur(5px)', opacity: 0.5 }}
              priority
            />
          </div>

          {/* Layer 3 — sharp on top, readable */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src="/logo.png.png"
              alt="Elephante"
              width={100}
              height={100}
              className="object-contain"
              style={{
                filter: 'invert(1)',
                opacity: 0.9,
                animation: 'subtlePulse 3s ease-in-out infinite',
              }}
              priority
            />
          </div>
        </div>

        {/* ── Loading text ── */}
        <p
          className="mt-10 text-[10px] text-zinc-600 uppercase tracking-[0.5em]"
          style={{ animation: 'subtlePulse 3s ease-in-out infinite' }}
        >
          Loading
        </p>
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1);    opacity: 0.7; }
          50%       { transform: scale(1.12); opacity: 1;   }
        }
        @keyframes slowspin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  )
}