import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";
import { createSubscription, recordExists } from "@/lib/db/alertas";
import ConfirmacaoAlerta from "@/emails/ConfirmacaoAlerta";
import { SITE_URL } from "@/lib/siteUrl";

const resend = new Resend(process.env.RESEND_API_KEY);
const checkRateLimit = createRateLimiter(5, 60_000); // 5 subscribes per IP per minute

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns segundos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { email, record_id, max_price } = body as Record<string, unknown>;

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (typeof record_id !== "string" || !/^[0-9a-f-]{36}$/i.test(record_id)) {
    return NextResponse.json({ error: "Disco inválido." }, { status: 400 });
  }
  const maxPrice = Number(max_price);
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
    return NextResponse.json({ error: "Preço limite inválido." }, { status: 400 });
  }

  const exists = await recordExists(record_id);
  if (!exists) {
    return NextResponse.json({ error: "Disco não encontrado." }, { status: 404 });
  }

  // Fetch record info for the email (reuse the query already done in recordExists flow)
  const { prisma } = await import("@/lib/db/prisma");
  const discoRows = await prisma.$queryRaw<{ titulo: string; artista: string; slug: string }[]>`
    SELECT titulo, artista, slug FROM "Disco" WHERE id::text = ${record_id} LIMIT 1
  `;
  const disco = discoRows[0];
  if (!disco) {
    return NextResponse.json({ error: "Disco não encontrado." }, { status: 404 });
  }

  let sub: Awaited<ReturnType<typeof createSubscription>>;
  try {
    sub = await createSubscription(email, record_id, maxPrice);
  } catch (err) {
    console.error("createSubscription threw:", err);
    return NextResponse.json({ error: "Erro interno ao criar alerta." }, { status: 500 });
  }
  if (!sub) {
    return NextResponse.json({ error: "Erro ao criar alerta." }, { status: 500 });
  }

  const confirmUrl = `${SITE_URL}/alertas/confirmar?id=${sub.id}&token=${sub.manageToken}`;
  const manageUrl = `${SITE_URL}/alertas/gerenciar/${sub.manageToken}`;

  try {
    const html = await render(
      <ConfirmacaoAlerta
        titulo={disco.titulo}
        artista={disco.artista}
        maxPrice={maxPrice}
        confirmUrl={confirmUrl}
        manageUrl={manageUrl}
      />,
    );

    await resend.emails.send({
      from: "alertas@mail.garimpavinil.com.br",
      to: [email],
      subject: `Confirme seu alerta para "${disco.titulo}"`,
      html,
    });
  } catch (err) {
    console.error("Confirmation email failed:", err);
    // Don't fail the request — subscription was created; user can re-request.
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
