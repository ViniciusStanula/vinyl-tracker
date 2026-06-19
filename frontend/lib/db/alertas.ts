import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

export type AlertSubscription = {
  id: string;
  email: string;
  recordId: string;
  maxPrice: number;
  status: "pending" | "confirmed" | "unsubscribed";
  manageToken: string;
  titulo: string;
  artista: string;
  slug: string;
  avgPrice: number | null;
};

export async function createSubscription(
  email: string,
  recordId: string,
  maxPrice: number,
): Promise<{ id: string; manageToken: string } | null> {
  const manageToken = randomBytes(32).toString("hex");
  // Use jsonb_build_object — Prisma adapter-pg doesn't apply ::jsonb on
  // parameterized values reliably, so we avoid the cast entirely.
  const rows = await prisma.$queryRaw<{ id: string; manage_token: string }[]>`
    INSERT INTO alert_subscriptions (email, filters, manage_token)
    VALUES (
      ${email},
      jsonb_build_object(
        'record_id'::text, ${recordId}::text,
        'max_price'::text,  ${maxPrice}::numeric
      ),
      ${manageToken}
    )
    RETURNING id::text, manage_token
  `;

  return rows[0] ? { id: rows[0].id, manageToken: rows[0].manage_token } : null;
}

export async function confirmSubscription(
  id: string,
  manageToken: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE alert_subscriptions
    SET status = 'confirmed', confirmed_at = NOW()
    WHERE id::text = ${id}
      AND manage_token = ${manageToken}
      AND status = 'pending'
    RETURNING id::text
  `;
  return rows.length > 0;
}

export async function getSubscriptionByToken(
  manageToken: string,
): Promise<AlertSubscription | null> {
  const rows = await prisma.$queryRaw<{
    id: string;
    email: string;
    filters: { record_id: string; max_price: number };
    status: string;
    manage_token: string;
    titulo: string;
    artista: string;
    slug: string;
    avg_30d: string | null;
  }[]>`
    SELECT
      a.id::text,
      a.email,
      a.filters,
      a.status,
      a.manage_token,
      d.titulo,
      d.artista,
      d.slug,
      d.avg_30d::text
    FROM alert_subscriptions a
    JOIN "Disco" d ON d.id = (a.filters->>'record_id')
    WHERE a.manage_token = ${manageToken}
    LIMIT 1
  `;

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    email: r.email,
    recordId: r.filters.record_id,
    maxPrice: Number(r.filters.max_price),
    status: r.status as AlertSubscription["status"],
    manageToken: r.manage_token,
    titulo: r.titulo,
    artista: r.artista,
    slug: r.slug,
    avgPrice: r.avg_30d !== null ? Number(r.avg_30d) : null,
  };
}

export async function deleteSubscriptionByToken(
  manageToken: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    DELETE FROM alert_subscriptions
    WHERE manage_token = ${manageToken}
    RETURNING id::text
  `;
  return rows.length > 0;
}

export async function recordExists(recordId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id::text FROM "Disco"
    WHERE id::text = ${recordId}
      AND disponivel = TRUE
      AND (format IS NULL OR format = 'vinyl')
    LIMIT 1
  `;
  return rows.length > 0;
}
