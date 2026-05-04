export interface Profile {
  id: string
  email: string | null
  username: string | null
  skin_tone: string | null
  preferred_palette: string | null
  selected_occasions: string[] | null
  updated_at: string | null
  full_name?: string | null
  gender?: string | null
  body_shape?: string | null
  height_category?: string | null
  style_preference?: string | null
}
