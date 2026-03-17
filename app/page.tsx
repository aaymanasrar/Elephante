'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

// ─── Particle Canvas ──────────────────────────────────────────────────────────
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
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0"/>
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 200)
    const t2 = setTimeout(() => setStage(2), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden selection:bg-zinc-800">

      {/* ── Particle background ── */}
      <ParticleCanvas />

      {/* ── Logo star glow — centred, sits behind content ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">

        {/* Outer star rays — pure CSS radial burst */}
        <div
          className="absolute"
          style={{
            width: '520px',
            height: '520px',
            background: `
              radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.07) 0%, transparent 100%),
              radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.07) 0%, transparent 100%),
              radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.04) 0%, transparent 100%),
              radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.04) 0%, transparent 100%)
            `,
            transform: 'rotate(45deg)',
            animation: 'starPulse 5s ease-in-out infinite',
          }}
        />

        {/* Diagonal rays */}
        <div
          className="absolute"
          style={{
            width: '520px',
            height: '520px',
            background: `
              radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.05) 0%, transparent 100%),
              radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.05) 0%, transparent 100%)
            `,
            transform: 'rotate(22.5deg)',
            animation: 'starPulse 5s ease-in-out infinite 0.5s',
          }}
        />

        {/* Core glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: '320px',
            height: '320px',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)',
            animation: 'starPulse 5s ease-in-out infinite',
            filter: 'blur(2px)',
          }}
        />

        {/* Logo — very faint, centred in the glow */}
        <img
          src="/logo.png.png"
          alt=""
          aria-hidden="true"
          style={{
            width: '180px',
            height: '180px',
            objectFit: 'contain',
            filter: 'invert(1)',
            opacity: 0.04,
            animation: 'starPulse 5s ease-in-out infinite',
          }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-20 w-full max-w-2xl flex flex-col items-center justify-center px-6">

        {/* Title */}
        <div className={`text-center flex flex-col items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)]
          ${stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>

          <h2 className="text-[10px] sm:text-xs font-bold tracking-[0.5em] text-zinc-600 uppercase mb-4">
            Welcome to
          </h2>

          <h1 className="text-4xl sm:text-6xl font-thin tracking-[0.4em] pl-[0.4em] uppercase mb-8 sm:mb-12 text-zinc-200">
            Elephante
          </h1>
        </div>

        {/* Subtitle + buttons */}
        <div className={`z-10 text-center w-full transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center
          ${stage === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>

          <p className="text-zinc-500 text-xs sm:text-sm font-light tracking-widest mx-auto mb-10 leading-loose max-w-md">
            Your intelligent wardrobe archive. Curate, search, and elevate your personal style.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full">
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white text-black text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all duration-500 min-h-[52px] flex items-center justify-center"
            >
              Enter
            </Link>

            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-transparent border border-zinc-800 text-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] hover:border-white/40 hover:text-white transition-all duration-500 min-h-[52px] flex items-center justify-center"
            >
              Create Account
            </Link>
          </div>
        </div>

      </div>

      {/* Decorative bottom line */}
      <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-[1500ms] delay-300
        ${stage === 2 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-600 to-transparent opacity-40"/>
      </div>

      <style jsx>{`
        @keyframes starPulse {
          0%, 100% { opacity: 0.7; transform: scale(1) rotate(var(--r, 0deg)); }
          50%       { opacity: 1;   transform: scale(1.06) rotate(var(--r, 0deg)); }
        }
      `}</style>
    </div>
  )
}