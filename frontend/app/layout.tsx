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

export const metadata: Metadata = {
  title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
  description:
    "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços e alertas de promoção.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-record text-cream antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
