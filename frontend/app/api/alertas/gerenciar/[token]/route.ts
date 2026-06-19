import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionByToken, deleteSubscriptionByToken } from "@/lib/db/alertas";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!token || token.length !== 64) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  try {
    const sub = await getSubscriptionByToken(token);
    if (!sub) {
      return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      titulo: sub.titulo,
      artista: sub.artista,
      maxPrice: sub.maxPrice,
      status: sub.status,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar alerta." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!token || token.length !== 64) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  try {
    const deleted = await deleteSubscriptionByToken(token);
    if (!deleted) {
      return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao cancelar alerta." }, { status: 500 });
  }
}
