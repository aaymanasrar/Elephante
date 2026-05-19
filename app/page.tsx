'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import Noise from '@/components/Noise'
import Particles from '@/components/Particles'
import { useLocale } from '@/lib/locale-context'
import LanguageToggle from '@/app/components/LanguageToggle'
import { supabase } from '@/lib/supabase'
import { readLastFeedUrl } from '@/hooks/useFeedStatePersistence'

const T = {
  en: {
    welcome: 'Welcome to',
    tagline: 'Your intelligent wardrobe archive. Curate, search, and elevate your personal style.',
    enter: 'Enter',
    createAccount: 'Create Account',
    featuresTitle: 'What Elephante does',
    features: [
      {
        title: 'AI Outfit Generator',
        description: 'Describe an occasion. Get a complete, tailored outfit.',
      },
      {
        title: 'Wardrobe Archive',
        description: 'Upload photos. Every piece you own, catalogued.',
      },
      {
        title: 'Style Analysis',
        description: 'AI rates your outfits on colour, silhouette, and fit.',
      },
      {
        title: 'Occasion Styling',
        description: 'Office, wedding, travel, date night — styled instantly.',
      },
      {
        title: 'AI Stylist',
        description: 'Curated looks by vibe and season, on demand.',
      },
      {
        title: 'Smart Search',
        description: 'Ask in plain English or Arabic. Find what you need.',
      },
    ],
    testimonialsTitle: 'What our users say',
    testimonials: [
      {
        name: 'Khalid A.',
        location: 'Dubai',
        quote: 'I used to spend 20 minutes choosing what to wear. Now Elephante does it in seconds.',
      },
      {
        name: 'Sara M.',
        location: 'Riyadh',
        quote: 'Finally an app that understands modest fashion AND looks incredible.',
      },
      {
        name: 'James R.',
        location: 'London',
        quote: 'The AI knows my style better than I do after one week.',
      },
    ],
    ctaHeading: 'Your wardrobe. Elevated by AI.',
    ctaSubtext: 'Join thousands styling smarter.',
    ctaGetStarted: 'Get Started',
    ctaSignIn: 'Sign In',
  },
  ar: {
    welcome: 'مرحباً بك في',
    tagline: 'أرشيف خزانة ذكي يساعدك على تنسيق، والبحث، والارتقاء بأسلوبك الشخصي.',
    enter: 'دخول',
    createAccount: 'إنشاء حساب',
    featuresTitle: 'ما يفعله Elephante',
    features: [
      {
        title: 'مولّد الأزياء',
        description: 'صِف مناسبة. واحصل على إطلالة كاملة ومصمَّمة لك.',
      },
      {
        title: 'أرشيف الخزانة',
        description: 'ارفع الصور. كل قطعة تمتلكها، مُفهرسة.',
      },
      {
        title: 'تحليل الأسلوب',
        description: 'يُقيِّم الذكاء الاصطناعي إطلالتك من حيث اللون والشكل والملاءمة.',
      },
      {
        title: 'تنسيق المناسبات',
        description: 'المكتب، حفلات الزفاف، السفر، سهرة رومانسية — تنسيق فوري.',
      },
      {
        title: 'المنسّق الذكي',
        description: 'إطلالات منسَّقة حسب الأجواء والموسم، عند الطلب.',
      },
      {
        title: 'بحث ذكي',
        description: 'اسأل بالعربية أو الإنجليزية. ابحث عمّا تحتاج.',
      },
    ],
    testimonialsTitle: 'ماذا يقول مستخدمونا',
    testimonials: [
      {
        name: 'خالد أ.',
        location: 'دبي',
        quote: 'كنت أقضي 20 دقيقة في اختيار ما أرتديه. الآن Elephante يفعل ذلك في ثوانٍ.',
      },
      {
        name: 'سارة م.',
        location: 'الرياض',
        quote: 'أخيراً تطبيق يفهم الأزياء المحتشمة ويبدو رائعاً في آنٍ واحد.',
      },
      {
        name: 'جيمس ر.',
        location: 'لندن',
        quote: 'يعرف الذكاء الاصطناعي أسلوبي أفضل مني بعد أسبوع واحد.',
      },
    ],
    ctaHeading: 'خزانتك. مُرتقاة بالذكاء الاصطناعي.',
    ctaSubtext: 'انضم إلى آلاف يرتدون بذكاء.',
    ctaGetStarted: 'ابدأ الآن',
    ctaSignIn: 'تسجيل الدخول',
  },
}

