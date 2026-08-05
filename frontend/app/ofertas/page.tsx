import { queryOfertasWithCache } from "@/lib/db/ofertas";
import OfertasView from "@/components/OfertasView";
import type { Metadata } from "next";

export const revalidate = 14400;

export async function generateMetadata(): Promise<Metadata> {
  let count = 0;
  try {
    count = (await queryOfertasWithCache()).length;
  } catch {
    // DB unavailable — fall back to generic description
  }
  const title = "Ofertas de Discos de Vinil | Garimpa Vinil";
  const description = count > 0
    ? `${count.toLocaleString("pt-BR")} discos de vinil em oferta na Amazon Brasil agora, separados por Melhor Preço, Ótima Oferta e Boa Oferta sobre a média histórica.`
    : "Discos de vinil em oferta na Amazon Brasil, separados por Melhor Preço, Ótima Oferta e Boa Oferta sobre a média histórica de preço.";
  return {
    title,
    description,
    alternates: {
      canonical: "/ofertas",
    },
    openGraph: {
      title,
      description,
      url: "/ofertas",
      type: "website",
      images: ["/og-default.png"],
    },
  };
}

// Page 1. The rest live at /ofertas/pagina/[n] — on the path rather than a
// `?page=` searchParam, which would opt this route out of static rendering.
export default async function OfertasPage() {
  return <OfertasView page={1} />;
}
