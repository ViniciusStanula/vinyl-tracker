import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
      <head>
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KHJQ7PHC');`,
          }}
        />
      </head>
      <body className="min-h-screen bg-record text-cream antialiased">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KHJQ7PHC"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
