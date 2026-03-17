'use client'

import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useRef } from 'react'

export default function RotatingCard({ image }: { image: string }) {
  const ref = useRef<HTMLDivElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const rotateX = useTransform(y, [-100, 100], [15, -15])
  const rotateY = useTransform(x, [-100, 100], [-15, 15])

  function handleMouseMove(event: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    x.set(event.clientX - centerX)
    y.set(event.clientY - centerY)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000
      }}
      className="w-80 h-[500px] bg-zinc-900 rounded-xl shadow-2xl"
    >
      <img
        src={image}
        className="w-full h-full object-cover rounded-xl"
        alt="Outfit"
      />
    </motion.div>
  )
}
