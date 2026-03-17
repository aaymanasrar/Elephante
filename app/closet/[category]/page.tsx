'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  { id: 'outerwear',   label: 'Outerwear'        },
  { id: 'tops',        label: 'Tops & Shirts'     },
  { id: 'trousers',    label: 'Trousers & Denim'  },
  { id: 'footwear',    label: 'Footwear'          },
  { id: 'accessories', label: 'Accessories'       },
  { id: 'tailoring',   label: 'Suits & Tailoring' },
]

// ─── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number, W = 0, H = 0
    interface P { x:number;y:number;vx:number;vy:number;r:number;alpha:number }
    let particles: P[] = []
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    const init = () => { particles = Array.from({length:55},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,r:Math.random()*1.4+.4,alpha:Math.random()*.45+.1})) }
    const draw = () => {
      ctx.clearRect(0,0,W,H)
      const g = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*.55)
      g.addColorStop(0,'rgba(255,255,255,0.025)');g.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H)
      for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<140){ctx.beginPath();ctx.strokeStyle=`rgba(255,255,255,${.055*(1-d/140)})`;ctx.lineWidth=.5;ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.stroke()}}
      for(const p of particles){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${p.alpha})`;ctx.fill();p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0}
      animId=requestAnimationFrame(draw)
    }
    resize();init();draw()
    const r=()=>{resize();init()}
    window.addEventListener('resize',r)
    return ()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',r)}
  },[])
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0"/>
}

// ─── Category Archive ─────────────────────────────────────────────────────────
export default function CategoryArchive() {
  const params     = useParams()
  const router     = useRouter()
  const [items, setItems]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const categoryId = params?.category as string
  const categoryLabel = CATEGORIES.find(c => c.id === categoryId)?.label || categoryId

  useEffect(() => { fetchSavedItems() }, [categoryId])

  const fetchSavedItems = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('saved_pieces')
        .select(`id, piece_name, category, outfits(image_url)`)
        .eq('user_id', user.id)
        .eq('category', categoryId)

      if (error) throw error
      if (data) setItems(data)
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setItems(prev => prev.filter(item => item.id !== itemId))
    const { error } = await supabase.from('saved_pieces').delete().eq('id', itemId)
    if (error) { console.error('Delete error:', error); fetchSavedItems() }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ParticleCanvas />

      {/* ── Header ── */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-8 sm:pt-10 pb-4">
        <button
          onClick={() => router.push('/closet')}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          ← Closet
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase whitespace-nowrap">
          {categoryLabel}
        </h1>
        <div className="w-10" />
      </div>

      {/* ── Category tab strip ── */}
      <div className="relative z-20 px-4 pb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.id}
              href={`/closet/${cat.id}`}
              className={`flex-shrink-0 px-4 py-2 rounded-full border text-[10px] uppercase tracking-widest font-semibold transition-all duration-300 whitespace-nowrap ${
                categoryId === cat.id
                  ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.2)]'
                  : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="relative z-10 px-4 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-4">
            <div className="w-7 h-7 border-2 border-white/10 border-t-white rounded-full animate-spin" />
            <p className="text-zinc-700 text-[10px] uppercase tracking-widest">Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 border border-dashed border-zinc-900 rounded-2xl mx-2">
            <p className="text-zinc-800 text-[10px] uppercase tracking-[0.4em]">Nothing in {categoryLabel}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="group cursor-pointer relative"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="absolute top-2.5 right-2.5 z-20 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-500/80 hover:border-red-500"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <div className="w-full aspect-[3/4] bg-zinc-900 border border-zinc-800/50 rounded-xl overflow-hidden group-hover:border-zinc-600 transition-all duration-500">
                  {item.outfits?.image_url ? (
                    <img
                      src={item.outfits.image_url}
                      alt={item.piece_name}
                      className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[9px] uppercase tracking-widest">
                      No image
                    </div>
                  )}
                </div>

                <p className="mt-2 text-[10px] uppercase tracking-widest text-zinc-600 group-hover:text-zinc-300 transition-colors truncate">
                  {item.piece_name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}