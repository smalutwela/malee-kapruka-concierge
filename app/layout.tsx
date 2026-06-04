import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
  "Ayubowan! Malee is your warm AI concierge for finding and sending the perfect gift anywhere in Sri Lanka — flowers, cakes, chocolates and more, delivered. Powered by the live Kapruka catalogue.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Malee · Kapruka Gift Concierge",
  description: DESCRIPTION,
  openGraph: {
    title: "Malee · Kapruka Gift Concierge",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Malee",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Malee · Kapruka Gift Concierge",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
