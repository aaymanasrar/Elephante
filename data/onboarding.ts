export const SKIN_TONES = [
  { id: 'light', color: '#FFE0BD', label: 'Light', labelAr: '\u0641\u0627\u062a\u062d' },
  { id: 'medium', color: '#D2B48C', label: 'Medium', labelAr: '\u0645\u062a\u0648\u0633\u0637' },
  { id: 'tan', color: '#AF8154', label: 'Tan', labelAr: '\u0623\u0633\u0645\u0631' },
  { id: 'dark', color: '#5C3816', label: 'Deep', labelAr: '\u062f\u0627\u0643\u0646' },
] as const

export const SKIN_UNDERTONES = [
  { id: 'cool',    label: 'Cool',    labelAr: '\u0628\u0627\u0631\u062f',   hint: 'pink \u00b7 blue \u00b7 red' },
  { id: 'neutral', label: 'Neutral', labelAr: '\u0645\u062d\u0627\u064a\u062f', hint: 'mix of both' },
  { id: 'warm',    label: 'Warm',    labelAr: '\u062f\u0627\u0641\u0626',   hint: 'yellow \u00b7 peach \u00b7 gold' },
] as const

export const COLOR_PALETTES = [
  { id: 'neutral', label: 'Neutral', labelAr: '\u0645\u062d\u0627\u064a\u062f', colors: ['#F5F5DC', '#D3D3D3', '#FFFFFF', '#8B7355'] },
  { id: 'dark', label: 'Dark', labelAr: '\u062f\u0627\u0643\u0646', colors: ['#1A1A1A', '#2F4F4F', '#000080', '#363636'] },
  { id: 'pastel', label: 'Pastel', labelAr: '\u0628\u0627\u0633\u062a\u064a\u0644', colors: ['#FFB6C1', '#ADD8E6', '#E6E6FA', '#FFE4E1'] },
  { id: 'colorful', label: 'Vibrant', labelAr: '\u0632\u0627\u0647\u064a', colors: ['#FF4500', '#32CD32', '#FFD700', '#4169E1'] },
] as const

export const OCCASION_STYLES = [
  { id: 'Business Casual', label: 'Business Casual', labelAr: '\u0643\u0627\u062c\u0648\u0627\u0644 \u0623\u0639\u0645\u0627\u0644' },
  { id: 'Smart Casual', label: 'Smart Casual', labelAr: '\u0643\u0627\u062c\u0648\u0627\u0644 \u0623\u0646\u064a\u0642' },
  { id: 'Traditional', label: 'Traditional / Wedding', labelAr: '\u062a\u0642\u0644\u064a\u062f\u064a / \u0623\u0639\u0631\u0627\u0633' },
  { id: 'Formal', label: 'Formal / Black Tie', labelAr: '\u0631\u0633\u0645\u064a / \u0628\u0644\u0627\u0643 \u062a\u0627\u064a' },
  { id: 'Streetwear', label: 'Streetwear Luxury', labelAr: '\u0633\u062a\u0631\u064a\u062a\u0648\u064a\u0631 \u0641\u0627\u062e\u0631' },
] as const
