'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LoadingScreen from '@/app/components/LoadingScreen'
import ParticleCanvas from '@/components/ParticleCanvas'

// ─── Edit Sheet ───────────────────────────────────────────────────────────────
type EditField = 'username' | 'email' | 'password' | null

function EditSheet({
  field, currentValue, onClose, onSaved,
}: {
  field: EditField
  currentValue: string
  onClose: () => void
  onSaved: (field: EditField, newValue: string) => void
}) {
  const [value, setValue]     = useState('')
  const [confirm, setConfirm] = useState('')   // for password
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  if (!field) return null

  const LABELS: Record<NonNullable<EditField>, string> = {
    username: 'New Username',
    email:    'New Email Address',
    password: 'New Password',
  }

  const handleSave = async () => {
    setError('')
    const v = value.trim()
    if (!v) { setError('Field cannot be empty.'); return }
    if (field === 'password' && v !== confirm) { setError('Passwords do not match.'); return }
    if (field === 'password' && v.length < 6)  { setError('Password must be at least 6 characters.'); return }

    setSaving(true)
    try {
      if (field === 'username') {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const { error: dbErr } = await supabase.from('profiles').update({
          username: v, full_name: v,
        }).eq('id', user.id)
        if (dbErr) throw dbErr
      } else if (field === 'email') {
        const { error: authErr } = await supabase.auth.updateUser({ email: v })
        if (authErr) throw authErr
      } else if (field === 'password') {
        const { error: authErr } = await supabase.auth.updateUser({ password: v })
        if (authErr) throw authErr
      }
      setDone(true)
      onSaved(field, v)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-t-3xl px-6 pt-6 pb-10 animate-in slide-in-from-bottom-4 duration-300">
        {/* Handle */}
        <div className="w-10 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />

        <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 mb-1">
          {field === 'username' ? 'Account' : field === 'email' ? 'Account' : 'Security'}
        </p>
        <h2 className="text-white text-base font-light mb-6">
          Change {field.charAt(0).toUpperCase() + field.slice(1)}
        </h2>

        {done ? (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm leading-relaxed">
              {field === 'email'
                ? 'Check your new email address to confirm the change.'
                : `Your ${field} has been updated.`}
            </p>
            <button
              onClick={onClose}
              className="w-full h-12 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {field !== 'password' && (
              <p className="text-zinc-700 text-[11px] mb-1">
                Current: <span className="text-zinc-500">{currentValue}</span>
              </p>
            )}

            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              placeholder={LABELS[field]}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
            />

            {field === 'password' && (
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
              />
            )}

            {error && (
              <p className="text-red-400 text-[11px]">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-12 border border-zinc-800 text-zinc-500 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-12 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export default function ProfileDashboard() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [userEmail, setUserEmail]   = useState('')
  const [username, setUsername]     = useState('Style Icon')
  const [savedCount, setSavedCount] = useState(0)
  const [editField, setEditField]       = useState<EditField>(null)
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUsername(profile.full_name || profile.username || user.email?.split('@')[0] || 'Style Icon')
      }

      const { count } = await supabase
        .from('saved_outfits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setSavedCount(count || 0)
      setLoading(false)
    }
    fetchData()
  }, [router])

  const handleSaved = (field: EditField, newValue: string) => {
    if (field === 'username') setUsername(newValue)
    if (field === 'email')    setUserEmail(newValue)
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-[100dvh] bg-black text-white relative">
      <ParticleCanvas />

      {/* ── Back button ── */}
      <div className="fixed top-0 left-0 right-0 z-20 px-5 pt-8 sm:pt-10 flex justify-between items-center">
        <button
          onClick={() => router.push('/feed')}
          className="text-zinc-600 text-[10px] uppercase tracking-[0.3em] hover:text-white transition-colors min-h-[44px] flex items-center"
        >
          Back
        </button>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-5 py-20 overflow-y-auto">
        <div className="w-full max-w-sm flex flex-col items-center">

          {/* Avatar */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mb-5 shadow-[0_0_24px_rgba(255,255,255,0.04)]">
            <span className="text-zinc-300 text-2xl font-light">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>

          <h1 className="text-base font-light tracking-widest text-white mb-1">{username}</h1>
          <p className="text-zinc-600 text-[11px] tracking-wide mb-10">{userEmail}</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 w-full mb-8">
            <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl text-center">
              <div className="text-2xl font-bold text-white mb-1">{savedCount}</div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-600">Saved Items</div>
            </div>
            <button
              onClick={() => setShowAccountMenu(true)}
              className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-zinc-600 hover:bg-zinc-900 transition-all duration-200 active:scale-95"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <div className="text-[9px] uppercase tracking-widest text-zinc-600">Account</div>
            </button>
          </div>

          {/* Outfit Builder */}
          <button
            onClick={() => router.push('/outfit-builder')}
            className="group w-full rounded-2xl border border-zinc-800/60 overflow-hidden mb-8 relative hover:border-zinc-700 transition-all duration-300 text-left"
          >
            <div className="w-full flex items-center justify-center py-8 bg-zinc-950 select-none transition-all duration-500 group-hover:bg-zinc-900/60">
              <svg width="90" height="160" viewBox="0 0 90 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-500 group-hover:scale-105">
                <ellipse cx="45" cy="16" rx="13" ry="15" fill="#3f3f46"/>
                <rect x="40" y="29" width="10" height="10" rx="2" fill="#3f3f46"/>
                <path d="M10 48 Q45 35 80 48 L80 95 Q45 105 10 95 Z" fill="#3f3f46"/>
                <rect x="28" y="95" width="34" height="35" rx="4" fill="#3f3f46"/>
                <path d="M20 130 Q45 122 70 130 L66 155 Q45 160 24 155 Z" fill="#3f3f46"/>
                <rect x="43" y="155" width="4" height="5" fill="#3f3f46"/>
                <ellipse cx="45" cy="160" rx="18" ry="4" fill="#3f3f46"/>
              </svg>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500 mb-2 group-hover:text-zinc-400 transition-colors">Build an Outfit</span>
              <p className="text-white text-sm font-light leading-snug mb-1">Outfit Builder</p>
              <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[200px] group-hover:text-zinc-400 transition-colors">
                Mix and match pieces around your wardrobe. Upload a photo or describe any item.
              </p>
              <span className="mt-3 text-[9px] uppercase tracking-[0.25em] text-zinc-700 group-hover:text-zinc-500 transition-colors">Tap to open →</span>
            </div>
          </button>

          {/* Actions */}
          <div className="w-full space-y-3 mb-6">
            <button
              onClick={() => router.push('/ai-stylist')}
              className="w-full py-3.5 bg-white text-black font-bold text-[10px] uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-colors min-h-[52px]"
            >
              AI Stylist
            </button>
            <button
              onClick={() => router.push('/profile/preferences')}
              className="w-full py-3.5 border border-zinc-800 text-zinc-400 font-bold text-[10px] uppercase tracking-widest rounded-full hover:border-zinc-600 hover:text-white transition-colors min-h-[52px]"
            >
              Personal Preferences
            </button>
          </div>

          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="w-full py-3.5 border border-zinc-900 text-zinc-600 font-bold text-[10px] uppercase tracking-widest rounded-full hover:border-red-900/60 hover:text-red-500 transition-colors min-h-[52px]"
          >
            Sign Out
          </button>

        </div>
      </div>

      {/* ── Account menu sheet ── */}
      {showAccountMenu && !editField && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center"
          style={{
            background: 'rgba(0,0,0,0)',
            backdropFilter: 'blur(0px)',
            animation: 'accountOverlayIn 0.35s ease forwards',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAccountMenu(false) }}
        >
          <div
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800/70 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl"
            style={{ animation: 'accountSheetIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          >
            <div className="w-10 h-1 bg-zinc-800 rounded-full mx-auto mb-6" />
            <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600 mb-5">Account Settings</p>
            <div className="border border-zinc-900 rounded-2xl overflow-hidden">
              {(
                [
                  { label: 'Change Username', sub: username,   field: 'username' as EditField },
                  { label: 'Change Email',    sub: userEmail,  field: 'email'    as EditField },
                  { label: 'Change Password', sub: '••••••••', field: 'password' as EditField },
                ] as const
              ).map(({ label, sub, field }, i, arr) => (
                <button
                  key={field}
                  onClick={() => { setShowAccountMenu(false); setEditField(field) }}
                  className={`w-full flex items-center justify-between px-4 py-4 text-left hover:bg-zinc-900/60 transition-colors ${
                    i < arr.length - 1 ? 'border-b border-zinc-900' : ''
                  }`}
                  style={{ opacity: 0, animation: `accountItemIn 0.3s ease forwards ${i * 60 + 120}ms` }}
                >
                  <div>
                    <p className="text-zinc-200 text-[13px]">{label}</p>
                    <p className="text-zinc-600 text-[11px] mt-0.5 truncate max-w-[200px]">{sub}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-700 shrink-0">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAccountMenu(false)}
              className="w-full mt-4 h-11 border border-zinc-800 text-zinc-500 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-zinc-600 hover:text-white transition-colors"
              style={{ opacity: 0, animation: 'accountItemIn 0.3s ease forwards 300ms' }}
            >
              Cancel
            </button>
          </div>

          <style jsx>{`
            @keyframes accountOverlayIn {
              to { background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); }
            }
            @keyframes accountSheetIn {
              from { transform: translateY(100%) scale(0.97); opacity: 0; }
              to   { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes accountItemIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* ── Edit sheet ── */}
      {editField && (
        <EditSheet
          field={editField}
          currentValue={editField === 'email' ? userEmail : editField === 'username' ? username : ''}
          onClose={() => setEditField(null)}
          onSaved={(f, v) => { handleSaved(f, v); setEditField(null) }}
        />
      )}
    </div>
  )
}
