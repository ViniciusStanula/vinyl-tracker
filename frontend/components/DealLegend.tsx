import { DEAL_TIERS } from "@/lib/dealTiers";

/**
 * One-line badge legend shown above listing grids. Reads DEAL_TIERS so the
 * homepage and /disco can never drift apart from each other or from /ofertas
 * again — which is exactly what had happened.
 */
export default function DealLegend() {
  return (
    <p className="text-xs text-dust mb-4 leading-relaxed">
      {DEAL_TIERS.map((t, i) => (
        <span key={t.score}>
          {i > 0 && " · "}
          <span
            className={
              t.score === 3
                ? "text-gold font-semibold"
                : t.score === 2
                  ? "text-deallit font-semibold"
                  : ""
            }
          >
            {t.mark ? `${t.mark} ` : ""}
            {t.label}
          </span>
          {" = "}
          {t.short}
        </span>
      ))}
    </p>
  );
}
