"use client";

import { useState } from "react";

export interface Track {
  title: string;
  length: number | null; // milliseconds
  /** Vinyl side position from Discogs: "A1", "B2", "C1"… Absent for
   *  MusicBrainz tracklists, which are a flat list with no side information. */
  position?: string | null;
}

/** Which side of which disc a Discogs position belongs to, or null.
 *
 *  Real formats across ~13,000 stored positions:
 *
 *      A1        12,222   the norm
 *      (digits)     406   flat numbering, no sides — MusicBrainz fallback
 *      CD-1         125   a CD inside a vinyl box set, NOT a vinyl side
 *      A             98   a whole side is one track (side-long piece, 7")
 *      A-1           18   hyphenated
 *      1A, 2B        ~24  TRACK number first, then side letter
 *
 *  The first version matched only /^([A-Z])\d/, so everything except "A1" fell
 *  through — and because side headings required EVERY track to have one, a
 *  single "A" suppressed headings for the whole record.
 */
export function sideKey(position: string | null | undefined): string | null {
  const p = (position ?? "").trim().toUpperCase();
  if (!p) return null;
  // A CD bundled with the LPs is its own thing, not a lettered side.
  if (/^CD/.test(p)) return "CD";
  // "1A", "2B" — TRACK number first, side letter second. Verified against
  // Honky Tonk Christmas, whose positions run 1A 2A 3A 4A 5A 1B 2B 3B 4B 5B:
  // five tracks per side of one LP. Disc-first numbering would instead read
  // 1A 1B 2A 2B. Reading the digit as a disc turned that single LP into
  // "LP 1" through "LP 5".
  const trackFirst = /^\d+[-.]?([A-Z])$/.exec(p);
  if (trackFirst) return trackFirst[1];
  // "A1", "A-1", "A"
  const letterFirst = /^([A-Z])[-.]?\d*$/.exec(p);
  if (letterFirst) return letterFirst[1];
  return null;
}

/** Human label for a side key.
 *
 *  Two sides is one LP, so "Lado A" is unambiguous. Beyond that the letter
 *  alone stops being readable — Starfield ships as 6 LPs with sides A to L,
 *  and the catalogue holds sets up to 18 sides — so pair the letters into
 *  discs and say which LP it is.
 */
export function sideLabel(key: string, totalSides: number): string {
  if (key === "CD") return "CD";
  if (totalSides <= 2) return `Lado ${key}`;
  const index = key.charCodeAt(0) - 65; // A = 0
  return `LP ${Math.floor(index / 2) + 1} · Lado ${key}`;
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

  // Headings need most tracks to carry a side, not all: a vinyl box set with a
  // bonus CD legitimately mixes "A1" with "CD-1", and requiring every track to
  // have a lettered side suppressed headings for the entire record.
  const sides = shown.map((t) => sideKey(t.position));
  const known = sides.filter(Boolean).length;
  const hasSides = sides.length > 0 && known / sides.length >= 0.6;
  const totalSides = new Set(
    tracks.map((t) => sideKey(t.position)).filter((k) => k && k !== "CD")
  ).size;

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
              {/* Gap above every side but the first. `first:mt-0` did not work
                  here: the heading is always the first child of its own <li>,
                  so the modifier matched on every side and none got separated. */}
              {newSide && (
                <p
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-dust mb-1.5 ${
                    i === 0 ? "" : "mt-4"
                  }`}
                >
                  {sideLabel(side as string, totalSides)}
                </p>
              )}
              <div className="flex gap-3 items-baseline">
                {/* Plain numbers are right-aligned so 9 and 10 line up on the
                    units digit. Side codes are left-aligned instead: "A1" and
                    "B12" share a left edge, not a right one, and right-aligning
                    them pushed the codes away from the side heading above and
                    left a ragged edge down the column. */}
                <span
                  className={`text-parchment tabular-nums w-7 shrink-0 ${
                    hasSides ? "text-left" : "text-right"
                  }`}
                >
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
