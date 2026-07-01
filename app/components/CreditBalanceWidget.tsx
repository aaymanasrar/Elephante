'use client'

interface CreditBalanceWidgetProps {
  balance: number | null
  loading?: boolean
  onRefresh?: () => void
}

export default function CreditBalanceWidget({ balance, loading, onRefresh }: CreditBalanceWidgetProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] uppercase tracking-[0.35em] text-zinc-300">
      <span className="text-zinc-500">Credits</span>
      <span className="text-white">{loading ? '...' : balance ?? '--'}</span>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          ↻
        </button>
      ) : null}
    </div>
  )
}
