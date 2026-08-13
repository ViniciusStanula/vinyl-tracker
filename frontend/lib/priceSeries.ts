const BRT = "America/Sao_Paulo";

/**
 * Reduces a price history to what the page actually renders: the first
 * observation of each BRT day, plus every observation whose price differs from
 * the one before it.
 *
 * The crawler checks a record ~5.3 times a day and 89% of those checks record an
 * unchanged price, so plotting every observation drew an average of 435 points
 * to convey 42 distinct prices. Each new point also changed the page, and Vercel
 * bills an ISR write only when the regenerated output differs — a page that
 * never stops changing never earns a free rebuild.
 *
 * Taking the FIRST observation of a day rather than the latest is what makes it
 * work: once written, a point never changes again, so the page settles instead
 * of being rewritten on every check. A price move still shows up the moment it
 * happens, because a change always earns its own point.
 *
 * Current/min/max are unaffected by the reduction: a distinct price always
 * enters at the observation where it first appears, so those values are
 * identical to the ones the full history would give. Only a mean over the
 * points shifts, and it shifts towards one-sample-per-day rather than towards
 * however often the crawler happened to look.
 *
 * Expects `precos` ordered by capturadoEm ascending, as getDiscoWithPrecos
 * returns them.
 */
export function reduzirSeriePrecos<T extends { capturadoEm: Date; precoBrl: unknown }>(
  precos: readonly T[],
): T[] {
  const out: T[] = [];
  let diaAnterior: string | null = null;
  let precoAnterior: number | null = null;

  for (const p of precos) {
    // en-CA gives YYYY-MM-DD, so day keys compare as plain strings.
    const dia = p.capturadoEm.toLocaleDateString("en-CA", { timeZone: BRT });
    const preco = Number(p.precoBrl);
    if (dia !== diaAnterior || preco !== precoAnterior) out.push(p);
    diaAnterior = dia;
    precoAnterior = preco;
  }

  return out;
}
