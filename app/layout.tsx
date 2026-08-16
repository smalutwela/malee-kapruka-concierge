import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";
import { LocaleProvider } from "@/lib/i18n/context";

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://malee-kapruka-agent.vercel.app";
const DESCRIPTION =
  "Ayubowan! Malee is your warm AI shopping concierge for everything Kapruka sells — groceries, electronics, home, fashion, beauty, and the perfect gift to send, delivered anywhere in Sri Lanka. Powered by the live Kapruka catalogue.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Malee · Kapruka Shopping Concierge",
  description: DESCRIPTION,
  openGraph: {
    title: "Malee · Kapruka Shopping Concierge",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Malee",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Malee · Kapruka Shopping Concierge",
    description: DESCRIPTION,
  },
};

/**
 * Malee is used on a phone far more than on a desktop, so the viewport is
 * configured for one:
 *  - `viewportFit: "cover"` lets the layout paint under the notch/home
 *    indicator, and hands us the `env(safe-area-inset-*)` values that the
 *    `.safe-bottom` utility spends on the composer and sheet footers.
 *  - `interactiveWidget: "resizes-content"` makes the on-screen keyboard shrink
 *    the viewport instead of sliding it up, so `h-dvh` keeps the composer
 *    docked above the keyboard rather than pushing the header off-screen.
 *  - No `maximumScale`/`userScalable` limits: pinch-zoom stays available, which
 *    is both an accessibility requirement and the honest fix for small text.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Applies the saved theme to <html> before paint, avoiding a flash of the default theme.
const themeScript = `(function(){try{var t=localStorage.getItem('malee-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Read the saved locale on the server so the HTML ships in the right language
  // (correct `lang`, no flash). Theme stays client-only (localStorage + script).
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-locale={locale}
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
