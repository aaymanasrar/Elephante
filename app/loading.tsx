'use client'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="relative w-24 h-24"> {/* Slightly smaller for a tighter feel */}
        <img 
          src="/logo.png.png" 
          className="absolute inset-0 w-full h-full object-contain invert opacity-20" 
        />
        <img 
          src="/logo.png.png" 
          className="absolute inset-0 w-full h-full object-contain invert animate-fill" 
        />
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