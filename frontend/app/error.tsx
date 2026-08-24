"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary.
 *
 * The facet pages used to swallow a failed data fetch and render a friendly
 * "erro ao carregar" message instead. That message was a successful 200, so
 * ISR cached it: one transient database blip left /estilo/future-garage
 * serving 17 words, no <h1> and the fallback title until the next
 * revalidation, which is exactly how the crawl of 24 Aug found it. Those pages
 * now re-throw, the response is a 500 that Next does not cache, and the reader
 * still gets this message.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="inline-block mb-5 opacity-40">
        <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto" aria-hidden="true">
          <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
          <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
          <circle cx="32" cy="32" r="5" className="fill-gold" opacity="0.4" />
          <circle cx="32" cy="32" r="2" className="fill-record" />
        </svg>
      </div>
      <h1 className="font-display text-parchment text-2xl font-black mb-2">
        Não conseguimos carregar esta página
      </h1>
      <p className="text-dust text-sm mb-8">
        Foi uma falha temporária. Tente de novo em alguns instantes.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Tentar de novo
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center border border-groove hover:border-wax text-parchment font-bold text-sm px-6 py-3 rounded-xl transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
