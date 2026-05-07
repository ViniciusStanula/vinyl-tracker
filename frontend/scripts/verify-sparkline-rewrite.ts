/**
 * Verifies that the rewritten sparkline CTEs produce identical output
 * to the original correlated subqueries.
 *
 * Run: npx tsx scripts/verify-sparkline-rewrite.ts
 *
 * Covers:
 *   - Normal case: style with many discos
 *   - Zero results: slug that matches nothing
 *   - Partial sparkline: disco with <10 price records in the 30-day window
 *   - Max-size: style hitting the 96-disco LIMIT
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function sparklineKey(rows: Array<{ id: string; sparkline: number[] }>): string {
  return JSON.stringify(sortById(rows).map((r) => ({ id: r.id, sparkline: r.sparkline })));
}

function assertEq(label: string, a: string, b: string) {
  if (a === b) {
    console.log(`  ✓  ${label}`);
  } else {
    console.error(`  ✗  ${label}`);
    console.error(`     BEFORE IDs: ${JSON.parse(a).map((r: { id: string }) => r.id).join(", ")}`);
    console.error(`     AFTER  IDs: ${JSON.parse(b).map((r: { id: string }) => r.id).join(", ")}`);
    process.exitCode = 1;
  }
}

// ── ESTILO queries ─────────────────────────────────────────────────────────

async function estiloBeforeQuery(canonical: string) {
  return prisma.$queryRaw<{ id: string; sparkline: unknown }[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("discoId") "discoId", "precoBrl"::float AS preco
      FROM "HistoricoPreco" ORDER BY "discoId", "capturadoEm" DESC
    ),
    avgd AS (
      SELECT "discoId", AVG("precoBrl")::float AS media
      FROM "HistoricoPreco"
      WHERE "capturadoEm" >= NOW() - INTERVAL '30 days'
      GROUP BY "discoId"
    )
    SELECT
      d.id,
      (
        SELECT COALESCE(
          json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
          '[]'::json
        )
        FROM (
          SELECT "precoBrl", "capturadoEm"
          FROM "HistoricoPreco"
          WHERE "discoId" = d.id
            AND "capturadoEm" >= NOW() - INTERVAL '30 days'
          ORDER BY "capturadoEm" ASC
          LIMIT 10
        ) sp
      ) AS sparkline
    FROM "Disco" d
    INNER JOIN latest l ON l."discoId" = d.id
    LEFT  JOIN avgd   a ON a."discoId" = d.id
    WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(d.lastfm_tags), ', '))
      AND d.disponivel = TRUE
    ORDER BY d.deal_score DESC NULLS LAST
    LIMIT 96
  `;
}

async function estiloAfterQuery(canonical: string) {
  return prisma.$queryRaw<{ id: string; sparkline: unknown }[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("discoId") "discoId", "precoBrl"::float AS preco
      FROM "HistoricoPreco" ORDER BY "discoId", "capturadoEm" DESC
    ),
    avgd AS (
      SELECT "discoId", AVG("precoBrl")::float AS media
      FROM "HistoricoPreco"
      WHERE "capturadoEm" >= NOW() - INTERVAL '30 days'
      GROUP BY "discoId"
    ),
    candidates AS (
      SELECT d.id
      FROM "Disco" d
      INNER JOIN latest l ON l."discoId" = d.id
      WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(d.lastfm_tags), ', '))
        AND d.disponivel = TRUE
      LIMIT 96
    ),
    sparklines AS (
      SELECT "discoId",
             json_agg(preco ORDER BY ts) AS sparkline
      FROM (
        SELECT "discoId",
               "precoBrl"::float AS preco,
               "capturadoEm"     AS ts,
               ROW_NUMBER() OVER (
                 PARTITION BY "discoId"
                 ORDER BY "capturadoEm" ASC
               ) AS rn
        FROM "HistoricoPreco"
        WHERE "discoId" = ANY(SELECT id FROM candidates)
          AND "capturadoEm" >= NOW() - INTERVAL '30 days'
      ) ranked
      WHERE rn <= 10
      GROUP BY "discoId"
    )
    SELECT
      d.id,
      COALESCE(sk.sparkline, '[]'::json) AS sparkline
    FROM "Disco" d
    INNER JOIN latest     l  ON l."discoId" = d.id
    LEFT  JOIN avgd       a  ON a."discoId" = d.id
    LEFT  JOIN sparklines sk ON sk."discoId" = d.id
    WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(d.lastfm_tags), ', '))
      AND d.disponivel = TRUE
    ORDER BY d.deal_score DESC NULLS LAST
    LIMIT 96
  `;
}

// ── DISCO related-deals queries ────────────────────────────────────────────

async function discoBeforeQuery(discoId: string) {
  return prisma.$queryRaw<{ id: string; sparkline: unknown }[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("discoId") "discoId", "precoBrl"::float AS preco
      FROM "HistoricoPreco" ORDER BY "discoId", "capturadoEm" DESC
    ),
    avgd AS (
      SELECT "discoId", AVG("precoBrl")::float AS media
      FROM "HistoricoPreco"
      WHERE "capturadoEm" >= NOW() - INTERVAL '30 days'
      GROUP BY "discoId"
    )
    SELECT
      d.id,
      (
        SELECT COALESCE(
          json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
          '[]'::json
        )
        FROM (
          SELECT "precoBrl", "capturadoEm"
          FROM   "HistoricoPreco"
          WHERE  "discoId" = d.id
            AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
          ORDER  BY "capturadoEm" ASC
          LIMIT  10
        ) sp
      ) AS sparkline
    FROM "Disco" d
    INNER JOIN latest l ON l."discoId" = d.id
    LEFT  JOIN avgd   a ON a."discoId" = d.id
    WHERE d.id != ${discoId}::uuid
      AND d.deal_score IS NOT NULL
      AND d.disponivel = TRUE
    ORDER BY d.deal_score DESC, RANDOM()
    LIMIT 4
  `;
}

async function discoAfterQuery(discoId: string) {
  return prisma.$queryRaw<{ id: string; sparkline: unknown }[]>`
    WITH latest AS (
      SELECT DISTINCT ON ("discoId") "discoId", "precoBrl"::float AS preco
      FROM "HistoricoPreco" ORDER BY "discoId", "capturadoEm" DESC
    ),
    avgd AS (
      SELECT "discoId", AVG("precoBrl")::float AS media
      FROM "HistoricoPreco"
      WHERE "capturadoEm" >= NOW() - INTERVAL '30 days'
      GROUP BY "discoId"
    ),
    sparklines AS (
      SELECT "discoId",
             json_agg(preco ORDER BY ts) AS sparkline
      FROM (
        SELECT "discoId",
               "precoBrl"::float AS preco,
               "capturadoEm"     AS ts,
               ROW_NUMBER() OVER (
                 PARTITION BY "discoId"
                 ORDER BY "capturadoEm" ASC
               ) AS rn
        FROM "HistoricoPreco"
        WHERE "discoId" = ANY(
          SELECT id FROM "Disco"
          WHERE id != ${discoId}::uuid
            AND deal_score IS NOT NULL
            AND disponivel = TRUE
          ORDER BY deal_score DESC
          LIMIT 4
        )
        AND "capturadoEm" >= NOW() - INTERVAL '30 days'
      ) ranked
      WHERE rn <= 10
      GROUP BY "discoId"
    )
    SELECT
      d.id,
      COALESCE(sk.sparkline, '[]'::json) AS sparkline
    FROM "Disco" d
    INNER JOIN latest     l  ON l."discoId" = d.id
    LEFT  JOIN avgd       a  ON a."discoId" = d.id
    LEFT  JOIN sparklines sk ON sk."discoId" = d.id
    WHERE d.id != ${discoId}::uuid
      AND d.deal_score IS NOT NULL
      AND d.disponivel = TRUE
    ORDER BY d.deal_score DESC, RANDOM()
    LIMIT 4
  `;
}

// ── normalise raw rows ─────────────────────────────────────────────────────

function normalise(rows: { id: string; sparkline: unknown }[]) {
  return sortById(rows).map((r) => ({
    id: r.id,
    sparkline: Array.isArray(r.sparkline)
      ? (r.sparkline as unknown[]).map(Number)
      : typeof r.sparkline === "string"
      ? JSON.parse(r.sparkline)
      : [],
  }));
}

// ── test cases ─────────────────────────────────────────────────────────────

async function runEstiloCase(label: string, canonical: string) {
  console.log(`\nEstilo: ${label} (canonical="${canonical}")`);
  const [before, after] = await Promise.all([
    estiloBeforeQuery(canonical),
    estiloAfterQuery(canonical),
  ]);
  const nb = normalise(before);
  const na = normalise(after);
  assertEq("row count", String(nb.length), String(na.length));
  assertEq("ids match", JSON.stringify(nb.map((r) => r.id)), JSON.stringify(na.map((r) => r.id)));
  assertEq("sparklines match", sparklineKey(nb), sparklineKey(na));
  console.log(`     rows: ${nb.length}, sparklines checked: ${nb.filter((r) => r.sparkline.length > 0).length} non-empty`);
}

async function runDiscoCase(label: string, discoId: string) {
  console.log(`\nDisco: ${label} (id=${discoId})`);
  const [before, after] = await Promise.all([
    discoBeforeQuery(discoId),
    discoAfterQuery(discoId),
  ]);
  const nb = normalise(before);
  const na = normalise(after);
  assertEq("row count", String(nb.length), String(na.length));
  assertEq("sparklines match", sparklineKey(nb), sparklineKey(na));
  console.log(`     related deals: ${nb.length}`);
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Sparkline rewrite verification ===\n");

  // -- Fetch real slugs from DB for realistic cases --
  const [popularStyle, rareStyle, anyDisco, maxDisco] = await Promise.all([
    // Most-used style tag (likely to hit 96-row limit)
    prisma.$queryRaw<{ tag: string; cnt: number }[]>`
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT DISTINCT ON (d.id) d.id,
               unnest(string_to_array(d.lastfm_tags, ', ')) AS tag
        FROM "Disco" d WHERE d.disponivel = TRUE AND d.lastfm_tags IS NOT NULL
      ) sub
      GROUP BY tag ORDER BY cnt DESC LIMIT 1
    `,
    // Rare style (likely partial/zero sparkline data)
    prisma.$queryRaw<{ tag: string; cnt: number }[]>`
      SELECT tag, COUNT(*) AS cnt
      FROM (
        SELECT DISTINCT ON (d.id) d.id,
               unnest(string_to_array(d.lastfm_tags, ', ')) AS tag
        FROM "Disco" d WHERE d.disponivel = TRUE AND d.lastfm_tags IS NOT NULL
      ) sub
      GROUP BY tag ORDER BY cnt ASC LIMIT 1
    `,
    // Any available disco for related-deals test
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Disco" WHERE deal_score IS NOT NULL AND disponivel = TRUE
      ORDER BY deal_score DESC LIMIT 1
    `,
    // Disco least likely to have related deals (edge: may return 0)
    prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Disco" WHERE disponivel = FALSE LIMIT 1
    `,
  ]);

  // Estilo cases
  const popular = (popularStyle as { tag: string }[])[0]?.tag ?? "rock";
  const rare    = (rareStyle    as { tag: string }[])[0]?.tag ?? "zzz-nonexistent";

  await runEstiloCase("popular style (max rows)", popular);
  await runEstiloCase("rare style (few rows / partial sparklines)", rare);
  await runEstiloCase("zero results (nonexistent slug)", "zzz-definitely-does-not-exist-xyz");

  // Disco cases
  const realId = (anyDisco  as { id: string }[])[0]?.id;
  const unavId = (maxDisco  as { id: string }[])[0]?.id;

  if (realId)  await runDiscoCase("normal disco with related deals", realId);
  if (unavId)  await runDiscoCase("unavailable disco (0 related deals expected)", unavId);

  console.log("\n=== Done ===");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
