'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import { fetchElephanteBootstrapData } from '@/services/elephanteDataService'
import type { Outfit } from '@/types/outfit'

interface ElephanteDataState {
  allOutfits: Outfit[]
  allOutfitsRef: MutableRefObject<Outfit[]>
  displayName: string
  loading: boolean
  showTour: boolean
  userBodyShape: string
  userGender: string
  userHeight: string
  userId: string
  userPalettes: string[]
  userSkinTone: string
  userStylePref: string
  userAvatarUrl: string
  setShowTour: Dispatch<SetStateAction<boolean>>
}

export function useElephanteData(onUnauthenticated: () => void): ElephanteDataState {
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([])
  const allOutfitsRef = useRef<Outfit[]>([])
  const [displayName, setDisplayName] = useState<string>('User')
  const [loading, setLoading] = useState(true)
  const [showTour, setShowTour] = useState(false)
  const [userBodyShape, setUserBodyShape] = useState('')
  const [userGender, setUserGender] = useState<string>('male')
  const [userHeight, setUserHeight] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [userPalettes, setUserPalettes] = useState<string[]>([])
  const [userSkinTone, setUserSkinTone] = useState('')
  const [userStylePref, setUserStylePref] = useState('')
  const [userAvatarUrl, setUserAvatarUrl] = useState('')

  // Stable ref so the effect doesn't re-run when the parent re-renders with a new inline function
  const onUnauthenticatedRef = useRef(onUnauthenticated)
  useEffect(() => { onUnauthenticatedRef.current = onUnauthenticated })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bootstrapData = await fetchElephanteBootstrapData()
        if (!bootstrapData) {
          onUnauthenticatedRef.current()
          return
        }

        setDisplayName(bootstrapData.displayName)
        setUserGender(bootstrapData.userGender)
        setUserSkinTone(bootstrapData.userSkinTone)
        setUserPalettes(bootstrapData.userPalettes)
        setUserBodyShape(bootstrapData.userBodyShape)
        setUserHeight(bootstrapData.userHeight)
        setUserStylePref(bootstrapData.userStylePref)
        setUserAvatarUrl(bootstrapData.userAvatarUrl)
        setUserId(bootstrapData.userId)
        allOutfitsRef.current = bootstrapData.outfits
        setAllOutfits(bootstrapData.outfits)
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          console.error('Elephante Data Error:', error)
        }
      } finally {
        setLoading(false)
        if (typeof window !== 'undefined' && !localStorage.getItem('elephante_tour_done')) {
          setShowTour(true)
        }
      }
    }

    fetchData()
  }, [])

  return {
    allOutfits,
    allOutfitsRef,
    displayName,
    loading,
    showTour,
    userBodyShape,
    userGender,
    userHeight,
    userId,
    userPalettes,
    userSkinTone,
    userStylePref,
    userAvatarUrl,
    setShowTour,
  }
}
