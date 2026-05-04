'use client'

import Logo from '@/components/Logo'

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="relative w-24 h-24" aria-label="Loading">
        <div className="absolute inset-0">
          <Logo size={96} opacity={0.15} decorative className="w-full h-full" />
        </div>
        <div
          className="absolute inset-0"
          style={{ animation: 'fillUp 1.6s cubic-bezier(0.4,0,0.2,1) infinite' }}
        >
          <Logo size={96} decorative className="w-full h-full" />
        </div>
      </div>

      <style jsx>{`
        @keyframes fillUp {
          0% { clip-path: inset(100% 0 0 0); opacity: 0; }
          10% { clip-path: inset(100% 0 0 0); opacity: 0.6; }
          60% { clip-path: inset(0% 0 0 0); opacity: 1; }
          80% { clip-path: inset(0% 0 0 0); opacity: 1; }
          100% { clip-path: inset(0% 0 0 0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
