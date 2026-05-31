'use client'

import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'

const SECTIONS = [
  {
    heading: { en: '1. Information We Collect', ar: '١. المعلومات التي نجمعها' },
    body: {
      en: `When you create an account we collect your name, username, and email address. When you use the styling features we collect the style preferences you provide (gender, body shape, skin tone, height), clothing photos you upload to your wardrobe, outfit descriptions and search queries you enter, and the outfits we generate and save for you.`,
      ar: `عند إنشاء حساب، نجمع اسمك واسم المستخدم وعنوان بريدك الإلكتروني. عند استخدام ميزات التصميم، نجمع تفضيلات الأسلوب التي تقدمها (الجنس، شكل الجسم، لون البشرة، الطول)، وصور الملابس التي ترفعها إلى خزانتك، وأوصاف الملابس واستفسارات البحث، والأزياء التي نولّدها ونحفظها لك.`,
    },
  },
  {
    heading: { en: '2. How We Use Your Information', ar: '٢. كيف نستخدم معلوماتك' },
    body: {
      en: `We use your information solely to provide Elephante's services: personalising outfit suggestions to your body and style preferences, enabling your wardrobe archive, and improving the quality of our AI recommendations. We do not sell your personal information to third parties. We do not use your data to train external AI models.`,
      ar: `نستخدم معلوماتك حصرًا لتقديم خدمات Elephante: تخصيص اقتراحات الأزياء وفق جسمك وتفضيلاتك، وتمكين أرشيف خزانتك، وتحسين توصيات الذكاء الاصطناعي لدينا. لا نبيع معلوماتك الشخصية لأطراف ثالثة. لا نستخدم بياناتك لتدريب نماذج ذكاء اصطناعي خارجية.`,
    },
  },
  {
    heading: { en: '3. Third-Party Services', ar: '٣. الخدمات الخارجية' },
    body: {
      en: `Elephante relies on the following services to operate:\n\n• Supabase — database, authentication, and storage of your wardrobe photos (hosted in the EU)\n• OpenAI / Anthropic / Google — AI models that process your outfit queries and generate styling responses; queries are not stored by these providers beyond their standard processing window\n• Vercel — hosting and serverless infrastructure\n• FAL.ai — AI image generation for outfit visuals\n\nEach provider operates under its own privacy policy.`,
      ar: `يعتمد Elephante على الخدمات التالية:\n\n• Supabase — قاعدة البيانات والمصادقة وتخزين صور خزانتك (مستضافة في الاتحاد الأوروبي)\n• OpenAI / Anthropic / Google — نماذج ذكاء اصطناعي تعالج استفساراتك وتولّد ردود التصميم؛ لا يتم تخزين الاستفسارات من قِبل هذه الجهات بعد نافذة المعالجة القياسية\n• Vercel — الاستضافة والبنية التحتية\n• FAL.ai — توليد صور الأزياء بالذكاء الاصطناعي\n\nتعمل كل جهة وفق سياسة الخصوصية الخاصة بها.`,
    },
  },
  {
    heading: { en: '4. Clothing Photos', ar: '٤. صور الملابس' },
    body: {
      en: `Photos you upload to your wardrobe are stored in a private, user-scoped storage bucket. They are accessible only to you and to the AI models analysing them on your behalf. They are not shared with other users or used for any purpose other than powering your personal wardrobe archive.`,
      ar: `الصور التي ترفعها إلى خزانتك مخزّنة في حاوية تخزين خاصة مرتبطة بحسابك. لا يمكن الوصول إليها إلا لك وللنماذج التي تحلّلها بالنيابة عنك. لا تُشارك مع مستخدمين آخرين ولا تُستخدم لأي غرض غير تشغيل أرشيفك الشخصي.`,
    },
  },
  {
    heading: { en: '5. Data Retention', ar: '٥. الاحتفاظ بالبيانات' },
    body: {
      en: `We retain your account data and wardrobe content for as long as your account is active. If you delete your account, your profile, uploaded photos, and saved outfits are permanently deleted within 30 days. Anonymised usage data (e.g. aggregate feature usage counts) may be retained for analytics purposes.`,
      ar: `نحتفظ ببيانات حسابك ومحتوى خزانتك طالما حسابك نشط. إذا حذفت حسابك، فسيتم حذف ملفك الشخصي وصورك المرفوعة وأزياؤك المحفوظة نهائيًا خلال 30 يومًا. قد يتم الاحتفاظ بالبيانات المجهولة المصدر (مثل إجمالي استخدام الميزات) لأغراض تحليلية.`,
    },
  },
  {
    heading: { en: '6. Your Rights', ar: '٦. حقوقك' },
    body: {
      en: `You can access, export, or delete your data at any time by contacting us at the address below. If you are in the European Economic Area, you have the right to data portability, the right to erasure ("right to be forgotten"), and the right to lodge a complaint with your local data protection authority.`,
      ar: `يمكنك الوصول إلى بياناتك أو تصديرها أو حذفها في أي وقت عن طريق التواصل معنا على العنوان أدناه. إذا كنت في المنطقة الاقتصادية الأوروبية، يحق لك الوصول إلى بياناتك ونقلها وطلب حذفها، وتقديم شكوى إلى هيئة حماية البيانات المحلية.`,
    },
  },
  {
    heading: { en: '7. Cookies', ar: '٧. ملفات تعريف الارتباط' },
    body: {
      en: `Elephante uses cookies only for authentication purposes (to keep you logged in). We do not use advertising cookies or third-party tracking cookies.`,
      ar: `يستخدم Elephante ملفات تعريف الارتباط لأغراض المصادقة فحسب (للحفاظ على تسجيل دخولك). لا نستخدم ملفات تعريف الارتباط الإعلانية أو تتبّع الأطراف الثالثة.`,
    },
  },
  {
    heading: { en: '8. Changes to This Policy', ar: '٨. التغييرات على هذه السياسة' },
    body: {
      en: `We may update this policy from time to time. If we make material changes, we will notify you by email or via a notice in the app. The date at the bottom of this page reflects when the policy was last updated.`,
      ar: `قد نُحدّث هذه السياسة من وقت لآخر. في حال إجراء تغييرات جوهرية، سنخطرك عبر البريد الإلكتروني أو إشعار داخل التطبيق. يعكس التاريخ في أسفل هذه الصفحة آخر تحديث للسياسة.`,
    },
  },
  {
    heading: { en: '9. Contact', ar: '٩. التواصل' },
    body: {
      en: `Questions about this policy or requests regarding your data:\n\nelephante.app — privacy@elephante.app`,
      ar: `للاستفسارات حول هذه السياسة أو الطلبات المتعلقة ببياناتك:\n\nelephante.app — privacy@elephante.app`,
    },
  },
]

