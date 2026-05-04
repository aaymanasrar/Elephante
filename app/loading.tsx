'use client'

import Logo from '@/components/Logo'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="relative w-24 h-24" aria-label="Loading">
        <div className="absolute inset-0">
          <Logo size={96} opacity={0.2} decorative className="w-full h-full" />
        </div>
        <div className="absolute inset-0 animate-fill overflow-hidden">
          <Logo size={96} decorative className="w-full h-full" />
        </div>
      </div>

      <style jsx>{`
        .animate-fill {
          animation: fillUp 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes fillUp {
          0% { clip-path: inset(100% 0 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
      `}</style>
    </div>
  )
}
