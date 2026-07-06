"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Sub = {
  titulo: string;
  artista: string;
  maxPrice: number;
  status: string;
};

export default function GerenciarAlertaPage() {
  const { token } = useParams<{ token: string }>();

  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/alertas/gerenciar/${token}`);
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setSub(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/alertas/gerenciar/${token}`, { method: "DELETE" });
      if (res.ok) setDeleted(true);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="h-5 w-32 bg-groove rounded animate-pulse mb-6" />
        <div className="bg-sleeve border border-groove rounded-xl p-6 space-y-4">
          <div className="h-6 w-48 bg-groove rounded animate-pulse" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between gap-4">
                <div className="h-4 w-20 bg-groove rounded animate-pulse" />
                <div className="h-4 w-36 bg-groove rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-12 w-full bg-groove rounded-xl animate-pulse mt-4" />
        </div>
      </div>
    );
  }

  if (notFound || !sub) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-sleeve border border-groove rounded-xl p-8">
          <h1 className="font-display text-xl font-black text-cream mb-3">
            Alerta não encontrado
          </h1>
          <p className="text-parchment text-sm mb-6">
            Este alerta não existe ou já foi cancelado.
          </p>
          <Link
            href="/alertas"
            className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Criar novo alerta
          </Link>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-sleeve border border-groove rounded-xl p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-deallit/10 border border-deallit/30 mx-auto mb-4">
            <svg className="w-6 h-6 text-deallit" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-xl font-black text-cream mb-3">
            Alerta cancelado
          </h1>
          <p className="text-parchment text-sm mb-6">
            Seus dados foram removidos. Você não receberá mais notificações para este alerta.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  const maxPriceFormatted = sub.maxPrice.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Gerenciar alerta</span>
      </nav>

      <div className="bg-sleeve border border-groove rounded-xl p-6">
        <h1 className="font-display text-xl font-black text-cream mb-5">
          Seu alerta de preço
        </h1>

        <dl className="flex flex-col gap-3 text-sm mb-6">
          <div className="flex justify-between gap-4">
            <dt className="text-dust shrink-0">Disco</dt>
            <dd className="text-cream text-right font-medium">{sub.titulo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-dust shrink-0">Artista</dt>
            <dd className="text-cream text-right">{sub.artista}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-dust shrink-0">Limite de preço</dt>
            <dd className="text-gold text-right font-semibold tabular-nums">{maxPriceFormatted}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-dust shrink-0">Status</dt>
            <dd className={sub.status === "confirmed" ? "text-deallit" : "text-dust"}>
              {sub.status === "confirmed" ? "Ativo" : "Aguardando confirmação"}
            </dd>
          </div>
        </dl>

        {confirmingDelete ? (
          <div className="border border-cut/40 bg-cut/5 rounded-xl p-4">
            <p className="text-cream text-sm font-medium mb-1">Confirmar cancelamento?</p>
            <p className="text-dust text-xs mb-4">
              Seu e-mail e preferências serão removidos permanentemente dos nossos servidores.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-cut/80 hover:bg-cut text-cream disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {deleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Removendo…
                  </span>
                ) : "Sim, cancelar alerta"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 border border-groove text-dust hover:text-cream text-sm font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Manter alerta
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full border border-cut/50 text-cut hover:bg-cut/10 text-sm font-medium py-3.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar alerta e remover meus dados
            </button>
            <p className="text-dust text-xs mt-3 text-center">
              Remove imediatamente seu e-mail e preferências dos nossos servidores.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
