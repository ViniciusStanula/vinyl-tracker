"use client";

import { useState } from "react";

export interface Track {
  title: string;
  length: number | null; // milliseconds
  /** Vinyl side position from Discogs: "A1", "B2", "C1"… Absent for
   *  MusicBrainz tracklists, which are a flat list with no side information. */
  position?: string | null;
}

/** Side letter of a Discogs position, or null for a flat tracklist. */
function sideOf(position: string | null | undefined): string | null {
  const m = /^([A-Z])\d/.exec((position ?? "").trim());
  return m ? m[1] : null;
}

/** Human label for a side.
 *
 *  Two sides is one LP, so "Lado A" is unambiguous. Beyond that the record is
 *  a multi-disc set and the letter alone stops being readable — Starfield ships
 *  as 6 LPs with sides A through L. Pair the letters into discs so it reads
 *  "LP 2 · Lado C" rather than asking anyone to count the alphabet.
 */
function sideLabel(letter: string, totalSides: number): string {
  if (totalSides <= 2) return `Lado ${letter}`;
  const index = letter.charCodeAt(0) - 65; // A = 0
  return `LP ${Math.floor(index / 2) + 1} · Lado ${letter}`;
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

  // Side headings only when every shown track carries a position — a partial
  // set would render an orphan heading over an unlabelled run of tracks.
  const sides = shown.map((t) => sideOf(t.position));
  const hasSides = sides.length > 0 && sides.every(Boolean);
  const totalSides = new Set(tracks.map((t) => sideOf(t.position)).filter(Boolean)).size;

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
        {shown.map((track, i) => {
          const side = sides[i];
          const newSide = hasSides && side !== sides[i - 1];
          return (
            <li key={i}>
              {newSide && (
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dust mt-4 first:mt-0 mb-1.5">
                  {sideLabel(side as string, totalSides)}
                </p>
              )}
              <div className="flex gap-3 items-baseline">
                <span className="text-parchment tabular-nums w-7 text-right shrink-0">
                  {hasSides ? track.position : i + 1}
                </span>
                <span className="text-cream flex-1 min-w-0">{track.title}</span>
                {track.length != null && (
                  <span className="text-dust tabular-nums shrink-0">{fmtTrack(track.length)}</span>
                )}
              </div>
            </li>
          );
        })}
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
