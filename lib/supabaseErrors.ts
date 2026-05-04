export function getFriendlyAuthError(message?: string | null) {
  const normalized = (message || '').toLowerCase()

  if (!normalized) return 'Something went wrong. Please try again.'
  if (normalized.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (normalized.includes('email not confirmed') || normalized.includes('not confirmed')) {
    return 'Please verify your email to continue.'
  }
  if (normalized.includes('already registered')) return 'This email is already registered.'
  if (normalized.includes('password should be at least')) return 'Password must be at least 6 characters.'
  if (normalized.includes('duplicate key')) return 'That account detail is already in use.'
  if (normalized.includes('network')) return 'Connection issue. Please check your internet and try again.'

  return 'Something went wrong. Please try again.'
}

export function getFriendlyProfileError(message?: string | null) {
  const normalized = (message || '').toLowerCase()

  if (!normalized) return 'We could not save your profile right now.'
  if (normalized.includes('duplicate key') && normalized.includes('username')) return 'Username is already taken.'
  if (normalized.includes('duplicate key') && normalized.includes('email')) return 'Email is already registered.'

  return 'We could not save your profile right now.'
}

export function getFriendlyDataError(message: string | null | undefined, fallback: string) {
  const normalized = (message || '').toLowerCase()

  if (!normalized) return fallback
  if (normalized.includes('jwt') || normalized.includes('auth')) return 'Please sign in again.'
  if (normalized.includes('network')) return 'Connection issue. Please try again.'

  return fallback
}
