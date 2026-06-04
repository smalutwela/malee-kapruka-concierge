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

export const metadata: Metadata = {
  title: "Malee · Kapruka Gift Concierge",
  description:
    "Ayubowan! Malee is your warm AI concierge for finding and sending the perfect gift anywhere in Sri Lanka — flowers, cakes, chocolates and more, delivered. Powered by the live Kapruka catalogue.",
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
