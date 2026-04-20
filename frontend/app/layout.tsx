import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

/* Fraunces — optical-size variable serif; editorial, distinctive */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

/* DM Sans — clean, humanist sans-serif for body copy */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

const DEFAULT_TITLE = "Garimpa Vinil — Melhores ofertas em discos de vinil";
const DEFAULT_DESC  =
  "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços e alertas de promoção.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESC,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Garimpa Vinil",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
  twitter: {
    card: "summary",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
  },
};

const organizationJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Garimpa Vinil",
  url: SITE_URL,
  description: "Rastreador de preços de discos de vinil na Amazon Brasil.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-record text-cream antialiased">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
