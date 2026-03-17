'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const LIFESTYLE = [
  { id: 'Business Casual', label: 'Business Casual' },
  { id: 'Smart Casual',    label: 'Smart Casual'    },
]

const AESTHETICS = [
  { id: 'neutral',  label: 'Neutral'  },
  { id: 'dark',     label: 'Dark'     },
  { id: 'pastel',   label: 'Pastel'   },
  { id: 'colorful', label: 'Vibrant'  },
]

const SCHEME_KEYWORDS: Record<string, string[]> = {
  neutral:  ['beige','camel','cream','off-white','stone','tan','grey','gray','white','khaki'],
  dark:     ['black','charcoal','navy','dark','indigo','midnight'],
  pastel:   ['pastel','light blue','sky blue','lavender','pink','soft','sage'],
  colorful: ['vibrant','green','red','yellow','orange','burgundy','colorful'],
}

// ─── Particle Canvas ──────────────────────────────────────────────────────────
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

// ─── Closet Page ──────────────────────────────────────────────────────────────
export default function ClosetPage() {
  const router = useRouter()

  const [allOutfits, setAllOutfits]   = useState<any[]>([])
  const [displayed, setDisplayed]     = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Active filters — now multi-select arrays
  const [activeLifestyles, setActiveLifestyles] = useState<string[]>([])
  const [activeAesthetics, setActiveAesthetics] = useState<string[]>([])

  // User profile
  const [userSkinTone, setUserSkinTone] = useState<string>('')
  const [userPalette, setUserPalette]   = useState<string[]>([])

  useEffect(() => { loadData() }, [])

  // Re-filter whenever filters or search change
  useEffect(() => {
    applyFilters()
  }, [allOutfits, activeLifestyles, activeAesthetics, searchQuery])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch user profile for palette prefs
      const { data: profile } = await supabase
        .from('profiles').select('skin_tone, preferred_palette').eq('id', user.id).single()

      const paletteStr = profile?.preferred_palette || ''
      const palettes = paletteStr ? paletteStr.split(',').map((p: string) => p.trim().toLowerCase()) : []
      setUserSkinTone(profile?.skin_tone || '')
      setUserPalette(palettes)

      // Fetch only SAVED outfit IDs for this user
      const { data: savedRows } = await supabase
        .from('saved_outfits')
        .select('outfit_id')
        .eq('user_id', user.id)

      const savedIds = (savedRows || []).map((r: any) => r.outfit_id).filter(Boolean)

      if (savedIds.length === 0) {
        setAllOutfits([])
        setLoading(false)
        return
      }

      // Fetch matching outfits from both tables using saved IDs
      const [{ data: excelData }, { data: dbData }] = await Promise.all([
        supabase.from('excel_outfits').select('*').in('id', savedIds),
        supabase.from('outfits').select('*').in('id', savedIds),
      ])

      const combined = [
        ...(excelData || []).map((o: any) => ({ ...o, _source: 'excel' })),
        ...(dbData    || []).map((o: any) => ({ ...o, _source: 'db'    })),
      ]

      setAllOutfits(combined)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const matchesAesthetic = (outfit: any, aesthetic: string) => {
    const scheme = (outfit.color_scheme || outfit.color_palette || '').toLowerCase()
    const keywords = SCHEME_KEYWORDS[aesthetic] || []
    return keywords.some(k => scheme.includes(k))
  }

  const matchesSearch = (outfit: any, query: string) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    const parts = q.split(/\s+/)
    const blob = [
      outfit.outfit_name, outfit.style_category, outfit.style,
      outfit.color_scheme, outfit.top_wear, outfit.top,
      outfit.bottom_wear, outfit.bottom, outfit.shoes,
      outfit.accessories, outfit.outerwear, outfit.occasions,
      outfit.when_to_wear, outfit.outfit_details,
      outfit.material_notes,
    ].filter(Boolean).join(' ').toLowerCase()

    // keyword synonyms
    const expand = (s: string) => s
      + (s.includes('office') || s.includes('business') ? ' work meeting corporate' : '')
      + (s.includes('wedding') || s.includes('gala') ? ' formal event celebration' : '')
      + (s.includes('thobe') ? ' traditional saudi arab' : '')
      + (s.includes('casual') ? ' relaxed weekend everyday' : '')

    const expanded = expand(blob)
    return parts.every(p => expanded.includes(p))
  }

  const applyFilters = () => {
    let result = [...allOutfits]

    // Lifestyle filter — match any selected
    if (activeLifestyles.length > 0) {
      result = result.filter(o =>
        activeLifestyles.some(l =>
          (o.style_category || o.style || '').toLowerCase().includes(l.toLowerCase())
        )
      )
    }

    // Aesthetic filter — match any selected
    if (activeAesthetics.length > 0) {
      result = result.filter(o =>
        activeAesthetics.some(a => matchesAesthetic(o, a))
      )
    }

    // Search
    if (searchQuery.trim()) {
      result = result.filter(o => matchesSearch(o, searchQuery))
    }

    // Sort: user's preferred palettes first
    if (userPalette.length > 0) {
      result.sort((a, b) => {
        const aMatch = userPalette.some(p => matchesAesthetic(a, p)) ? 0 : 1
        const bMatch = userPalette.some(p => matchesAesthetic(b, p)) ? 0 : 1
        return aMatch - bMatch
      })
    }

    setDisplayed(result)
  }

  // Search typing effect
  useEffect(() => {
    if (!searchQuery) { setIsSearching(false); return }
    setIsSearching(true)
    const t = setTimeout(() => setIsSearching(false), 700)
    return () => clearTimeout(t)
  }, [searchQuery])

  const pillBase = 'flex-shrink-0 px-4 py-2 rounded-full border text-[10px] uppercase tracking-widest font-semibold transition-all duration-300 whitespace-nowrap min-h-[36px] flex items-center'
  const pillOn   = 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.15)]'
  const pillOff  = 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ParticleCanvas />

      {/* ── Header ── */}
      <div className="relative z-20 flex items-center justify-between px-5 pt-8 sm:pt-10 pb-3">
        <button
          onClick={() => router.back()}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          ← Back
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold tracking-[0.4em] text-zinc-500 uppercase">
          Closet
        </h1>
        <div className="w-10"/>
      </div>

      {/* ── Filter rows ── */}
      <div className="relative z-20 px-4 space-y-2 pb-3">

        {/* Lifestyle row */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">Style</span>
          {LIFESTYLE.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveLifestyles(prev =>
                prev.includes(l.id) ? prev.filter(x => x !== l.id) : [...prev, l.id]
              )}
              className={`${pillBase} ${activeLifestyles.includes(l.id) ? pillOn : pillOff}`}
            >{l.label}</button>
          ))}
        </div>

        {/* Aesthetic row */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
          <span className="flex-shrink-0 text-[9px] uppercase tracking-widest text-zinc-700 self-center pr-1">Color</span>
          {AESTHETICS.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveAesthetics(prev =>
                prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id]
              )}
              className={`${pillBase} ${activeAesthetics.includes(a.id) ? pillOn : pillOff}`}
            >
              {a.label}
              {userPalette.includes(a.id) && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 inline-block"/>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative z-20 px-4 pb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search — wedding, office, white shirt, suit..."
            className="w-full bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-700 text-sm rounded-2xl py-3 pl-5 pr-10 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
          />
          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border border-white/20 border-t-white rounded-full animate-spin"/>
            </div>
          )}
          {searchQuery && !isSearching && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="relative z-10 px-4 pb-32">
        {loading || isSearching ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-7 h-7 border-2 border-white/10 border-t-white rounded-full animate-spin"/>
            <p className="text-zinc-700 text-[10px] uppercase tracking-widest">
              {isSearching ? 'Searching...' : 'Loading...'}
            </p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <p className="text-zinc-800 text-[10px] uppercase tracking-[0.4em]">No saved outfits yet</p>
            <p className="text-zinc-900 text-[9px] mt-2 tracking-widest">Save outfits from the feed to see them here</p>
          </div>
        ) : (
          <>
            <p className="text-zinc-700 text-[9px] uppercase tracking-widest mb-4">
              {displayed.length} look{displayed.length !== 1 ? 's' : ''}
              {(activeLifestyles.length > 0 || activeAesthetics.length > 0) && ' · filtered'}
              {userPalette.length > 0 && activeAesthetics.length === 0 && ' · sorted by your aesthetic'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {displayed.map((outfit, i) => {
                const imgUrl = outfit.image_url
                const label  = outfit.outfit_name || outfit.style || ''

                return (
                  <div
                    key={outfit.id || i}
                    className="group cursor-pointer"
                    onClick={() => router.push(`/outfit/${outfit.id}`)}
                  >
                    <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-zinc-900 border border-zinc-800/40 group-hover:border-zinc-600 transition-all duration-500">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={label}
                          className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[9px] uppercase tracking-widest">
                          No image
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-300 truncate">{label}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}