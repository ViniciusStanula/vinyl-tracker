import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BEST_OF_ARTISTS, getArtistProfile, getBestAlbums } from "@/lib/guias/best-of-artist-data";
import { ARTIST_INTRO } from "@/lib/guias/best-of-artist-content";

import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import { slugifyArtist } from "@/lib/utils/slugify";

function CoverLink({
  discoSlug,
  imgUrl,
  title,
}: {
  discoSlug: string | null;
  imgUrl: string | null;
  title: string;
}) {
  const cover = (
    <div className="aspect-square w-full sm:w-40 rounded-lg overflow-hidden bg-groove ring-1 ring-white/5">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={`Capa de ${title}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : null}
    </div>
  );
  if (!discoSlug) return <div className="block shrink-0">{cover}</div>;
  return (
    <Link href={`/disco/${discoSlug}`} className="block shrink-0">
      {cover}
    </Link>
  );
}

export function generateStaticParams() {
  return BEST_OF_ARTISTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artist = getArtistProfile(slug);
  if (!artist) return {};

  const title = `Os Melhores Discos ${artist.article} ${artist.name} | Garimpa Vinil`;
  const description = `Ranking dos melhores álbuns ${artist.article} ${artist.name} em vinil, com nota do MusicBrainz e popularidade no Last.fm, vídeo de cada disco e preço monitorado na Amazon Brasil.`;
  const albums = await getBestAlbums(slug);
  const ogImage = albums[0]?.imgUrl ?? null;

  return {
    title,
    description,
    alternates: { canonical: `/guias/melhores-discos/${slug}` },
    openGraph: {
      title,
      description,
      url: `/guias/melhores-discos/${slug}`,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 300, height: 300, alt: `Capa de ${albums[0]?.title}` }] : ["/og-default.png"],
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: [ogImage ?? "/og-default.png"],
    },
  };
}

export default async function BestOfArtistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artist = getArtistProfile(slug);
  if (!artist) notFound();

  const albums = await getBestAlbums(slug);
  if (albums.length === 0) notFound();

  const intro = ARTIST_INTRO[slug];

  const breadcrumb = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias` },
      { "@type": "ListItem", position: 3, name: `Melhores Discos ${artist.article} ${artist.name}`, item: `${SITE_URL}/guias/melhores-discos/${slug}` },
    ],
  });

  const itemList = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Melhores álbuns ${artist.article} ${artist.name}`,
    url: `${SITE_URL}/guias/melhores-discos/${slug}`,
    numberOfItems: albums.length,
    // Each entry as the album it ranks, not a bare string. The ranking already
    // holds the release year, the cover, the MusicBrainz id and — for the ones
    // this catalogue sells — the record page, and published none of it.
    itemListElement: albums.map((album, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "MusicAlbum",
        // The record page's album node where we have one, so a ranked entry
        // and the product it links to are the same entity.
        ...(album.discoSlug ? { "@id": `${SITE_URL}/disco/${album.discoSlug}#album` } : {}),
        name: album.title,
        byArtist: { "@type": "MusicGroup", name: artist.name },
        ...(album.discoSlug ? { url: `${SITE_URL}/disco/${album.discoSlug}` } : {}),
        ...(album.imgUrl ? { image: album.imgUrl } : {}),
        ...(album.year ? { datePublished: String(album.year) } : {}),
        ...(album.mbid ? { sameAs: `https://musicbrainz.org/release-group/${album.mbid}` } : {}),
      },
    })),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemList }} />

      <nav className="mb-6 text-sm text-dust flex gap-2 flex-wrap">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <Link href="/guias" className="hover:text-gold transition-colors">Guias</Link>
        <span>›</span>
        <span className="text-parchment">Melhores Discos {artist.article} {artist.name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight mb-3">
          Os melhores discos {artist.article}{" "}
          <span className="text-gold">{artist.name}</span>
        </h1>
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            `${albums.length} álbuns`,
            "nota via MusicBrainz",
            "popularidade via Last.fm",
          ].map((s) => (
            <span key={s} className="text-xs text-parchment bg-sleeve border border-groove rounded-full px-3 py-1">
              {s}
            </span>
          ))}
        </div>

        {intro ? (
          <div className="space-y-4">
            {intro.split("\n\n").map((p, i) => (
              <p key={i} className="text-parchment text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        ) : (
          <p className="text-parchment text-sm leading-relaxed">
            Ranking dos álbuns de estúdio {artist.article} {artist.name} disponíveis em vinil no nosso catálogo,
            usando uma média bayesiana da nota do MusicBrainz combinada com o número de ouvintes no
            Last.fm.
          </p>
        )}
      </header>

      {/* Ranked list — one section per album, blog-post style */}
      <ol className="space-y-14">
        {albums.map((album, i) => (
          <li key={album.mbid} className="scroll-mt-20" id={`n${i + 1}`}>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-display text-2xl font-black text-gold/80 tabular-nums">
                #{i + 1}
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-cream leading-tight">
                {album.title}
                {album.year && <span className="text-dust font-normal"> ({album.year})</span>}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-5">
              <CoverLink discoSlug={album.discoSlug} imgUrl={album.imgUrl} title={album.title} />

              <div className="space-y-3">
                {album.blurb && (
                  <p className="text-parchment text-sm leading-relaxed">{album.blurb}</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-dust">
                  {album.mbRating && (
                    <span>
                      <span className="text-gold/90 font-semibold">{album.mbRating.toFixed(2)}</span> MusicBrainz
                      {album.mbRatingVotes > 0 && ` (${album.mbRatingVotes} votos)`}
                    </span>
                  )}
                  {album.lastfmListeners > 0 && (
                    <span>{album.lastfmListeners.toLocaleString("pt-BR")} ouvintes no Last.fm</span>
                  )}
                  {album.discoSlug ? (
                    <Link href={`/disco/${album.discoSlug}`} className="text-gold hover:underline">
                      Ver preço em vinil →
                    </Link>
                  ) : (
                    <span className="text-dust/70 italic">Ainda não temos esse disco em vinil no catálogo</span>
                  )}
                </div>

                {album.videoId && (
                  <div className="aspect-video rounded-lg overflow-hidden border border-groove mt-2">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${album.videoId}`}
                      title={`${album.title} (${artist.name})`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <footer className="pt-8 mt-12 border-t border-groove flex flex-wrap gap-4">
        <Link href={`/artista/${slugifyArtist(artist.name)}`} className="text-sm text-dust hover:text-gold transition-colors">
          Ver todos os discos {artist.article} {artist.name} →
        </Link>
        <Link href="/guias" className="text-sm text-dust hover:text-gold transition-colors">
          Todos os guias
        </Link>
        <Link href="/disco" className="text-sm text-dust hover:text-gold transition-colors">
          Buscar esses discos com preço monitorado
        </Link>
        <Link href="/guias/como-avaliar-estado-disco-vinil" className="text-sm text-dust hover:text-gold transition-colors">
          Como avaliar o estado antes de comprar
        </Link>
      </footer>
    </div>
  );
}
