"use client";

import { useState } from "react";

export interface Track {
  title: string;
  length: number | null; // milliseconds
}

interface Props {
  tracks: Track[];
  previewCount?: number;
}

function fmtTrack(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtTotal(ms: number): string {
  const min = Math.round(ms / 60000);
  return `${min} min`;
}

export default function Tracklist({ tracks, previewCount = 8 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const needsCollapse = tracks.length > previewCount;
  const shown = needsCollapse && !expanded ? tracks.slice(0, previewCount) : tracks;
  const totalMs = tracks.reduce((sum, t) => sum + (t.length ?? 0), 0);

  return (
    <div className="mt-4 pt-4 border-t border-groove">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-dust uppercase tracking-wide">Faixas</h3>
        {totalMs > 0 && (
          <span className="text-xs text-dust tabular-nums">
            {tracks.length} faixas · {fmtTotal(totalMs)}
          </span>
        )}
      </div>
      <ol className="space-y-1.5 text-sm">
        {shown.map((track, i) => (
          <li key={i} className="flex gap-3 items-baseline">
            <span className="text-parchment tabular-nums w-5 text-right shrink-0">{i + 1}</span>
            <span className="text-cream flex-1 min-w-0">{track.title}</span>
            {track.length != null && (
              <span className="text-dust tabular-nums shrink-0">{fmtTrack(track.length)}</span>
            )}
          </li>
        ))}
      </ol>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-gold hover:text-parchment transition-colors font-medium"
        >
          {expanded ? "Ver menos" : `Ver todas as ${tracks.length} faixas`}
        </button>
      )}
    </div>
  );
}
