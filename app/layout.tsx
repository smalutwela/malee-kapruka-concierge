import type { Metadata } from "next";
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

const SITE_URL = "https://kapruka-ai-agent-claude.vercel.app";
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