const featureIcons = [
  // AI Outfit Generator — wand / sparkle
  <svg key="gen" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.091zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>,
  // Wardrobe Archive — archive / folder
  <svg key="archive" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>,
  // Style Analysis — chart / bar
  <svg key="analysis" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>,
  // Occasion Styling — calendar
  <svg key="occasion" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>,
  // AI Stylist — user / person with sparkle
  <svg key="stylist" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>,
  // Smart Search — magnifying glass
  <svg key="search" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
  </svg>,
]

export default function Home() {
  const router = useRouter()
  const { lang, isAr } = useLocale()
  const [stage, setStage] = useState(0)
  const [logoFaded, setLogoFaded] = useState(false)
  const [enterHover, setEnterHover] = useState(false)
  const [createHover, setCreateHover] = useState(false)
  const [ctaGetStartedHover, setCtaGetStartedHover] = useState(false)
  const [ctaSignInHover, setCtaSignInHover] = useState(false)
  const t = T[lang]

  useEffect(() => {
    let mounted = true

    const resumeSignedInUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted || !data.session) return

      router.replace(readLastFeedUrl() || '/feed')
    }

    resumeSignedInUser()

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    const logoTimer = setTimeout(() => setLogoFaded(true), 900)
    const titleTimer = setTimeout(() => setStage(1), 1400)
    const actionTimer = setTimeout(() => setStage(2), 2200)

    return () => {
      clearTimeout(logoTimer)
      clearTimeout(titleTimer)
      clearTimeout(actionTimer)
    }
  }, [])

  const arabicFont = { fontFamily: "'Noto Naskh Arabic', serif" }

  return (
    <div
      className="min-h-screen bg-black text-white overflow-y-auto selection:bg-zinc-800"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <main className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <LanguageToggle />
        <Noise patternAlpha={25} patternRefreshInterval={3} />
        <Particles
          particleCount={120}
          particleSpread={10}
          speed={0.08}
          particleColors={['#ffffff', '#ffffff', '#aaaaaa']}
          alphaParticles
          particleBaseSize={80}
          sizeRandomness={0.8}
          cameraDistance={20}
          moveParticlesOnHover
          particleHoverFactor={0.3}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <Logo
            size={180}
            decorative
            opacity={logoFaded ? 0.05 : 0.75}
            className="transition-opacity duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            priority
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
          <div
            className="absolute"
            style={{
              width: '520px',
              height: '520px',
              background: `
                radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.06) 0%, transparent 100%),
                radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.06) 0%, transparent 100%)
              `,
              transform: 'rotate(45deg)',
              animation: 'starPulse 5s ease-in-out infinite',
            }}
          />
          <div
            className="absolute"
            style={{
              width: '520px',
              height: '520px',
              background: `
                radial-gradient(ellipse 2px 260px at center, rgba(255,255,255,0.04) 0%, transparent 100%),
                radial-gradient(ellipse 260px 2px at center, rgba(255,255,255,0.04) 0%, transparent 100%)
              `,
              transform: 'rotate(22.5deg)',
              animation: 'starPulse 5s ease-in-out infinite 0.5s',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '280px',
              height: '280px',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%)',
              animation: 'starPulse 5s ease-in-out infinite',
              filter: 'blur(8px)',
            }}
          />
        </div>

        <div className="relative z-20 w-full max-w-2xl flex flex-col items-center justify-center px-6">
          <div
            className={`text-center flex flex-col items-center transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
            }`}
          >
            <h2
              className={`text-[10px] sm:text-xs font-bold text-zinc-600 mb-4 ${
                isAr ? '' : 'tracking-[0.5em] uppercase'
              }`}
              style={isAr ? arabicFont : undefined}
            >
              {t.welcome}
            </h2>
            <h1 className="text-4xl sm:text-6xl font-thin tracking-[0.4em] pl-[0.4em] uppercase mb-8 sm:mb-12 text-zinc-200">
              Elephante
            </h1>
          </div>

          <div
            className={`z-10 text-center w-full transition-all duration-[1500ms] ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col items-center ${
              stage === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
            }`}
          >
            <p
              className={`text-zinc-500 text-xs sm:text-sm font-light mx-auto mb-12 leading-loose max-w-md ${
                isAr ? '' : 'tracking-widest'
              }`}
              style={isAr ? arabicFont : undefined}
            >
              {t.tagline}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full max-w-sm">
              <Link
                href="/login"
                onMouseEnter={() => setEnterHover(true)}
                onMouseLeave={() => setEnterHover(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '14px 36px',
                  borderRadius: '100px',
                  background: enterHover ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)',
                  color: '#000',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                  boxShadow: enterHover
                    ? '0 0 40px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.4)'
                    : '0 4px 20px rgba(0,0,0,0.3)',
                  transform: enterHover ? 'scale(1.03)' : 'scale(1)',
                  fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
                }}
              >
                {t.enter}
              </Link>

              <Link
                href="/register"
                onMouseEnter={() => setCreateHover(true)}
                onMouseLeave={() => setCreateHover(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  padding: '14px 36px',
                  borderRadius: '100px',
                  background: 'transparent',
                  color: createHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  border: createHover ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                  boxShadow: createHover ? '0 0 24px rgba(255,255,255,0.08), inset 0 0 20px rgba(255,255,255,0.03)' : 'none',
                  transform: createHover ? 'scale(1.03)' : 'scale(1)',
                  fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
                }}
              >
                {t.createAccount}
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center transition-all duration-[1500ms] delay-300 ${
            stage === 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-600 to-transparent opacity-40" />
        </div>
      </main>

      {/* ── MARKETING CONTENT ────────────────────────────────────── */}
      <div
        className={`transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-500 ${
          stage === 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Divider */}
        <div className="w-full border-t border-zinc-900" />

        {/* ── Feature Grid ─────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24 sm:py-32">
          <h2
            className={`text-center text-[10px] sm:text-xs text-zinc-500 mb-16 ${
              isAr ? '' : 'tracking-[0.4em] uppercase'
            }`}
            style={isAr ? arabicFont : undefined}
          >
            {t.featuresTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.features.map((feature, i) => (
              <FeatureCard
                key={i}
                icon={featureIcons[i]}
                title={feature.title}
                description={feature.description}
                isAr={isAr}
              />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="w-full border-t border-zinc-900" />

        {/* ── Testimonials ─────────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 py-24 sm:py-32">
          <h2
            className={`text-center text-[10px] sm:text-xs text-zinc-500 mb-16 ${
              isAr ? '' : 'tracking-[0.4em] uppercase'
            }`}
            style={isAr ? arabicFont : undefined}
          >
            {t.testimonialsTitle}
          </h2>

          {/* Horizontal scroll on mobile, grid on desktop */}
          <div className="flex gap-4 overflow-x-auto pb-4 sm:pb-0 sm:grid sm:grid-cols-3 snap-x snap-mandatory sm:snap-none scrollbar-hide">
            {t.testimonials.map((testi, i) => (
              <TestimonialCard
                key={i}
                name={testi.name}
                location={testi.location}
                quote={testi.quote}
                isAr={isAr}
              />
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="w-full border-t border-zinc-900" />

        {/* ── Bottom CTA ───────────────────────────────────────── */}
        <section className="max-w-2xl mx-auto px-6 py-24 sm:py-32 flex flex-col items-center text-center">
          <h2
            className={`text-2xl sm:text-4xl font-thin text-white mb-5 leading-snug ${
              isAr ? '' : 'tracking-[0.15em]'
            }`}
            style={isAr ? arabicFont : undefined}
          >
            {t.ctaHeading}
          </h2>
          <p
            className={`text-zinc-500 text-xs sm:text-sm font-light mb-12 leading-loose ${
              isAr ? '' : 'tracking-widest'
            }`}
            style={isAr ? arabicFont : undefined}
          >
            {t.ctaSubtext}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full max-w-sm">
            <Link
              href="/register"
              onMouseEnter={() => setCtaGetStartedHover(true)}
              onMouseLeave={() => setCtaGetStartedHover(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '14px 36px',
                borderRadius: '100px',
                background: ctaGetStartedHover ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)',
                color: '#000',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: ctaGetStartedHover
                  ? '0 0 40px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.4)'
                  : '0 4px 20px rgba(0,0,0,0.3)',
                transform: ctaGetStartedHover ? 'scale(1.03)' : 'scale(1)',
                fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
              }}
            >
              {t.ctaGetStarted}
            </Link>

            <Link
              href="/login"
              onMouseEnter={() => setCtaSignInHover(true)}
              onMouseLeave={() => setCtaSignInHover(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '14px 36px',
                borderRadius: '100px',
                background: 'transparent',
                color: ctaSignInHover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                border: ctaSignInHover ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
                boxShadow: ctaSignInHover ? '0 0 24px rgba(255,255,255,0.08), inset 0 0 20px rgba(255,255,255,0.03)' : 'none',
                transform: ctaSignInHover ? 'scale(1.03)' : 'scale(1)',
                fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit',
              }}
            >
              {t.ctaSignIn}
            </Link>
          </div>
        </section>

        {/* Footer micro-text */}
        <div className="pb-12 text-center">
          <p className="text-zinc-800 text-[10px] tracking-widest uppercase">
            Elephante &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes starPulse {
          0%,
          100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.06);
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────────────── */

function FeatureCard({
  icon,
  title,
  description,
  isAr,
}: {
  icon: React.ReactNode
  title: string
  description: string
  isAr: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const arabicFont = { fontFamily: "'Noto Naskh Arabic', serif" }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgb(9,9,11)',
        border: hovered ? '1px solid rgb(63,63,70)' : '1px solid rgb(28,28,32)',
        borderRadius: '16px',
        padding: '28px 24px',
        transition: 'border-color 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        minWidth: '260px',
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.5)' }}>{icon}</div>
      <h3
        className="text-white text-sm font-light"
        style={isAr ? { ...arabicFont, letterSpacing: 0 } : { letterSpacing: '0.08em' }}
      >
        {title}
      </h3>
      <p
        className="text-zinc-500 text-xs leading-relaxed font-light"
        style={isAr ? arabicFont : { letterSpacing: '0.03em' }}
      >
        {description}
      </p>
    </div>
  )
}

function TestimonialCard({
  name,
  location,
  quote,
  isAr,
}: {
  name: string
  location: string
  quote: string
  isAr: boolean
}) {
  const arabicFont = { fontFamily: "'Noto Naskh Arabic', serif" }

  return (
    <div
      style={{
        background: 'rgb(9,9,11)',
        border: '1px solid rgb(28,28,32)',
        borderRadius: '16px',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minWidth: '280px',
        flex: '0 0 auto',
      }}
      className="sm:flex-1 snap-start"
    >
      <p
        className="text-zinc-400 text-xs leading-loose font-light italic"
        style={isAr ? arabicFont : { letterSpacing: '0.02em' }}
      >
        &ldquo;{quote}&rdquo;
      </p>
      <div>
        <p
          className="text-white text-xs font-light"
          style={isAr ? arabicFont : { letterSpacing: '0.08em' }}
        >
          {name}
        </p>
        <p
          className="text-zinc-600 text-[10px] mt-1"
          style={isAr ? arabicFont : { letterSpacing: '0.12em' }}
        >
          {location}
        </p>
      </div>
    </div>
  )
}
