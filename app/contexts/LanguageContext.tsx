'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

// ─── Full translation map ─────────────────────────────────────────────────────
export const translations = {
  en: {
    // Feed
    feed_title: 'Elephante AI',
    style_recommendations: 'Style Recommendations',
    curated_look: 'Curated Look',
    archive_results: 'Archive Results',

    // Closet
    closet: 'Closet',
    back: 'Back',
    style: 'Style',
    color: 'Color',
    no_saved: 'No saved outfits yet',
    no_saved_sub: 'Save outfits from the feed to see them here',
    looks: 'looks',
    look: 'look',
    filtered: 'filtered',
    sorted_aesthetic: 'sorted by your aesthetic',
    searching: 'Searching...',
    loading: 'Loading...',

    // Outfit detail
    archive: 'Archive',
    no_image: 'No Image',
    occasions: 'Occasions',
    when_to_wear: 'When to Wear',
    the_pieces: 'The Pieces',
    materials: 'Materials',
    details_notes: 'Details & Notes',
    save_closet: 'Save to Closet',
    remove_closet: 'Remove From Closet',
    processing: 'Processing...',
    could_not_load: 'Could not load outfit',

    // Profile
    saved_items: 'Saved Items',
    streak: 'Streak',
    my_style_goal: 'My Style Goal',
    personal_preferences: 'Personal Preferences',
    sign_out: 'Sign Out',

    // Preferences
    preferences: 'Preferences',
    cancel: 'Cancel',
    skin_tone: 'Skin Tone',
    height: 'Height',
    body_shape: 'Body Shape',
    aesthetics: 'Aesthetics',
    lifestyle: 'Lifestyle',
    style_goal: 'Style Goal',
    style_goal_sub: 'How do you want to present yourself?',
    style_goal_placeholder: 'E.g. I want to look professional but approachable...',
    save_preferences: 'Save Preferences',
    updating: 'Updating...',

    // Onboarding
    skin_tone_sub: 'Select closest match',
    aesthetic_sub: 'Select all that apply',
    lifestyle_sub: 'Select your style vibe',
    next: 'Next',
    finish: 'Finish',
    saving: 'Saving...',

    // Login
    tagline: 'Your personal stylist, curated for you.',
    touch_to_begin: 'touch to begin',
    email: 'Email Address',
    password: 'Password',
    enter: 'Enter',
    logging_in: 'Logging in...',
    no_account: "Don't have an account?",
    register: 'Register',

    // Register
    full_name: 'Full Name',
    username: 'Username',
    creating: 'Creating account...',
    username_taken: 'Username is already in use',
    username_available: 'Username is available',
    email_taken: 'Email is already in use',
    email_available: 'Email is available',
    have_account: 'Already have an account?',
    login: 'Log in',

    // Skin tones
    light: 'Light', medium: 'Medium', tan: 'Tan', deep: 'Deep',

    // Body
    short: 'Short', average: 'Average', tall: 'Tall',
    slim: 'Slim', athletic: 'Athletic', stocky: 'Stocky', heavy: 'Heavy',
    under_57: "Under 5'7\"", avg_height: "5'7\" – 6'0\"", over_60: "Over 6'0\"",
    lean: 'Lean build', toned: 'Toned', medium_build: 'Medium', solid: 'Solid', large: 'Large',

    // Palettes
    neutral: 'Neutral', dark: 'Dark / Moody', pastel: 'Soft / Pastel', vibrant: 'Vibrant',

    // Occasions
    business_casual: 'Business Casual', smart_casual: 'Smart Casual',
    traditional: 'Traditional / Wedding', formal: 'Formal / Black Tie',
    streetwear: 'Streetwear Luxury',
  },

  ar: {
    // Feed
    feed_title: 'Elephante AI',
    style_recommendations: 'توصيات الأناقة',
    curated_look: 'إطلالة مختارة',
    archive_results: 'نتائج الأرشيف',

    // Closet
    closet: 'الخزانة',
    back: 'رجوع',
    style: 'الأسلوب',
    color: 'اللون',
    no_saved: 'لا توجد ملابس محفوظة بعد',
    no_saved_sub: 'احفظ الإطلالات من الخلاصة لتراها هنا',
    looks: 'إطلالة',
    look: 'إطلالة',
    filtered: 'مُصفّاة',
    sorted_aesthetic: 'مرتبة حسب ذوقك',
    searching: 'جارٍ البحث...',
    loading: 'جارٍ التحميل...',

    // Outfit detail
    archive: 'الأرشيف',
    no_image: 'لا توجد صورة',
    occasions: 'المناسبات',
    when_to_wear: 'متى تلبسه',
    the_pieces: 'القطع',
    materials: 'المواد',
    details_notes: 'التفاصيل والملاحظات',
    save_closet: 'حفظ في الخزانة',
    remove_closet: 'إزالة من الخزانة',
    processing: 'جارٍ المعالجة...',
    could_not_load: 'تعذّر تحميل الإطلالة',

    // Profile
    saved_items: 'المحفوظات',
    streak: 'السلسلة',
    my_style_goal: 'هدفي في الأناقة',
    personal_preferences: 'التفضيلات الشخصية',
    sign_out: 'تسجيل الخروج',

    // Preferences
    preferences: 'التفضيلات',
    cancel: 'إلغاء',
    skin_tone: 'لون البشرة',
    height: 'الطول',
    body_shape: 'شكل الجسم',
    aesthetics: 'الذوق',
    lifestyle: 'نمط الحياة',
    style_goal: 'هدف الأناقة',
    style_goal_sub: 'كيف تريد أن تظهر؟',
    style_goal_placeholder: 'مثال: أريد أن أبدو محترفاً ومتقارباً...',
    save_preferences: 'حفظ التفضيلات',
    updating: 'جارٍ التحديث...',

    // Onboarding
    skin_tone_sub: 'اختر الأقرب لبشرتك',
    aesthetic_sub: 'اختر ما يناسبك',
    lifestyle_sub: 'اختر أسلوبك',
    next: 'التالي',
    finish: 'إنهاء',
    saving: 'جارٍ الحفظ...',

    // Login
    tagline: 'مُصمِّمك الشخصي، مُختار لك.',
    touch_to_begin: 'المس للبدء',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    enter: 'دخول',
    logging_in: 'جارٍ تسجيل الدخول...',
    no_account: 'ليس لديك حساب؟',
    register: 'سجّل',

    // Register
    full_name: 'الاسم الكامل',
    username: 'اسم المستخدم',
    creating: 'جارٍ إنشاء الحساب...',
    username_taken: 'اسم المستخدم مستخدم بالفعل',
    username_available: 'اسم المستخدم متاح',
    email_taken: 'البريد الإلكتروني مستخدم بالفعل',
    email_available: 'البريد الإلكتروني متاح',
    have_account: 'لديك حساب بالفعل؟',
    login: 'تسجيل الدخول',

    // Skin tones
    light: 'فاتح', medium: 'متوسط', tan: 'أسمر', deep: 'داكن',

    // Body
    short: 'قصير', average: 'متوسط', tall: 'طويل',
    slim: 'نحيف', athletic: 'رياضي', stocky: 'ممتلئ', heavy: 'ثقيل',
    under_57: 'أقل من 170 سم', avg_height: '170 – 183 سم', over_60: 'أكثر من 183 سم',
    lean: 'بنية نحيلة', toned: 'مشدود', medium_build: 'متوسط', solid: 'صلب', large: 'كبير',

    // Palettes
    neutral: 'محايد', dark: 'داكن وعميق', pastel: 'ناعم وباستيل', vibrant: 'زاهي',

    // Occasions
    business_casual: 'كاجوال أعمال', smart_casual: 'كاجوال أنيق',
    traditional: 'تقليدي / أعراس', formal: 'رسمي / بلاك تاي',
    streetwear: 'ستريتوير فاخر',
  },
} as const

export type Lang = 'en' | 'ar'
export type TranslationKey = keyof typeof translations.en

// ─── Context ──────────────────────────────────────────────────────────────────
interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
  isAr: boolean
  arabicFont: string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => translations.en[k] as string,
  isAr: false,
  arabicFont: 'inherit',
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    // Read from localStorage first, fall back to device language
    const stored = localStorage.getItem('elephante_lang') as Lang | null
    if (stored === 'en' || stored === 'ar') {
      setLangState(stored)
    } else {
      const locale = (navigator.language || 'en').toLowerCase()
      if (locale.startsWith('ar')) setLangState('ar')
    }
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('elephante_lang', l)
  }

  const t = (key: TranslationKey): string =>
    (translations[lang][key] ?? translations.en[key] ?? key) as string

  const isAr = lang === 'ar'
  const arabicFont = isAr ? "'Noto Naskh Arabic', serif" : 'inherit'

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isAr, arabicFont }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)