export function isSupabaseImageUrl(url?: string | null) {
  return Boolean(url && /^https:\/\/[^/]+\.supabase\.(co|in)\//i.test(url))
}

export function isLocalImageUrl(url?: string | null) {
  return Boolean(url && url.startsWith('/'))
}

export function canUseNextImage(url?: string | null) {
  return isLocalImageUrl(url) || isSupabaseImageUrl(url)
}
