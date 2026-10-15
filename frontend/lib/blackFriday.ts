/**
 * Black Friday calendar. Mirrors crawler/bf_baseline.py — keep the two in step.
 *
 * Dates are calendar days in São Paulo, handled as UTC-midnight Date objects so
 * the arithmetic never crosses a DST or offset boundary.
 */

export type BfPhase = "antes" | "agora" | "depois";

export type BfSeason = {
  year: number;
  phase: BfPhase;
  blackFriday: Date;
  weekStart: Date;
  cyberMonday: Date;
  /** First and last day (inclusive) of the reference-price window. */
  baselineStart: Date;
  baselineEnd: Date;
};

const DAY = 86_400_000;

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** The Friday after the fourth Thursday of November (US Thanksgiving). */
export function blackFridayDate(year: number): Date {
  const first = utcDate(year, 10, 1);
  const firstThursday = 1 + ((4 - first.getUTCDay() + 7) % 7);
  return utcDate(year, 10, firstThursday + 22);
}

function todayInSaoPaulo(now: Date): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
    .format(now)
    .split("-")
    .map(Number);
  return utcDate(y, m - 1, d);
}

/**
 * Which Black Friday the page is about, and where we are relative to it.
 *
 * The reference window (1 Sep – 15 Oct) closes before Amazon's "esquenta":
 * in 2025 it started somewhere between 21 Oct and 3 Nov, and sale prices
 * inside the window would shrink every discount measured against it.
 *
 * September up to 31 Oct → "antes"; 1 Nov through Cyber Monday → "agora", since
 * the store's deals run for weeks before the Friday; the rest of the year →
 * "depois", pointing at the last edition.
 */
export function bfSeason(now: Date = new Date()): BfSeason {
  const today = todayInSaoPaulo(now);
  const thisYear = today.getUTCFullYear();
  const year = today.getUTCMonth() >= 8 ? thisYear : thisYear - 1;
  const blackFriday = blackFridayDate(year);
  const weekStart = new Date(blackFriday.getTime() - 4 * DAY);
  const cyberMonday = new Date(blackFriday.getTime() + 3 * DAY);
  const novembro = utcDate(year, 10, 1);
  const phase: BfPhase =
    year < thisYear || today > cyberMonday ? "depois" : today < novembro ? "antes" : "agora";
  return {
    year, phase, blackFriday, weekStart, cyberMonday,
    baselineStart: utcDate(year, 8, 1),
    baselineEnd: utcDate(year, 9, 15),
  };
}

/** "27 de novembro" */
export function diaMes(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "UTC" });
  // pt-BR writes the first of the month as an ordinal: "1º de setembro".
  return s.replace(/^1 de/, "1º de");
}
