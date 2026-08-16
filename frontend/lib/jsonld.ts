/**
 * Serialize an object for a <script type="application/ld+json"> tag.
 * Escapes "</" so DB-driven content can never close the script tag (XSS).
 * Every JSON-LD emission must go through this helper — no raw JSON.stringify.
 */
export function toJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/<\//g, "<\\/");
}

/** Just enough of a listing row to describe it. Every listing page shapes its
 *  rows into ProcessedDisco, but the pages that only need a ListItem shouldn't
 *  have to import that whole type. */
type ListableDisco = {
  slug: string;
  titulo: string;
  tituloSeo: string | null;
  artista: string;
  imgUrl: string | null;
  precoAtual: number;
  disponivel?: boolean;
};

/**
 * itemListElement for a listing page's records.
 *
 * Every facet, hub and artist listing used to publish `{position, url, name}`
 * per row — the summary form, which states that a page exists at that URL and
 * nothing about what it sells. The cards on screen show cover art, artist and
 * the current price, so the markup was strictly poorer than the page.
 *
 * Each entry now carries the Product itself, sharing the @id the record page's
 * own Product node uses so the two are one entity rather than two. Price comes
 * from the same field the visible card renders, so the markup cannot claim a
 * price the page does not show.
 *
 * Offer.url is the record page, not the affiliate link: the offer is the one
 * this site describes, and the outbound URL carries an Associates tag that has
 * no business in structured data.
 */
export function discoListItems(
  items: ListableDisco[],
  siteUrl: string,
  // startPosition for the paginated listings, where positions continue across
  // pages so the list reads as one sequence instead of restarting at 1.
  { limit = 10, startPosition = 1 }: { limit?: number; startPosition?: number } = {},
) {
  return items.slice(0, limit).map((disco, i) => {
    const url = `${siteUrl}/disco/${disco.slug}`;
    return {
      "@type": "ListItem",
      position: startPosition + i,
      item: {
        "@type": "Product",
        "@id": url,
        name: disco.tituloSeo || disco.titulo,
        url,
        ...(disco.imgUrl ? { image: disco.imgUrl } : {}),
        brand: { "@type": "Brand", name: disco.artista },
        // Guarded: a listing row with no captured price yet would otherwise
        // publish "R$ 0,00", and a wrong price is worse than no offer.
        ...(disco.precoAtual > 0
          ? {
              offers: {
                "@type": "Offer",
                "@id": `${url}#offer`,
                url,
                priceCurrency: "BRL",
                price: disco.precoAtual.toFixed(2),
                availability:
                  disco.disponivel === false
                    ? "https://schema.org/OutOfStock"
                    : "https://schema.org/InStock",
              },
            }
          : {}),
      },
    };
  });
}
