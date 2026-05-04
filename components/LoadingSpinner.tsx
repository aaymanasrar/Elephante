'use client'

interface LoadingSpinnerProps {
  text?: string
  className?: string
}

export default function LoadingSpinner({ text, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="w-7 h-7 border-2 border-white/10 border-t-white rounded-full animate-spin" aria-hidden="true" />
      {text ? (
        <p className="text-zinc-700 text-[10px] uppercase tracking-widest text-center">{text}</p>
      ) : null}
    </div>
  )
}
