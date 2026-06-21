"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { resizeAmazonImage } from "@/lib/utils/amazonImage";

// ─── types ────────────────────────────────────────────────────────────────────

interface Props {
  recordId: string;
  titulo: string;
  artista: string;
  precoAtual: number;
  imgUrl?: string | null;
  variant?: "primary" | "secondary";
  label?: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

// ─── helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Long-press repeater: fires immediately, then every 100ms while held.
// Uses a ref for the callback so the interval never captures a stale closure.
function useRepeater() {
  const cbRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start(fn: () => void) {
    cbRef.current = fn;
    fn();
    timerRef.current = setInterval(() => cbRef.current?.(), 100);
  }

  function stop() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    cbRef.current = null;
  }

  useEffect(() => () => stop(), []);
  return { start, stop };
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function computeLimits(precoAtual: number) {
  if (precoAtual <= 1) return null;
  const sliderMax = Math.round(precoAtual) - 1;
  const sliderMin = Math.max(1, Math.round(precoAtual * 0.5));
  if (sliderMin >= sliderMax) return null;
  const defaultVal = Math.max(
    sliderMin,
    Math.min(sliderMax, Math.round(precoAtual * 0.95)),
  );
  return { sliderMin, sliderMax, defaultVal };
}

// ─── focus trap ───────────────────────────────────────────────────────────────

function useFocusTrap(
  ref: { readonly current: HTMLElement | null },
  active: boolean,
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      );

    getFocusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const els = getFocusable();
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [active, ref]);
}

// ─── modal ────────────────────────────────────────────────────────────────────

