"use client";

import { useState } from "react";

interface PricePoint {
  data: string;      // e.g. "13/04"
  dataFull: string;  // e.g. "13/04/2026"
  valor: number;
}

interface Props {
  precos: PricePoint[];
}

const W = 500;
const H = 160;
const PAD = { top: 12, right: 16, bottom: 32, left: 70 };
const cW = W - PAD.left - PAD.right;
const cH = H - PAD.top - PAD.bottom;

export default function GraficoPreco({ precos }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (precos.length < 2) {
    return (
      <p className="text-center py-6 text-dust text-sm">
        Aguardando mais registros para exibir o gráfico.
      </p>
    );
  }

  const valores = precos.map((p) => p.valor);
  const vMin = Math.min(...valores);
  const vMax = Math.max(...valores);
  const yMin = vMin * 0.80;
  const yMax = vMax * 1.10;
  const yRange = yMax - yMin;

  const tx = (i: number) =>
    PAD.left + (i / (precos.length - 1)) * cW;
  const ty = (v: number) =>
    PAD.top + (1 - (v - yMin) / yRange) * cH;

  const linePath = precos
    .map((p, i) => `${i === 0 ? "M" : "L"} ${tx(i).toFixed(1)} ${ty(p.valor).toFixed(1)}`)
    .join(" ");
  const fillPath =
    linePath +
    ` L ${tx(precos.length - 1).toFixed(1)} ${(H - PAD.bottom).toFixed(1)}` +
    ` L ${tx(0).toFixed(1)} ${(H - PAD.bottom).toFixed(1)} Z`;

  // Y ticks — 4 evenly spaced
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const v = yMin + (yRange * i) / 4;
    return {
      y: ty(v),
      label: `R$ ${Math.round(v)}`,
    };
  }).reverse();

  // X ticks — at most 4, evenly spaced
  const xTickCount = Math.min(4, precos.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1)) * (precos.length - 1));
    return { x: tx(idx), label: precos[idx].data };
  });

  // Indices for min and max annotation markers
  const minIdx = valores.reduce((best, v, i) => v < valores[best] ? i : best, 0);
  const maxIdx = valores.reduce((best, v, i) => v > valores[best] ? i : best, 0);
  const hasRange = vMin !== vMax;

  const hovered = hoveredIdx !== null ? precos[hoveredIdx] : null;
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="select-none">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Gráfico de evolução de preços"
      >
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d98f0e" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#d98f0e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={tick.y}
              x2={W - PAD.right}
              y2={tick.y}
              stroke="#2b1e17"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <text
              x={PAD.left - 6}
              y={tick.y + 3.5}
              textAnchor="end"
              fill="#6e4e38"
              fontSize="8.5"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fill="#5a4232"
            fontSize="8"
          >
            {tick.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={fillPath} fill="url(#pg)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#d98f0e"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Min annotation — green dot + label */}
        {hasRange && (
          <g>
            <circle
              cx={tx(minIdx)}
              cy={ty(vMin)}
              r="5"
              fill="#35c47a"
              stroke="#0c0a08"
              strokeWidth="1.5"
            />
            <text
              x={tx(minIdx)}
              y={ty(vMin) + 15}
              textAnchor="middle"
              fill="#35c47a"
              fontSize="8"
              fontWeight="600"
            >
              Mín.
            </text>
          </g>
        )}

        {/* Max annotation — red dot + label */}
        {hasRange && (
          <g>
            <circle
              cx={tx(maxIdx)}
              cy={ty(vMax)}
              r="5"
              fill="#b81828"
              stroke="#0c0a08"
              strokeWidth="1.5"
            />
            <text
              x={tx(maxIdx)}
              y={ty(vMax) - 9}
              textAnchor="middle"
              fill="#b81828"
              fontSize="8"
              fontWeight="600"
            >
              Máx.
            </text>
          </g>
        )}

        {/* Hover crosshair */}
        {hoveredIdx !== null && (
          <>
            <line
              x1={tx(hoveredIdx)}
              y1={PAD.top}
              x2={tx(hoveredIdx)}
              y2={H - PAD.bottom}
              stroke="#d98f0e"
              strokeWidth="1"
              strokeDasharray="3,2"
              opacity="0.5"
            />
            <circle
              cx={tx(hoveredIdx)}
              cy={ty(precos[hoveredIdx].valor)}
              r="4.5"
              fill="#d98f0e"
              stroke="#0c0a08"
              strokeWidth="2"
            />
          </>
        )}

        {/* Invisible hit rect for hover detection */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={cW}
          height={cH}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const idx = Math.max(
              0,
              Math.min(
                precos.length - 1,
                Math.round(ratio * (precos.length - 1))
              )
            );
            setHoveredIdx(idx);
          }}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      </svg>

      {/* Tooltip row */}
      <div className="h-6 flex items-center justify-center gap-2 text-xs">
        {hovered ? (
          <>
            <span className="text-gold font-bold tabular-nums">{fmt(hovered.valor)}</span>
            <span className="text-dust">·</span>
            <span className="text-parchment">{hovered.dataFull}</span>
          </>
        ) : (
          <span className="text-ash">Passe o mouse para ver o valor</span>
        )}
      </div>
    </div>
  );
}
