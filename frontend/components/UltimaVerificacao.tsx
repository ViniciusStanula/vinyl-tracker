"use client";

import { useEffect, useState } from "react";

const BRT = "America/Sao_Paulo";

const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: BRT });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { timeZone: BRT, hour: "2-digit", minute: "2-digit" });

/**
 * "Atual" / "Último registro" label — when the crawler last checked the price.
 *
 * Client-side on purpose. Rendering it on the server stamped an observation
 * timestamp into the cached HTML, so every crawl changed the page even when the
 * price had not moved, and every change is a billed ISR write. See
 * app/api/preco-status/route.ts.
 *
 * Renders nothing until loaded rather than a placeholder that shifts layout:
 * the label sits under a price that is already visible, so an empty line for
 * one paint reads as ordinary loading rather than missing data.
 */
export default function UltimaVerificacao({ slug }: { slug: string }) {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/preco-status?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.checkedAt) setCheckedAt(d.checkedAt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!checkedAt) return null;

  const d = new Date(checkedAt);
  const isHoje = fmtDate(d) === fmtDate(new Date());
  const label = isHoje ? `Hoje, ${fmtTime(d)}` : `${fmtDate(d)}, ${fmtTime(d)}`;

  return <time dateTime={checkedAt}>{label}</time>;
}
