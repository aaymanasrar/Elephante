'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function OutfitDetail() {
  const params   = useParams()
  const router   = useRouter()
  const outfitId = params?.id as string

  const [outfit, setOutfit]     = useState<any>(null)
  const [source, setSource]     = useState<'excel' | 'db'>('db')
  const [loading, setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => { if (outfitId) fetchOutfit() }, [outfitId])

  const fetchOutfit = async () => {
    try {
      setLoading(true)
      setFetchError(null)

      const { data: excelData, error: excelError } = await supabase
        .from('excel_outfits')
        .select('*')
        .eq('id', outfitId)
        .maybeSingle()

      console.log('excel_outfits:', excelData, excelError)

      if (excelData) {
        setOutfit(excelData)
        setSource('excel')
      } else {
        const { data: dbData, error: dbError } = await supabase
          .from('outfits')
          .select('*')
          .eq('id', outfitId)
          .maybeSingle()

        console.log('outfits:', dbData, dbError)

        if (dbData) {
          setOutfit(dbData)
          setSource('db')
        } else {
          setFetchError(`excel: ${excelError?.message || 'null'} | db: ${dbError?.message || 'null'}`)
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: savedData } = await supabase
          .from('saved_outfits').select('id')
          .eq('user_id', user.id).eq('outfit_id', outfitId).maybeSingle()
        if (savedData) setSaved(true)
      }
    } catch (err: any) {
      console.error(err)
      setFetchError(err?.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    if (saved) {
      await supabase.from('saved_outfits').delete().eq('user_id', user.id).eq('outfit_id', outfitId)
      setSaved(false)
    } else {
      await supabase.from('saved_outfits').insert([{ user_id: user.id, outfit_id: outfitId }])
      setSaved(true)
    }
    setIsSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
      <ParticleCanvas />
      <div className="relative z-10 w-7 h-7 border-2 border-white/10 border-t-white rounded-full animate-spin"/>
    </div>
  )

  if (fetchError || !outfit) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4 px-6">
      <ParticleCanvas />
      <p className="relative z-10 text-zinc-600 text-[10px] uppercase tracking-widest text-center">
        Could not load outfit
      </p>
      <p className="relative z-10 text-red-900 text-[9px] font-mono text-center break-all max-w-sm">
        ID: {outfitId}<br/>{fetchError}
      </p>
      <button onClick={() => router.back()} className="relative z-10 text-zinc-500 text-[10px] uppercase tracking-widest hover:text-white transition mt-4">
        ← Go back
      </button>
    </div>
  )

  const isExcel     = source === 'excel'
  const title       = isExcel ? outfit.outfit_name    : (outfit.top || 'Untitled')
  const style       = isExcel ? outfit.style_category : outfit.style
  const occasions   = isExcel ? outfit.occasions      : outfit.occasion
  const whenTo      = isExcel ? outfit.when_to_wear   : null
  const details     = isExcel ? outfit.outfit_details : null
  const topWear     = isExcel ? outfit.top_wear       : outfit.top
  const bottomWear  = isExcel ? outfit.bottom_wear    : outfit.bottom
  const shoes       = isExcel ? outfit.shoes          : outfit.shoes
  const accessories = isExcel ? outfit.accessories    : null
  const outerwear   = isExcel ? outfit.outerwear      : null
  const matTop      = isExcel ? outfit.material_top   : null
  const matBottom   = isExcel ? outfit.material_bottom : null
  const matShoes    = isExcel ? outfit.material_shoes  : null
  const matNotes    = isExcel ? outfit.material_notes  : null
  const colorScheme = isExcel ? outfit.color_scheme   : null

  // Parse hex colors — circles only, no codes shown
  let hexColors: string[] = []
  if (isExcel && outfit.hex_colors) {
    try { hexColors = Array.isArray(outfit.hex_colors) ? outfit.hex_colors : JSON.parse(outfit.hex_colors) }
    catch { hexColors = [] }
  }
  if (!isExcel && outfit.color_palette) {
    try { hexColors = typeof outfit.color_palette === 'string' ? JSON.parse(outfit.color_palette) : outfit.color_palette }
    catch { hexColors = [] }
  }

  const pieces = [
    topWear     && { label: 'Top Wear',    value: topWear     },
    bottomWear  && { label: 'Bottom',      value: bottomWear  },
    shoes       && { label: 'Shoes',       value: shoes       },
    accessories && { label: 'Accessories', value: accessories },
    outerwear   && { label: 'Outerwear',   value: outerwear   },
  ].filter(Boolean) as { label: string; value: string }[]

  const materials = [
    matTop    && { label: 'Top Material',    value: matTop    },
    matBottom && { label: 'Bottom Material', value: matBottom },
    matShoes  && { label: 'Shoe Material',   value: matShoes  },
    matNotes  && { label: 'Materials',       value: matNotes  },
  ].filter(Boolean) as { label: string; value: string }[]

  const occasionList = occasions
    ? occasions.split(/[|,]/).map((o: string) => o.trim()).filter(Boolean)
    : []

  return (
    <div className="min-h-screen bg-black text-white font-sans relative overflow-hidden">
      <ParticleCanvas />

      {/* ── Nav ── */}
      <nav
        className="fixed top-0 w-full z-50 px-5 py-5 flex justify-between items-center"
        style={{ animation: 'fadeDown 0.5s cubic-bezier(0.4,0,0.2,1) both' }}
      >
        <button onClick={() => router.back()} className="text-zinc-600 hover:text-white transition-colors min-h-[44px] flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-[10px] tracking-[0.4em] uppercase text-zinc-600">Archive</span>
        <div className="w-7"/>
      </nav>

      <div className="relative z-10 px-4 sm:px-6 pt-20 pb-40 max-w-lg mx-auto">

        {/* ── Card image ── */}
        <div
          className="w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800/50 mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          style={{
            aspectRatio: '3/4',
            animation: 'scaleUp 0.6s cubic-bezier(0.4,0,0.2,1) both',
            animationDelay: '0.05s',
          }}
        >
          {outfit.image_url ? (
            <img
              src={outfit.image_url}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[9px] uppercase tracking-widest">
              No Image
            </div>
          )}
        </div>

        {/* ── Header ── */}
        <div
          className="mb-6"
          style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.15s' }}
        >
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 uppercase mb-2">{style}</p>
          <h1 className="text-2xl font-light tracking-tight">{title}</h1>
          {colorScheme && <p className="text-zinc-700 text-xs mt-1.5 tracking-wide">{colorScheme}</p>}
        </div>

        {/* ── Color circles ── */}
        {hexColors.length > 0 && (
          <div
            className="flex gap-2.5 mb-8"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.2s' }}
          >
            {hexColors.map((hex, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border border-white/10 shadow-md"
                style={{
                  backgroundColor: hex,
                  animation: `fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both`,
                  animationDelay: `${0.2 + i * 0.05}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* ── Occasions ── */}
        {occasionList.length > 0 && (
          <div
            className="mb-8"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.22s' }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-3">Occasions</p>
            <div className="flex flex-wrap gap-2">
              {occasionList.map((occ: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 border border-zinc-800 rounded-full text-[10px] uppercase tracking-wider text-zinc-400"
                  style={{ animation: 'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: `${0.28 + i * 0.04}s` }}
                >
                  {occ}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── When to wear ── */}
        {whenTo && (
          <div
            className="mb-8"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.3s' }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-2">When to Wear</p>
            <p className="text-sm text-zinc-400 leading-relaxed">{whenTo}</p>
          </div>
        )}

        {/* ── Pieces ── */}
        {pieces.length > 0 && (
          <div
            className="mb-8 border-t border-zinc-900 pt-7"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.35s' }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-4">The Pieces</p>
            <div className="space-y-3">
              {pieces.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-start border-b border-zinc-900/60 pb-3 gap-4"
                  style={{ animation: 'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: `${0.38 + i * 0.05}s` }}
                >
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest shrink-0 pt-0.5">{p.label}</span>
                  <span className="text-xs text-zinc-300 text-right leading-relaxed">{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Materials ── */}
        {materials.length > 0 && (
          <div
            className="mb-8 border-t border-zinc-900 pt-7"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.5s' }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-4">Materials</p>
            <div className="space-y-3">
              {materials.map((m, i) => (
                <div
                  key={i}
                  className="border-b border-zinc-900/60 pb-3"
                  style={{ animation: 'fadeUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: `${0.52 + i * 0.05}s` }}
                >
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.label}</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Details ── */}
        {details && (
          <div
            className="mb-8 border-t border-zinc-900 pt-7"
            style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.6s' }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-3">Details & Notes</p>
            <p className="text-sm text-zinc-400 leading-relaxed">{details}</p>
          </div>
        )}
      </div>

      {/* ── CTA ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-5 pb-6 pt-10 bg-gradient-to-t from-black via-black to-transparent"
        style={{ animation: 'fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.1s' }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full max-w-lg mx-auto flex items-center justify-center py-4 text-[11px] uppercase tracking-[0.4em] font-semibold transition-all duration-500 rounded-xl active:scale-95 ${
            saved ? 'bg-transparent border border-zinc-800 text-zinc-500 hover:border-red-900 hover:text-red-500' : 'bg-white text-black hover:bg-zinc-200'
          }`}
        >
          {isSaving ? 'Processing...' : saved ? 'Remove From Closet' : 'Save to Closet'}
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0);     }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>
  )
}