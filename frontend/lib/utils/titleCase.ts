// Roman numerals kept fully uppercase
const ROMAN_RE = /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;

// Short conjunctions/prepositions lowercased mid-title (Portuguese + English)
const STAY_LOWER = new Set([
  "a", "à", "ao", "aos", "as", "às",
  "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os",
  "and", "an", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet",
]);

function capWord(word: string, isFirst: boolean): string {
  if (!word) return word;

  // Handle hyphens: Jean-Michel → "Jean-Michel"
  if (word.includes("-")) {
    return word.split("-").map((part, i) => capWord(part, i === 0 || isFirst)).join("-");
  }

  // Handle apostrophes: O'Connor → "O'Connor"
  if (word.includes("'")) {
    const parts = word.split("'");
    return parts.map((part, i) => capWord(part, i === 0 || isFirst)).join("'");
  }

  const lower = word.toLowerCase();

  // Keep Roman numerals uppercase (II, III, IV, etc.) — must be non-empty match
  if (lower.length >= 2 && ROMAN_RE.test(lower)) return word.toUpperCase();

  // Small words stay lower unless they're the first word
  if (!isFirst && STAY_LOWER.has(lower)) return lower;

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Applies title case to a string.
 * Handles: hyphens, apostrophes, Roman numerals, Portuguese/English small words.
 * Does NOT try to detect band-name acronyms like AC/DC — those need a custom mapping.
 */
export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .trim()
    .split(/\s+/)
    .map((word, i) => capWord(word, i === 0))
    .join(" ");
}
