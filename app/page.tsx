'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import Noise from '@/components/Noise'
import Particles from '@/components/Particles'

export default function Home() {
  const [stage, setStage] = useState(0)
  const [logoFaded, setLogoFaded] = useState(false)
  const [enterHover, setEnterHover] = useState(false)
  const [createHover, setCreateHover] = useState(false)

  useEffect(() => {
    const logoTimer = setTimeout(() => setLogoFaded(true), 900)
    const titleTimer = setTimeout(() => setStage(1), 1400)
    const actionTimer = setTimeout(() => setStage(2), 2200)

    return () => {
      clearTimeout(logoTimer)
      clearTimeout(titleTimer)
      clearTimeout(actionTimer)
    }
  }, [])

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden selection:bg-zinc-800">
      <Noise patternAlpha={25} patternRefreshInterval={3} />
      <Particles
        particleCount={120}
        particleSpread={10}
        speed={0.08}
        particleColors={['#ffffff', '#ffffff', '#aaaaaa']}
        alphaParticles
        particleBaseSize={80}
        sizeRandomness={0.8}
        cameraDistance={20}
        moveParticlesOnHover
        particleHoverFactor={0.3}
      />

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
        <Logo
          size={180}
          decorative
          opacity={logoFaded ? 0.05 : 0.75}
          className="transition-opacity duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
          priority
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
        <div
          className="absolute"
          style={{
            width: '520px',
            height: '520px',
            background: `
              radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.06) 0%, transparent 100%),
              radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.06) 0%, transparent 100%)
            `,
            transform: 'rotate(45deg)',
            animation: 'starPulse 5s ease-in-out infinite',
          }}
        />
        <div
          className="absolute"
          style={{
            width: '520px',
            height: '520px',
            background: `
              radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.04) 0%, transparent 100%),
              radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.04) 0%, transparent 100%)
            `,
            transform: 'rotate(22.5deg)',
            animation: 'starPulse 5s ease-in-out infinite 0.5s',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: '280px',
            height: '280px',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%)',
            animation: 'starPulse 5s ease-in-out infinite',
            filter: 'blur(8px)',
          }}
        />
      </div>

      <div className="relative z-20 w-full max-w-2xl flex flex-col items-center justify-center px-6">
        <div
          className={`text-center flex flex-col items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
          }`}
        >
          <h2 className="text-[10px] sm:text-xs font-bold tracking-[0.5em] text-zinc-600 uppercase mb-4">
            Welcome to
          </h2>
          <h1 className="text-4xl sm:text-6xl font-thin tracking-[0.4em] pl-[0.4em] uppercase mb-8 sm:mb-12 text-zinc-200">
            Elephante
          </h1>
        </div>

        <div
          className={`z-10 text-center w-full transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center ${
            stage === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
          }`}
        >
          <p className="text-zinc-500 text-xs sm:text-sm font-light tracking-widest mx-auto mb-12 leading-loose max-w-md">
            Your intelligent wardrobe archive. Curate, search, and elevate your personal style.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full max-w-sm">
            <Link
              href="/login"
              onMouseEnter={() => setEnterHover(true)}
              onMouseLeave={() => setEnterHover(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '14px 36px',
                borderRadius: '100px',
                background: enterHover ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)',
                color: '#000',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: enterHover
                  ? '0 0 40px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.4)'
                  : '0 4px 20px rgba(0,0,0,0.3)',
                transform: enterHover ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              Enter
            </Link>

            <Link
              href="/register"
              onMouseEnter={() => setCreateHover(true)}
              onMouseLeave={() => setCreateHover(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '14px 36px',
                borderRadius: '100px',
                background: 'transparent',
                color: createHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                border: createHover ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: createHover ? '0 0 24px rgba(255,255,255,0.08), inset 0 0 20px rgba(255,255,255,0.03)' : 'none',
                transform: createHover ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-[1500ms] delay-300 ${
          stage === 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-600 to-transparent opacity-40" />
      </div>

      <style jsx>{`
        @keyframes starPulse {
          0%,
          100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }
      `}</style>
    </main>
  )
}
