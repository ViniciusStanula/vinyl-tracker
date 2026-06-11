import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { SITE_URL } from "@/lib/siteUrl";
import Footer from "@/components/Footer";
import NavigationProgress from "@/components/NavigationProgress";

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

const DEFAULT_TITLE = "Garimpa Vinil — Histórico de Preços de Discos de Vinil";
const DEFAULT_DESC  =
  "Acompanhe o preço de discos de vinil na Amazon Brasil. Histórico de 12 meses, alertas de queda e o melhor momento de comprar cada disco.";

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
    images: ["/og-default.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    images: ["/og-default.png"],
  },
};

const organizationJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Garimpa Vinil",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/og-default.png`,
  },
  description: "Rastreador de preços de discos de vinil na Amazon Brasil. Monitora mais de 11.000 títulos com alertas de promoções e histórico de preços.",
  foundingDate: "2026",
  founder: {
    "@type": "Person",
    "@id": `${SITE_URL}/sobre#person`,
    name: "Vinicius Stanula",
    url: `${SITE_URL}/sobre`,
    sameAs: ["https://linkedin.com/in/vinicius-stanula"],
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://t.me/garimpavinil",
  },
  sameAs: ["https://t.me/garimpavinil"],
}).replace(/<\//g, "<\\/");

const webSiteJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Garimpa Vinil",
  url: SITE_URL,
  inLanguage: "pt-BR",
  description: DEFAULT_DESC,
  publisher: { "@id": `${SITE_URL}/#organization` },
}).replace(/<\//g, "<\\/");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${dmSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://m.media-amazon.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://images-na.ssl-images-amazon.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://image-cdn-ak.spotifycdn.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://image-cdn-fa.spotifycdn.com" crossOrigin="anonymous" />
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
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webSiteJsonLd }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-gold focus:text-record focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:text-sm"
        >
          Ir para conteúdo principal
        </a>
        <NavigationProgress />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
