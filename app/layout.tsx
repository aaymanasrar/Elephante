import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant, Montserrat, Noto_Naskh_Arabic } from "next/font/google";
import { validateRequiredEnv } from "@/lib/env";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

validateRequiredEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], "the app");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://elephante.app'),
  title: {
    default: "Elephante - AI Stylist",
    template: "%s - Elephante",
  },
  description: "Elephante is your personal AI fashion stylist. Catalog your wardrobe, get tailored outfit suggestions, and receive instant style analysis in English & Arabic.",
  keywords: [
    "AI stylist", "AI fashion stylist", "digital wardrobe", "wardrobe archive", 
    "outfit generator", "style analysis", "closet digitizer", "personal stylist",
    "modest fashion AI", "Arabic AI stylist", "Arabic fashion app"
  ],
  authors: [{ name: "Elephante Team" }],
  creator: "Elephante",
  publisher: "Elephante",
  icons: { icon: '/icon.png' },
  verification: { 
    google: 'u_B22qryn0zzzC95c63zi3f1Bm_3ev84PF_sVFtiNac' 
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_AE", "ar_SA"],
    url: "https://elephante.app",
    siteName: "Elephante",
    title: "Elephante - AI Stylist",
    description: "Catalog your wardrobe, get tailored outfit suggestions, and receive instant style analysis in English & Arabic with Elephante, your AI fashion stylist.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Elephante - AI Stylist",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Elephante - AI Stylist",
    description: "Catalog your wardrobe, get tailored outfit suggestions, and receive instant style analysis in English & Arabic with Elephante, your AI fashion stylist.",
    images: ["/og-image.png"],
    creator: "@elephante_app",
  },
  alternates: {
    canonical: "https://elephante.app",
    languages: {
      "en-US": "https://elephante.app",
      "ar": "https://elephante.app",
    }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <meta name="p:domain_verify" content="be2dd9b13a24155c719d9395e6c66ea4" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){
try{
var k='elephante_theme_preference';
var p=localStorage.getItem(k)||'system';
if(p!=='dark'&&p!=='light'&&p!=='system')p='system';
var r=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;
document.documentElement.dataset.themePreference=p;
document.documentElement.dataset.theme=r;
document.documentElement.style.colorScheme=r;
}catch(e){
document.documentElement.dataset.theme='dark';
document.documentElement.dataset.themePreference='system';
}
})()`.replace(/\n/g,'') }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){
var o=AbortController.prototype.abort;
AbortController.prototype.abort=function(r){o.call(this,r!==undefined?r:new DOMException('The operation was aborted.','AbortError'))};
window.addEventListener('unhandledrejection',function(e){
  var r=e.reason;
  if(r&&(r.name==='AbortError'||r.name==='TimeoutError'))e.preventDefault();
});
var ce=console.error.bind(console);
console.error=function(){
  var a=arguments[0];
  if(typeof a==='string'&&(a.includes('AbortError')||a.includes('aborted')||a.includes('The operation was aborted')))return;
  if(a&&a.name==='AbortError')return;
  ce.apply(console,arguments);
};
})()`.replace(/\n/g,'') }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${montserrat.variable} ${notoNaskhArabic.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Elephante",
              "url": "https://elephante.app",
              "description": "AI fashion personal stylist and digital wardrobe archive in English & Arabic.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://elephante.app/feed?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
        <ThemeProvider>
          <LocaleProvider>
            {children}
          </LocaleProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
