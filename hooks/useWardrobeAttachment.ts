'use client'

import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { analyzeWardrobeWithAIServer, formatCulturalTags } from '@/services/analyzeWardrobeWithAI'

export interface WardrobeTag {
  id: 'color' | 'item_type' | 'material' | 'pattern' | 'formality' | 'occasion'
  label: string
}

export interface WardrobeAttachment {
  preview: string
  uploading: boolean
  confirming: boolean
  analyzing: boolean
  image_url: string
  storage_path: string
  original_image_url?: string
  original_storage_path?: string
  image_prettified?: boolean
  image_ai_edited?: boolean
  image_provider?: string
  item_name: string
  item_type: string
  pieces: string[]
  color: string
  material?: string
  pattern?: string
  season?: string
  formality?: string
  brand_visible?: string
  occasion: string
  style_query: string
  tags: WardrobeTag[]
  perfect_visual_prompt?: string
  cultural_tags?: string[]
  error?: string
}

export function useWardrobeAttachment(userId: string, onStyleQuery: (query: string) => void, onClearSearch: () => void) {
  const [attachment, setAttachment] = useState<WardrobeAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}` }
  }

  const attachFile = async (file: File | null | undefined) => {
    if (!file) return

    if (attachment?.preview?.startsWith('blob:')) URL.revokeObjectURL(attachment.preview)
    const preview = URL.createObjectURL(file)
    setAttachment({
      preview,
      uploading: true,
      confirming: false,
      analyzing: false,
      image_url: '',
      storage_path: '',
      item_name: 'Identifying...',
      item_type: 'top',
      pieces: [],
      color: '',
      occasion: '',
      style_query: '',
      tags: [],
    })

    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders || !userId) {
        setAttachment((prev) => prev ? { ...prev, uploading: false, error: 'Not signed in. Please refresh and try again.' } : null)
        return
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/wardrobe/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      const data = await response.json()

      if (data.error) {
        setAttachment((prev) => prev ? { ...prev, uploading: false, error: data.error } : null)
        return
      }

      setAttachment({
        preview,
        uploading: false,
        confirming: false,
        analyzing: false,
        image_url: data.image_url,
        storage_path: data.storage_path,
        original_image_url: data.original_image_url,
        original_storage_path: data.original_storage_path,
        image_prettified: Boolean(data.image_prettified),
        image_ai_edited: Boolean(data.image_ai_edited),
        image_provider: data.image_provider || '',
        item_name: data.item_name,
        item_type: data.item_type,
        pieces: Array.isArray(data.pieces) ? data.pieces : [],
        color: data.color || '',
        material: data.material || '',
        pattern: data.pattern || '',
        season: data.season || '',
        formality: data.formality || '',
        brand_visible: data.brand_visible || '',
        occasion: data.occasion || '',
        style_query: data.style_query || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setAttachment((prev) => prev ? { ...prev, uploading: false, error: message } : null)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    await attachFile(event.target.files?.[0])
  }

  const updateTag = (id: WardrobeTag['id'], label: string) => {
    setAttachment((previous) => {
      if (!previous) return previous

      const nextTags = previous.tags.map((tag) => tag.id === id ? { ...tag, label } : tag)
      return {
        ...previous,
        tags: nextTags,
        color: id === 'color' ? label : previous.color,
        item_type: id === 'item_type' ? label : previous.item_type,
        material: id === 'material' ? label : previous.material,
        pattern: id === 'pattern' ? label : previous.pattern,
        formality: id === 'formality' ? label : previous.formality,
        occasion: id === 'occasion' ? label : previous.occasion,
      }
    })
  }

  const confirmAttachment = async () => {
    if (!attachment) return

    setAttachment((previous) => previous ? { ...previous, confirming: true } : previous)

    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders) {
        setAttachment((previous) => previous ? { ...previous, confirming: false, error: 'Not signed in. Please refresh and try again.' } : previous)
        return
      }

      const response = await fetch('/api/wardrobe/upload', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: attachment.image_url,
          storage_path: attachment.storage_path,
          original_image_url: attachment.original_image_url,
          original_storage_path: attachment.original_storage_path,
          image_prettified: attachment.image_prettified,
          image_ai_edited: attachment.image_ai_edited,
          image_provider: attachment.image_provider,
          item_name: attachment.item_name,
          item_type: attachment.item_type,
          pieces: attachment.pieces,
          color: attachment.color,
          material: attachment.material || '',
          pattern: attachment.pattern || '',
          season: attachment.season || '',
          formality: attachment.formality || '',
          brand_visible: attachment.brand_visible || '',
          occasion: attachment.occasion,
          style_query: attachment.style_query || `style this ${attachment.item_type}`,
          tags: attachment.tags,
        }),
      })

      const data = await response.json()
      if (data.error) {
        setAttachment((previous) => previous ? { ...previous, confirming: false, error: data.error } : previous)
        return
      }

      setAttachment((previous) => previous ? { ...previous, confirming: false } : previous)
      onStyleQuery(data.style_query || attachment.style_query)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save wardrobe item. Please try again.'
      setAttachment((previous) => previous ? { ...previous, confirming: false, error: message } : previous)
    }
  }

  const clearAttachment = (options?: { clearSearch?: boolean }) => {
    if (attachment?.preview?.startsWith('blob:')) URL.revokeObjectURL(attachment.preview)
    setAttachment(null)
    if (options?.clearSearch !== false) onClearSearch()
  }

  const analyzeWithAIServer = async () => {
    if (!attachment || !attachment.image_url) return

    setAttachment((prev) => prev ? { ...prev, analyzing: true } : null)

    try {
      const result = await analyzeWardrobeWithAIServer(
        attachment.image_url,
        attachment.item_name,
        attachment.item_type,
        attachment.color,
        attachment.occasion,
      )

      if (result) {
        const culturalTags = formatCulturalTags(result)
        setAttachment((prev) => prev ? {
          ...prev,
          analyzing: false,
          perfect_visual_prompt: result.perfect_visual_prompt,
          cultural_tags: culturalTags,
        } : null)
      } else {
        setAttachment((prev) => prev ? { ...prev, analyzing: false } : null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed'
      console.error('[analyzeWithAIServer]', message)
      setAttachment((prev) => prev ? { ...prev, analyzing: false } : null)
    }
  }

  return {
    attachment,
    clearAttachment,
    confirmAttachment,
    analyzeWithAIServer,
    fileInputRef,
    attachFile,
    handleAttachment,
    updateTag,
  }
}

