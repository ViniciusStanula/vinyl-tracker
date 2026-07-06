import Link from "next/link";
import type { Metadata } from "next";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";

export const metadata: Metadata = {
  title: "Página não encontrada — Garimpa Vinil",
};

export default function NotFound() {
  return (
    <div className="min-h-[calc(100dvh-62px)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-5xl flex flex-col-reverse sm:flex-row items-center gap-10 sm:gap-16">

        {/* ── Left: text + links ── */}
        <div className="flex-1 flex flex-col items-start text-left">

          <h1 className="font-display text-6xl sm:text-8xl font-black text-cream leading-none mb-5">
            Oops!
          </h1>

          <p className="text-parchment text-lg sm:text-xl leading-snug mb-2 max-w-sm">
            Você chegou no lado B de um disco que não existe.
          </p>
          <p className="text-parchment text-base sm:text-lg leading-snug mb-1">
            Que tal o lado A?
          </p>

          <p className="text-dust text-sm mt-3 mb-8">
            Código de erro: <span className="text-parchment font-semibold">404</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-2">
            <Link
              href="/disco"
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-goldlit active:scale-95 text-record font-bold text-sm px-6 py-3 rounded-full transition-colors"
            >
              Garimpar ofertas
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 border border-groove hover:border-wax hover:bg-groove/40 active:scale-95 text-parchment hover:text-cream font-medium text-sm px-6 py-3 rounded-full transition-colors"
            >
              Ir para o início
            </Link>
          </div>

          <NotFoundSuggestions />
        </div>

        {/* ── Right: sad vinyl character ── */}
        <div className="shrink-0 w-52 h-52 sm:w-72 sm:h-72 select-none">
          <svg
            viewBox="0 0 200 200"
            fill="none"
            className="w-full h-full drop-shadow-2xl"
            aria-hidden
          >
            <defs>
              <radialGradient id="nf-sheen" cx="38%" cy="32%" r="70%">
                <stop offset="0%"   stopColor="#3d2c21" stopOpacity="0.6" />
                <stop offset="40%"  stopColor="#0c0a08" stopOpacity="0" />
                <stop offset="100%" stopColor="#0c0a08" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="nf-label" cx="50%" cy="40%" r="65%">
                <stop offset="0%"   stopColor="#2e1a10" />
                <stop offset="100%" stopColor="#0f0a07" />
              </radialGradient>
              <clipPath id="nf-clip">
                <circle cx="100" cy="100" r="98" />
              </clipPath>
            </defs>

            {/* Outer disc */}
            <circle cx="100" cy="100" r="98" fill="#100c0a" />

            {/* Groove rings */}
            {[95,92,89,86,83,80,77,74,71,68,65,62,59,56,53,50].map((r, i) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none"
                stroke="#2b1e17"
                strokeWidth={i % 3 === 0 ? "0.9" : "0.5"}
                opacity={0.55 + (i % 4) * 0.1}
              />
            ))}

            {/* Sheen */}
            <circle cx="100" cy="100" r="98" fill="url(#nf-sheen)" clipPath="url(#nf-clip)" />

            {/* Lead-in groove */}
            <circle cx="100" cy="100" r="47" fill="none" stroke="#3d2c21" strokeWidth="1.5" opacity="0.8" />

            {/* Center label */}
            <circle cx="100" cy="100" r="44"   fill="url(#nf-label)" />
            <circle cx="100" cy="100" r="43.5" fill="none" stroke="#d98f0e" strokeWidth="0.6" opacity="0.5" />
            <circle cx="100" cy="100" r="39"   fill="none" stroke="#d98f0e" strokeWidth="0.3" opacity="0.15" />

            {/* ── Sad face ── */}

            {/* Eye whites */}
            <circle cx="89"  cy="95" r="5" fill="#f0e6d0" opacity="0.9" />
            <circle cx="111" cy="95" r="5" fill="#f0e6d0" opacity="0.9" />

            {/* Pupils */}
            <circle cx="89.5"  cy="96.5" r="2.5" fill="#100c0a" />
            <circle cx="111.5" cy="96.5" r="2.5" fill="#100c0a" />

            {/* Droopy eyelids — dark fill over top half of each eye */}
            <path d="M84,95 A5,5 0 0,1 94,95 Z"   fill="#201614" />
            <path d="M106,95 A5,5 0 0,1 116,95 Z"  fill="#201614" />

            {/* Sad eyebrows — inner corners raised */}
            <path d="M82,87 Q88,82 95,85"   stroke="#b8936a" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M105,85 Q112,82 118,87" stroke="#b8936a" strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Nose — doubles as spindle hole */}
            <circle cx="100" cy="103" r="2" fill="#3d2c21" opacity="0.7" />

            {/* Frown */}
            <path d="M87,115 Q100,108 113,115" stroke="#b8936a" strokeWidth="2" strokeLinecap="round" fill="none" />

            {/* Teardrop under left eye */}
            <path d="M89,102 L86.5,110 Q89,114 91.5,110 Z" fill="#7ab8d4" opacity="0.7" />

          </svg>
        </div>

      </div>
    </div>
  );
}
