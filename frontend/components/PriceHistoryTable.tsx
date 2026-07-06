"use client";

import { useState } from "react";

interface PriceRow {
  dataFormatada: string;
  preco: number;
}

interface Props {
  rows: PriceRow[];
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PriceHistoryTable({ rows }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-dust hover:text-cream transition-colors select-none"
        aria-expanded={open}
        aria-controls="price-history-table"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        Ver todos os registros
      </button>

      {open && (
        <div id="price-history-table" className="mt-3 max-h-52 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <caption className="sr-only">Histórico de preços registrados, do mais recente ao mais antigo</caption>
            <thead>
              <tr className="text-dust border-b border-groove">
                <th scope="col" className="pb-2 font-medium">Data</th>
                <th scope="col" className="pb-2 font-medium text-right">Preço</th>
                <th scope="col" className="pb-2 font-medium text-right">Variação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const prev = rows[i + 1];
                const delta = prev ? row.preco - prev.preco : null;
                return (
                  <tr key={i} className="border-b border-groove/50">
                    <td className="py-1.5 text-dust">{row.dataFormatada}</td>
                    <td className="py-1.5 text-right font-medium text-cream tabular-nums">
                      {fmt(row.preco)}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        delta === null
                          ? "text-dust"
                          : delta > 0
                          ? "text-cut"
                          : delta < 0
                          ? "text-deallit"
                          : "text-dust"
                      }`}
                    >
                      {delta === null
                        ? "—"
                        : delta === 0
                        ? "="
                        : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
