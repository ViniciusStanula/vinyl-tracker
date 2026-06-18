import Link from "next/link";
import { getArtistasList } from "@/lib/db/artista";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Artistas de Vinil — Catálogo Completo | Garimpa Vinil",
  description:
    "Navegue todos os artistas com discos de vinil disponíveis na Amazon Brasil. Clique em qualquer artista para ver o catálogo com histórico de preços.",
  alternates: { canonical: "/artistas" },
  openGraph: {
    title: "Artistas de Vinil — Catálogo Completo | Garimpa Vinil",
    description:
      "Navegue todos os artistas com discos de vinil disponíveis na Amazon Brasil.",
    url: "/artistas",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function ArtistasIndexPage() {
  let artistas: Awaited<ReturnType<typeof getArtistasList>> = [];
  try {
    artistas = await getArtistasList();
  } catch {
    // DB unavailable
  }

  // Group by first letter (non-letter names go under "#")
  const grouped = new Map<string, typeof artistas>();
  for (const item of artistas) {
    const first = item.artista.match(/^[A-Za-z]/)
      ? item.artista[0].toUpperCase()
      : "#";
    if (!grouped.has(first)) grouped.set(first, []);
    grouped.get(first)!.push(item);
  }
  const letters = Array.from(grouped.keys()).sort((a, b) =>
    a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)
  );

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Artistas", item: `${SITE_URL}/artistas` },
    ],
  });

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Artistas</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Artistas de Vinil
        </h1>
        <p className="mt-1 text-dust text-sm">
          {artistas.length > 0
            ? `${artistas.length.toLocaleString("pt-BR")} artistas com discos disponíveis na Amazon Brasil`
            : "Catálogo de artistas com discos de vinil na Amazon Brasil"}
        </p>
      </header>

      {/* Letter jump-nav */}
      {letters.length > 0 && (
        <nav aria-label="Navegar por letra" className="flex flex-wrap gap-1 mb-8">
          {letters.map((l) => (
            <a
              key={l}
              href={`#letra-${l}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 text-sm font-bold transition-colors"
            >
              {l}
            </a>
          ))}
        </nav>
      )}

      {artistas.length === 0 ? (
        <p className="text-dust text-sm">Nenhum artista disponível no momento.</p>
      ) : (
        <div className="space-y-10">
          {letters.map((letter) => {
            const group = grouped.get(letter)!;
            return (
              <section key={letter} id={`letra-${letter}`}>
                <h2 className="font-display text-2xl font-black text-gold mb-4 pb-2 border-b border-groove">
                  {letter}
                </h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {group.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/artista/${item.slug}`}
                        className="flex flex-col justify-between h-[72px] px-3 py-2.5 rounded-xl bg-sleeve border border-groove hover:border-wax/70 hover:bg-groove transition-colors"
                      >
                        <span className="text-parchment text-sm font-medium leading-tight line-clamp-2">
                          {item.artista}
                        </span>
                        <span className="text-dust text-xs tabular-nums mt-1">
                          {item.discoCount} {item.discoCount === 1 ? "disco" : "discos"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
