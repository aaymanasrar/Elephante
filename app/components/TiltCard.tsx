'use client'

import { useState, useRef } from 'react'

export default function TiltCard({ imageUrl }: { imageUrl: string }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Max rotation is 15 degrees
    const rotateX = ((y - centerY) / centerY) * -15
    const rotateY = ((x - centerX) / centerX) * 15

    setRotation({ x: rotateX, y: rotateY })
  }

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 })
  }

  return (
    <div className="perspective-[1000px] w-full">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-900 transition-transform duration-100 ease-linear will-change-transform"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <img 
          src={imageUrl} 
          alt="Outfit" 
          className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        />
        
        {/* Subtle 3D Glare */}
        <div 
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ transform: `translateZ(20px)` }}
        />
      </div>
    </div>
  )
}