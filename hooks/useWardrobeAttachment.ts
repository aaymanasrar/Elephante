'use client'

import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface WardrobeTag {
  id: 'color' | 'item_type' | 'occasion'
  label: string
}

export interface WardrobeAttachment {
  preview: string
  uploading: boolean
  confirming: boolean
  image_url: string
  storage_path: string
  item_name: string
  item_type: string
  color: string
  occasion: string
  style_query: string
  tags: WardrobeTag[]
}

export function useWardrobeAttachment(userId: string, onStyleQuery: (query: string) => void, onClearSearch: () => void) {
  const [attachment, setAttachment] = useState<WardrobeAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}` }
  }

  const handleAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setAttachment({
      preview,
      uploading: true,
      confirming: false,
      image_url: '',
      storage_path: '',
      item_name: 'Identifying...',
      item_type: 'top',
      color: '',
      occasion: '',
      style_query: '',
      tags: [],
    })

    try {
      const authHeaders = await getAuthHeaders()
      if (!authHeaders || !userId) {
        setAttachment(null)
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
        setAttachment(null)
        return
      }

      setAttachment({
        preview,
        uploading: false,
        confirming: false,
        image_url: data.image_url,
        storage_path: data.storage_path,
        item_name: data.item_name,
        item_type: data.item_type,
        color: data.color || '',
        occasion: data.occasion || '',
        style_query: data.style_query || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
      })
    } catch {
      setAttachment(null)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
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
        setAttachment((previous) => previous ? { ...previous, confirming: false } : previous)
        return
      }

      const response = await fetch('/api/wardrobe/upload', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: attachment.image_url,
          storage_path: attachment.storage_path,
          item_name: attachment.item_name,
          item_type: attachment.item_type,
          color: attachment.color,
          occasion: attachment.occasion,
          style_query: attachment.style_query || `style this ${attachment.item_type}`,
        }),
      })

      const data = await response.json()
      if (data.error) {
        setAttachment((previous) => previous ? { ...previous, confirming: false } : previous)
        return
      }

      setAttachment((previous) => previous ? { ...previous, confirming: false } : previous)
      onStyleQuery(data.style_query || attachment.style_query)
    } catch {
      setAttachment((previous) => previous ? { ...previous, confirming: false } : previous)
    }
  }

  const clearAttachment = () => {
    if (attachment?.preview) URL.revokeObjectURL(attachment.preview)
    setAttachment(null)
    onClearSearch()
  }

  return {
    attachment,
    clearAttachment,
    confirmAttachment,
    fileInputRef,
    handleAttachment,
    updateTag,
  }
}
