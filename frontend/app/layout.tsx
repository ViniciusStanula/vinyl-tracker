import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="pt-BR" className={geist.variable}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
