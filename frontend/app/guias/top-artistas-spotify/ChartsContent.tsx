import type { JSX } from "react";

export interface Artist {
  rank: number;
  name: string;
  chart_streams: number;
  monthly_listeners: number;
  spotify_url: string;
  image_url: string;
  spotify_id: string;
}

export interface CountryData {
  country_name: string;
  artists: Artist[];
}

export interface ChartsData {
  last_updated: string | null;
  countries: Record<string, CountryData>;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toString();
}

function ArtistCard({ artist, isPriority = false }: { artist: Artist; isPriority?: boolean }): JSX.Element {
  return (
    <a
      href={artist.spotify_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 bg-label border border-groove rounded-xl p-3 hover:border-patina active:border-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-record"
    >
      <span className="text-parchment text-xs font-bold w-5 text-right shrink-0 tabular-nums">
        #{artist.rank}
      </span>

      {artist.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artist.image_url}
          alt={artist.name}
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : "auto"}
          decoding={isPriority ? "sync" : "async"}
          width={48}
          height={48}
          className="w-12 h-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-groove shrink-0" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-cream text-sm font-semibold truncate group-hover:text-gold transition-colors">
          {artist.name}
        </p>
        <p className="text-parchment text-xs truncate opacity-80">
          {fmtNum(artist.chart_streams)} streams/dia
        </p>
      </div>

      <svg
        className="w-4 h-4 text-[#1db954] shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    </a>
  );
}

function GlobalTable({
  countries,
}: {
  countries: Record<string, CountryData>;
}): JSX.Element | null {
  const counts: Record<
    string,
    { name: string; image: string; url: string; n: number }
  > = {};
  for (const cd of Object.values(countries)) {
    for (const a of cd.artists) {
      const sid = a.spotify_id;
      if (!counts[sid]) {
        counts[sid] = { name: a.name, image: a.image_url, url: a.spotify_url, n: 0 };
      }
      counts[sid].n += 1;
    }
  }
  const ranked = Object.values(counts)
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);

  if (ranked.length === 0) return null;

  return (
    <section className="mb-10" aria-labelledby="global-table-heading">
      <h2 id="global-table-heading" className="font-display text-xl font-bold text-cream mb-1">
        Artistas mais globais
      </h2>
      <p className="text-dust text-sm mb-4">
        Presença simultânea no top&nbsp;10 de mais países hoje.
      </p>
      <div className="overflow-x-auto rounded-xl border border-groove">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-groove">
              <th className="text-left px-4 py-3 text-dust font-semibold w-8">#</th>
              <th className="px-3 py-3 w-10" aria-label="Foto" />
              <th className="text-left px-3 py-3 text-dust font-semibold">Artista</th>
              <th className="text-right px-4 py-3 text-dust font-semibold whitespace-nowrap">
                Países no top&nbsp;10
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((a, i) => (
              <tr
                key={a.url}
                className="border-b border-groove last:border-0 hover:bg-sleeve transition-colors"
              >
                <td className="px-4 py-3 text-parchment opacity-70 tabular-nums">{i + 1}</td>
                <td className="px-3 py-3">
                  {a.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image}
                      alt={a.name}
                      loading="lazy"
                      decoding="async"
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-groove" aria-hidden="true" />
                  )}
                </td>
                <td className="px-3 py-3">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cream hover:text-gold transition-colors font-medium"
                  >
                    {a.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-gold font-bold">{a.n}</span>
                  <span className="text-dust ml-1">
                    {a.n === 1 ? "país" : "países"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CountryJumpNav({
  entries,
}: {
  entries: [string, CountryData][];
}): JSX.Element {
  return (
    <nav
      id="country-nav"
      aria-label="Navegar para o ranking de um país"
      className="mb-8 scroll-mt-4"
    >
      <p className="text-dust text-xs font-semibold uppercase tracking-wide mb-3">
        Ir para o país
      </p>
      <div className="flex flex-wrap gap-2">
        {entries.map(([code, cd]) => (
          <a
            key={code}
            href={`#pais-${code}`}
            className="text-xs bg-sleeve border border-groove text-parchment hover:text-gold hover:border-patina rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {cd.country_name}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function ChartsContent({ data }: { data: ChartsData | null }) {
  const countryEntries = Object.entries(data?.countries ?? {});

  if (countryEntries.length === 0) {
    return (
      <div className="bg-sleeve border border-groove rounded-xl p-8 text-center">
        <p className="text-parchment text-sm">
          Ranking ainda não disponível — os dados são atualizados uma vez por dia.
          Volte em breve.
        </p>
      </div>
    );
  }

  return (
    <>
      <GlobalTable countries={data?.countries ?? {}} />

      <CountryJumpNav entries={countryEntries} />

      {countryEntries.map(([code, cd], sectionIndex) => (
        <section
          key={code}
          id={`pais-${code}`}
          aria-labelledby={`heading-pais-${code}`}
          className="mb-12 scroll-mt-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              id={`heading-pais-${code}`}
              className="font-display text-xl font-bold text-gold"
            >
              {cd.country_name}
            </h2>
            <a
              href="#country-nav"
              className="text-xs text-dust hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded"
              aria-label="Voltar para lista de países"
            >
              ↑ ver todos os países
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cd.artists.map((artist) => (
              <ArtistCard
                key={artist.spotify_id}
                artist={artist}
                isPriority={sectionIndex === 0 && artist.rank === 1}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
