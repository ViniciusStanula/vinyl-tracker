import Link from "next/link";
import type { Metadata } from "next";
import NotFoundSuggestions from "@/components/NotFoundSuggestions";

export const metadata: Metadata = {
  title: "Página não encontrada — Garimpa Vinil",
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-[calc(100dvh-62px)] flex items-center justify-center px-4 py-16"
    >
      <div className="flex flex-col items-center text-center max-w-sm">

        {/* Spinning vinyl */}
        <div className="relative w-52 h-52 mb-10 select-none">
          <svg
            viewBox="0 0 200 200"
            fill="none"
            className="w-full h-full [animation:spin_8s_linear_infinite] motion-reduce:animate-none drop-shadow-2xl"
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

            <circle cx="100" cy="100" r="98" fill="#100c0a" />

            {[95,92,89,86,83,80,77,74,71,68,65,62,59,56,53,50].map((r, i) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none"
                stroke="#2b1e17"
                strokeWidth={i % 3 === 0 ? "0.9" : "0.5"}
                opacity={0.55 + (i % 4) * 0.1}
              />
            ))}

            <circle cx="100" cy="100" r="98"   fill="url(#nf-sheen)" clipPath="url(#nf-clip)" />
            <circle cx="100" cy="100" r="47"   fill="none" stroke="#3d2c21" strokeWidth="1.5" opacity="0.8" />
            <circle cx="100" cy="100" r="44"   fill="url(#nf-label)" />
            <circle cx="100" cy="100" r="43.5" fill="none" stroke="#d98f0e" strokeWidth="0.6" opacity="0.5" />
            <circle cx="100" cy="100" r="40"   fill="none" stroke="#d98f0e" strokeWidth="0.3" opacity="0.2" />
            <circle cx="100" cy="100" r="15"   fill="none" stroke="#d98f0e" strokeWidth="0.3" opacity="0.2" />

            <text x="100" y="72"  textAnchor="middle" fill="#7a4f0e" fontSize="5"   fontFamily="system-ui,sans-serif" letterSpacing="2"   fontWeight="600">GARIMPA VINIL</text>
            <text x="100" y="130" textAnchor="middle" fill="#7a4f0e" fontSize="4.5" fontFamily="system-ui,sans-serif" letterSpacing="1.5">GV · 404</text>

            <circle cx="100" cy="100" r="5.5" fill="#d98f0e" opacity="0.7" />
            <circle cx="100" cy="100" r="3.5" fill="#0c0a08" />
          </svg>
        </div>

        {/* Text */}
        <h1 className="font-display text-2xl sm:text-3xl font-black text-cream leading-snug mb-3">
          Você chegou no lado B de um disco que não existe.
        </h1>
        <p className="text-parchment text-sm sm:text-base leading-relaxed mb-8">
          Que tal o lado A?
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