function Modal({
  onClose,
  recordId,
  titulo,
  artista,
  precoAtual,
  imgUrl,
}: {
  onClose: () => void;
  recordId: string;
  titulo: string;
  artista: string;
  precoAtual: number;
  imgUrl?: string | null;
}) {
  const limits = computeLimits(precoAtual);

  const [targetPrice, setTargetPrice] = useState(limits?.defaultVal ?? 0);
  const [inputVal, setInputVal] = useState(
    limits ? String(limits.defaultVal) : "",
  );
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  // Ref tracks live price for long-press repeater without stale closure.
  const priceRef = useRef(limits?.defaultVal ?? 0);
  const repeater = useRepeater();

  useFocusTrap(dialogRef, true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function applyPrice(v: number) {
    priceRef.current = v;
    setTargetPrice(v);
    setInputVal(String(v));
  }

  function applyChip(pct: number) {
    if (!limits) return;
    applyPrice(
      Math.max(limits.sliderMin, Math.min(limits.sliderMax, Math.round(precoAtual * (1 - pct)))),
    );
  }

  function stepDown() {
    if (!limits) return;
    applyPrice(Math.max(limits.sliderMin, priceRef.current - 1));
  }

  function stepUp() {
    if (!limits) return;
    applyPrice(Math.min(limits.sliderMax, priceRef.current + 1));
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(",", ".");
    setInputVal(e.target.value);
    const num = parseFloat(raw);
    if (Number.isFinite(num) && num > 0) {
      const clamped = limits
        ? Math.max(limits.sliderMin, Math.min(limits.sliderMax, Math.round(num)))
        : num;
      priceRef.current = clamped;
      setTargetPrice(clamped);
    }
  }

  function onInputBlur() {
    if (limits) {
      setInputVal(String(targetPrice));
    } else {
      const raw = inputVal.replace(",", ".");
      const num = parseFloat(raw);
      if (!Number.isFinite(num) || num <= 0) {
        setInputVal("");
        setTargetPrice(0);
        priceRef.current = 0;
      } else {
        const rounded = Math.round(num * 100) / 100;
        setInputVal(rounded.toFixed(2).replace(".", ","));
        setTargetPrice(rounded);
        priceRef.current = rounded;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setErrorMsg("E-mail inválido.");
      setFormState("error");
      emailRef.current?.focus();
      return;
    }
    if (targetPrice <= 0) {
      setErrorMsg("Informe um preço alvo válido.");
      setFormState("error");
      return;
    }
    setFormState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          record_id: recordId,
          max_price: targetPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao criar alerta.");
        setFormState("error");
        emailRef.current?.focus();
        return;
      }
      setFormState("success");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setFormState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="alerta-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-record/80 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centered card on sm+ */}
      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-sm bg-sleeve border border-groove rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-y-auto max-h-[92dvh] sm:max-h-[90dvh] animate-modal-in"
      >
        {/* Drag handle (mobile only affordance) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-groove" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-groove">
          <h2
            id="alerta-title"
            className="font-display font-black text-lg text-cream"
          >
            Alerta de preço
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-dust hover:text-cream hover:bg-groove transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {formState === "success" ? (
          /* ── success state ─────────────────────────────────────────── */
          <div className="px-5 py-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 border border-gold/30 mx-auto mb-4">
              <svg
                className="w-6 h-6 text-gold"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="font-display font-black text-xl text-cream mb-2">
              Verifique seu e-mail
            </h3>
            <p className="text-parchment text-sm leading-relaxed mb-6">
              Enviamos um link de confirmação para{" "}
              <span className="text-cream font-medium">{email}</span>. O alerta
              só começa depois que você confirmar.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        ) : (
          /* ── form state ────────────────────────────────────────────── */
          <form
            onSubmit={handleSubmit}
            noValidate
            className="px-5 pt-4 pb-6 flex flex-col gap-5"
          >
            {/* Record info + price anchor */}
            <div className="flex items-center gap-3 bg-label rounded-xl p-3 border border-groove/50">
              {imgUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resizeAmazonImage(imgUrl, 80)}
                  alt=""
                  aria-hidden
                  width={44}
                  height={44}
                  className="w-11 h-11 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-cream text-sm font-semibold truncate leading-tight">
                  {titulo}
                </p>
                <p className="text-dust text-xs truncate mt-0.5">{artista}</p>
              </div>
              {precoAtual > 0 && (
                <div className="shrink-0 text-right pl-2">
                  <p className="text-[10px] text-dust uppercase tracking-wide leading-none mb-1">
                    Preço atual
                  </p>
                  <p className="font-display font-black text-gold tabular-nums text-base leading-none">
                    {fmtBrl(precoAtual)}
                  </p>
                </div>
              )}
            </div>

            {/* Target price control */}
            <div>
              <p className="text-sm font-medium text-parchment mb-3">
                Me avise quando o preço chegar em
              </p>

              {limits && (
                <>
                  {/* Quick-pick chips */}
                  <div
                    className="flex gap-2 mb-4"
                    role="group"
                    aria-label="Atalhos de desconto"
                  >
                    {([0.05, 0.1, 0.15] as const).map((pct) => {
                      const chipVal = Math.max(
                        limits.sliderMin,
                        Math.min(limits.sliderMax, Math.round(precoAtual * (1 - pct))),
                      );
                      const active = targetPrice === chipVal;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => applyChip(pct)}
                          aria-pressed={active}
                          className={`flex-1 text-xs font-bold py-2.5 rounded-lg border transition-all cursor-pointer ${
                            active
                              ? "bg-gold/15 border-gold/60 text-gold"
                              : "bg-groove/60 border-groove text-dust hover:border-wax hover:text-parchment"
                          }`}
                        >
                          {Math.round(pct * 100)}% menos
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper — replaces slider; fat touch targets, price always visible */}
                  <div className="flex items-center gap-3 bg-groove/40 rounded-xl p-3 mb-3">
                    <button
                      type="button"
                      onPointerDown={() => repeater.start(stepDown)}
                      onPointerUp={repeater.stop}
                      onPointerLeave={repeater.stop}
                      onPointerCancel={repeater.stop}
                      disabled={targetPrice <= limits.sliderMin}
                      aria-label="Diminuir preço"
                      className="flex items-center justify-center w-12 h-12 rounded-xl bg-sleeve border border-groove text-cream text-2xl font-bold disabled:opacity-25 disabled:cursor-not-allowed select-none touch-none cursor-pointer transition-colors hover:border-wax active:bg-groove"
                    >
                      −
                    </button>
                    <div className="flex-1 text-center select-none">
                      <p className="font-display font-black text-gold tabular-nums text-2xl leading-none">
                        {fmtBrl(targetPrice)}
                      </p>
                      <p className="text-dust text-[10px] mt-1 uppercase tracking-wide">
                        preço alvo
                      </p>
                    </div>
                    <button
                      type="button"
                      onPointerDown={() => repeater.start(stepUp)}
                      onPointerUp={repeater.stop}
                      onPointerLeave={repeater.stop}
                      onPointerCancel={repeater.stop}
                      disabled={targetPrice >= limits.sliderMax}
                      aria-label="Aumentar preço"
                      className="flex items-center justify-center w-12 h-12 rounded-xl bg-sleeve border border-groove text-cream text-2xl font-bold disabled:opacity-25 disabled:cursor-not-allowed select-none touch-none cursor-pointer transition-colors hover:border-wax active:bg-groove"
                    >
                      +
                    </button>
                  </div>
                </>
              )}

              {/* Synced text input */}
              <div className="relative">
                <span
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dust text-sm select-none pointer-events-none"
                  aria-hidden="true"
                >
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={inputVal}
                  onChange={onInputChange}
                  onBlur={onInputBlur}
                  aria-label="Preço alvo em reais"
                  placeholder={limits ? String(limits.defaultVal) : "Ex: 150,00"}
                  className="w-full bg-groove/60 border border-groove rounded-xl pl-9 pr-4 py-3.5 text-sm text-cream font-display font-black tabular-nums focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="alerta-email"
                className="block text-sm font-medium text-parchment mb-2"
              >
                Seu e-mail
              </label>
              <input
                id="alerta-email"
                ref={emailRef}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
                aria-required="true"
                className="w-full bg-groove/60 border border-groove rounded-xl px-4 py-3.5 text-sm text-cream placeholder-dust focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
              />
            </div>

            {/* Error message */}
            {formState === "error" && errorMsg && (
              <p className="text-cut text-sm -mt-2" role="alert">
                {errorMsg}
              </p>
            )}

            {/* Consent copy — pt-BR, one-time alert, LGPD */}
            <p className="text-dust text-xs leading-relaxed -mt-1">
              Ao criar o alerta, você autoriza o Garimpa Vinil a armazenar seu
              e-mail para enviar{" "}
              <strong className="text-parchment font-semibold">
                um único aviso
              </strong>{" "}
              quando o preço cair para o valor escolhido. Sem newsletter. Sem
              marketing. Depois do aviso, o alerta é encerrado automaticamente.
              Você pode cancelar a qualquer momento pelo link no e-mail de
              confirmação.{" "}
              <Link
                href="/politica-de-privacidade"
                target="_blank"
                rel="noopener"
                className="text-gold/80 hover:text-gold hover:underline transition-colors"
              >
                Política de Privacidade
              </Link>
              .
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === "submitting"}
              className="flex items-center justify-center gap-2 w-full bg-gold hover:bg-goldlit disabled:opacity-50 disabled:cursor-not-allowed text-record font-bold text-sm py-4 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sleeve cursor-pointer"
            >
              {formState === "submitting" ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Enviando…
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  Criar alerta
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── trigger button ───────────────────────────────────────────────────────────

export default function AlertaTrigger({
  recordId,
  titulo,
  artista,
  precoAtual,
  imgUrl,
  variant = "secondary",
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const btnLabel =
    label ??
    (variant === "primary" ? "Avise-me quando voltar" : "Criar alerta de preço");

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={
          variant === "primary"
            ? "flex items-center justify-center gap-1.5 w-full bg-gold hover:bg-goldlit text-record font-bold text-sm py-3.5 rounded-xl transition-colors cursor-pointer"
            : "flex items-center justify-center gap-1.5 w-full border border-groove text-dust hover:text-cream hover:border-parchment/40 text-sm py-3.5 rounded-xl transition-colors mt-2 cursor-pointer"
        }
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {btnLabel}
      </button>

      {open && (
        <Modal
          onClose={closeModal}
          recordId={recordId}
          titulo={titulo}
          artista={artista}
          precoAtual={precoAtual}
          imgUrl={imgUrl}
        />
      )}
    </>
  );
}
