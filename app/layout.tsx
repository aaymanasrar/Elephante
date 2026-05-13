import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant, Montserrat, Noto_Naskh_Arabic } from "next/font/google";
import { validateRequiredEnv } from "@/lib/env";
import { LocaleProvider } from "@/lib/locale-context";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Elephante",
  description: "Your personal stylist, curated for you.",
  icons: { icon: '/icon.png' },
  verification: { google: 'u_B22qryn0zzzC95c63zi3f1Bm_3ev84PF_sVFtiNac' },
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
    <html lang="en" dir="ltr">
      <head>
        <meta name="p:domain_verify" content="be2dd9b13a24155c719d9395e6c66ea4" />
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
        <LocaleProvider>
          {children}
        </LocaleProvider>
        <Analytics />
      </body>
    </html>
  );
}
