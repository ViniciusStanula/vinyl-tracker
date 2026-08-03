import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { HubHeader, SectionRule, formatDiscos } from "@/components/hub/HubUI";
import ArtistasFilter from "@/components/hub/ArtistasFilter";
import { getArtistaLetterCounts, getArtistasByLetter } from "@/lib/db/artista";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

export const revalidate = 14400;

/** Must match the folding in components/hub/ArtistasFilter.tsx. */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

/** "outros" in the URL rather than "#", which is a fragment and never reaches
 *  the server. */
function paramToLetter(param: string): string | null {
  const p = decodeURIComponent(param).toUpperCase();
  if (p === "OUTROS") return "#";
  return /^[A-Z]$/.test(p) ? p : null;
}

function letterToParam(letra: string): string {
  return letra === "#" ? "outros" : letra.toLowerCase();
}

export function generateStaticParams() {
  return LETTERS.map((l) => ({ letra: letterToParam(l) }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ letra: string }> },
): Promise<Metadata> {
  const { letra: param } = await params;
  const letra = paramToLetter(param);
  if (!letra) return {};
  const nome = letra === "#" ? "outros caracteres" : `letra ${letra}`;
  const title = `Artistas de Vinil — ${letra === "#" ? "Outros" : letra} | Garimpa Vinil`;
  return {
    title,
    description: `Artistas com ${nome} e discos de vinil disponíveis na Amazon Brasil, com histórico de preços de 12 meses.`,
    alternates: { canonical: `/artistas/${letterToParam(letra)}` },
    openGraph: { title, url: `/artistas/${letterToParam(letra)}`, type: "website" },
  };
}

export default async function ArtistasLetraPage(
  { params }: { params: Promise<{ letra: string }> },
) {
  const { letra: param } = await params;
  const letra = paramToLetter(param);
  if (!letra) notFound();

  let artistas: Awaited<ReturnType<typeof getArtistasByLetter>> = [];
  let counts: Awaited<ReturnType<typeof getArtistaLetterCounts>> = [];
  try {
    [artistas, counts] = await Promise.all([
      getArtistasByLetter(letra),
      getArtistaLetterCounts(),
    ]);
  } catch {
    // DB unavailable — render the shell rather than a 500.
  }
  if (artistas.length === 0) notFound();

  const available = new Set(counts.map((c) => c.letra));
  const rotulo = letra === "#" ? "Outros" : letra;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Artistas", item: `${SITE_URL}/artistas` },
      { "@type": "ListItem", position: 3, name: rotulo },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/artistas" className="hover:text-cream transition-colors">Artistas</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">{rotulo}</span>
      </nav>

      <HubHeader
        eyebrow="Catálogo A–Z"
        title={`Artistas — ${rotulo}`}
        description={`${artistas.length.toLocaleString("pt-BR")} ${
          artistas.length === 1 ? "artista" : "artistas"
        } com discos de vinil disponíveis na Amazon Brasil, com histórico de preços de 12 meses.`}
        aside={<ArtistasFilter total={artistas.length} />}
      />

      <SectionRule
        id="indice-heading"
        title="Índice completo"
        aside={
          <nav aria-label="Ir para letra" className="flex flex-wrap gap-1">
            {LETTERS.filter((l) => available.has(l)).map((l) => (
              <Link
                key={l}
                href={`/artistas/${letterToParam(l)}`}
                aria-current={l === letra ? "page" : undefined}
                className={`font-mono flex h-8 w-8 items-center justify-center rounded border text-[11px] font-medium transition-colors ${
                  l === letra
                    ? "border-gold bg-groove/40 text-cream"
                    : "border-groove text-parchment hover:border-gold hover:text-cream"
                }`}
              >
                {l}
              </Link>
            ))}
          </nav>
        }
      />

      <div data-letra-section>
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {artistas.map((item) => (
            /* data-nome is the folded name the CSS filter matches on. */
            <li key={item.slug} data-artista-item data-nome={fold(item.artista)}>
              <Link href={`/artista/${item.slug}`} className="ax-card">
                <span className="ax-card__name">{item.artista}</span>
                <span className="ax-card__count">{formatDiscos(item.discoCount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