export default function PrivacyPage() {
  const { isAr } = useLocale()

  return (
    <main
      className="min-h-screen bg-black text-white"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="max-w-2xl mx-auto px-6 py-16 sm:py-24">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-zinc-600 hover:text-white text-xs tracking-widest uppercase transition-colors mb-12"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
            <path d={isAr ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isAr ? 'الرئيسية' : 'Home'}
        </Link>

        {/* Header */}
        <div className="mb-12 border-b border-zinc-900 pb-10">
          <p className="text-[10px] tracking-[0.4em] uppercase text-zinc-600 mb-4">
            Elephante
          </p>
          <h1 className="text-2xl sm:text-3xl font-thin tracking-widest uppercase text-zinc-100 mb-4">
            {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
          </h1>
          <p className="text-zinc-600 text-xs tracking-wide">
            {isAr ? 'آخر تحديث: مايو 2026' : 'Last updated: May 2026'}
          </p>
        </div>

        {/* Intro */}
        <p className="text-zinc-400 text-sm leading-loose mb-12">
          {isAr
            ? 'يوضح هذا المستند كيفية جمع Elephante لمعلوماتك واستخدامها وحمايتها. نأخذ خصوصيتك بجدية تامة — نجمع فقط ما نحتاجه لتشغيل الخدمة، ولا نبيع بياناتك لأي طرف.'
            : 'This document explains how Elephante collects, uses, and protects your information. We take your privacy seriously — we collect only what is needed to run the service and we do not sell your data to anyone.'}
        </p>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.heading.en} className="border-t border-zinc-900 pt-8">
              <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-300 mb-4">
                {isAr ? section.heading.ar : section.heading.en}
              </h2>
              <p
                className="text-zinc-500 text-sm leading-loose whitespace-pre-line"
                style={{ fontFamily: isAr ? "'Noto Naskh Arabic', serif" : 'inherit' }}
              >
                {isAr ? section.body.ar : section.body.en}
              </p>
            </section>
          ))}
        </div>

        {/* Footer line */}
        <div className="mt-16 pt-10 border-t border-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-zinc-700 text-[11px] tracking-wide">
            © {new Date().getFullYear()} Elephante. {isAr ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </p>
          <Link href="/" className="text-zinc-700 hover:text-zinc-400 text-[11px] tracking-widest uppercase transition-colors">
            {isAr ? 'العودة إلى التطبيق' : 'Back to App'}
          </Link>
        </div>

      </div>
    </main>
  )
}
