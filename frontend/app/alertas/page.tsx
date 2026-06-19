"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resizeAmazonImage } from "@/lib/utils/amazonImage";
import type { SearchSuggestion } from "@/lib/db/search";

type FormState = "idle" | "submitting" | "success" | "error";

export default function AlertasPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [selected, setSelected] = useState<SearchSuggestion | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill from disco page link: ?record_id=...&titulo=...&artista=...&preco=...&imgUrl=...&slug=...
  useEffect(() => {
    const recordId = searchParams.get("record_id");
    const titulo   = searchParams.get("titulo");
    const artista  = searchParams.get("artista");
    const preco    = searchParams.get("preco");
    const imgUrl   = searchParams.get("imgUrl");
    const slug     = searchParams.get("slug");
    if (recordId && titulo && artista && slug) {
      const precoNum = preco ? Number(preco) : null;
      setSelected({
        id: recordId,
        titulo,
        artista,
        slug,
        imgUrl: imgUrl ?? null,
        preco: precoNum,
      });
      setQuery(titulo);
      if (precoNum !== null && precoNum > 0) {
        setMaxPrice(precoNum.toFixed(2).replace(".", ","));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autocomplete fetch
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || selected) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: SearchSuggestion[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [query, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function selectRecord(s: SearchSuggestion) {
    setSelected(s);
    setQuery(s.titulo);
    setShowDropdown(false);
    // Pre-fill with avg price as a cosmetic suggestion only
    if (s.preco !== null && maxPrice === "") {
      setMaxPrice(String(s.preco.toFixed(2).replace(".", ",")));
    }
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setMaxPrice("");
    setSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    const priceNum = parseFloat(maxPrice.replace(",", "."));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setErrorMsg("Informe um preço limite válido.");
      setFormState("error");
      priceInputRef.current?.focus();
      return;
    }
    if (!email) {
      setErrorMsg("Informe seu e-mail.");
      setFormState("error");
      emailInputRef.current?.focus();
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
          record_id: selected.id,
          max_price: priceNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao criar alerta.");
        setFormState("error");
        emailInputRef.current?.focus();
        return;
      }
      setFormState("success");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
      setFormState("error");
    }
  }

  if (formState === "success") {
    return (
      <main id="main-content" className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-sleeve border border-groove rounded-xl p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gold/10 border border-gold/30 mx-auto mb-4">
            <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-black text-cream mb-3">
            Verifique seu e-mail
          </h1>
          <p className="text-parchment text-sm leading-relaxed mb-6">
            Enviamos um link de confirmação para <span className="text-cream font-medium">{email}</span>.
            O alerta só começa a funcionar depois que você confirmar.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="max-w-xl mx-auto px-4 py-8">
      <nav className="mb-6 text-sm text-dust flex gap-2">
        <Link href="/" className="hover:text-gold transition-colors">Início</Link>
        <span>›</span>
        <span className="text-parchment">Alertas de preço</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl font-black text-cream leading-tight">
          Alerta de preço
        </h1>
        <p className="mt-2 text-dust text-sm">
          Avise-me quando o preço de um disco cair.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Record search */}
        <div ref={containerRef} className="relative">
          <label className="block text-sm font-medium text-parchment mb-2">
            Disco
          </label>
          {selected ? (
            <div className="flex items-center gap-3 bg-sleeve border border-gold rounded-xl px-4 py-3">
              {selected.imgUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resizeAmazonImage(selected.imgUrl, 80)}
                  alt=""
                  aria-hidden
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-cream text-sm font-medium truncate">{selected.titulo}</p>
                <p className="text-dust text-xs truncate">{selected.artista}</p>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="text-dust hover:text-cream text-xs shrink-0"
                aria-label="Remover disco selecionado"
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                autoComplete="off"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                placeholder="Busque por título ou artista…"
                className="w-full bg-sleeve border border-groove rounded-xl px-4 py-3 text-sm text-cream placeholder-dust focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
                required
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-sleeve border border-groove rounded-xl shadow-2xl overflow-hidden z-50">
                  {suggestions.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectRecord(s)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-groove transition-colors${
                        idx < suggestions.length - 1 ? " border-b border-groove/40" : ""
                      }`}
                    >
                      {s.imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resizeAmazonImage(s.imgUrl, 80)}
                          alt=""
                          aria-hidden
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded object-cover shrink-0 bg-wax"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-wax shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-cream text-sm font-medium truncate">{s.titulo}</p>
                        <p className="text-dust text-xs truncate">{s.artista}</p>
                      </div>
                      {s.preco !== null && (
                        <span className="text-gold text-sm font-semibold shrink-0 tabular-nums">
                          R${" "}
                          {s.preco.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Price threshold */}
        <div>
          <label htmlFor="max-price" className="block text-sm font-medium text-parchment mb-2">
            Preço limite (R$) <span className="text-cut" aria-hidden="true">*</span>
          </label>
          <input
            id="max-price"
            ref={priceInputRef}
            type="text"
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Ex: 89,90"
            className="w-full bg-sleeve border border-groove rounded-xl px-4 py-3 text-sm text-cream placeholder-dust focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
            required
            aria-required="true"
          />
          <p className="text-dust text-xs mt-1.5">
            Você recebe um e-mail quando o preço cair para este valor ou menos.
          </p>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-parchment mb-2">
            Seu e-mail <span className="text-cut" aria-hidden="true">*</span>
          </label>
          <input
            id="email"
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="w-full bg-sleeve border border-groove rounded-xl px-4 py-3 text-sm text-cream placeholder-dust focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-all"
            required
            aria-required="true"
          />
        </div>

        {formState === "error" && errorMsg && (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        )}

        {/* Consent */}
        <p className="text-dust text-xs leading-relaxed">
          Ao cadastrar, você concorda que o Garimpa Vinil armazene seu e-mail e a preferência
          de alerta para enviar a notificação solicitada — e nada mais. Você pode cancelar a
          qualquer momento pelo link em cada e-mail. Veja nossa{" "}
          <Link href="/politica-de-privacidade" className="text-gold hover:underline">
            Política de Privacidade
          </Link>
          . É necessário confirmar pelo e-mail que enviaremos.
        </p>

        <button
          type="submit"
          disabled={!selected || formState === "submitting"}
          className="flex items-center justify-center gap-2 bg-gold hover:bg-goldlit disabled:opacity-50 disabled:cursor-not-allowed text-record font-bold text-sm px-6 py-3.5 rounded-xl transition-colors cursor-pointer"
        >
          {formState === "submitting" ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Enviando…
            </>
          ) : "Criar alerta"}
        </button>
      </form>
    </main>
  );
}
