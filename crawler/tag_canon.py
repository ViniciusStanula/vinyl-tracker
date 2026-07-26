"""
tag_canon.py — canonical form for a Disco.lastfm_tags value.

Three problems in the tag vocabulary, three deliberately narrow rules. Nothing
here makes a taste judgement about whether a word is "really" a genre; every
rule is either objective (two spellings of one tag) or defers to a threshold the
frontend already enforces.

  1. VARIANTS — "hip hop" / "hiphop" / "hip-hop" are one tag stored three ways.
     Folding them consolidates counts, which can lift a tag above the visibility
     threshold rather than losing it. Derived by normalising away spacing,
     hyphens, accents and trailing plurals, then keeping the most-used spelling.

  2. NON-GENRES — tags that are artist names, not styles ("shania twain",
     "within temptation"). The frontend already curated 256 of these into
     REDIRECTED_ESTILO_SLUGS to keep them off /estilo listings. That list is the
     source of truth and lives here now, in tag_canon.json, so the data can be
     fixed instead of filtered at render time.

  3. LONG TAIL — 1,143 of 1,807 tags are used 3 times or fewer and account for
     2.2% of all tag uses. lib/db/estilo.ts already excludes them from the
     /estilo index with HAVING COUNT(*) > 3, so they are invisible there — but
     StyleTags renders every tag on a record page, each linking to a
     near-empty /estilo page. Dropping them makes the data agree with the
     visibility rule the frontend already applies.

Order matters: fold variants FIRST so consolidated counts are used for the
threshold test, then drop. A tag rescued by folding must not then be dropped on
its pre-fold count.

Counts are passed in rather than computed here so the caller controls the
corpus (the whole catalog, not one row) and the module stays pure/testable.
"""
import os
import re
import json
import unicodedata

_HERE = os.path.dirname(os.path.abspath(__file__))
CANON_PATH = os.path.join(_HERE, "tag_canon.json")

# Below this many uses across the catalog a tag is dropped. Matches the
# HAVING COUNT(*) > 3 in frontend/lib/db/estilo.ts — raising one without the
# other reintroduces the mismatch this module exists to remove.
MIN_USES = 4


def slugify_style(tag: str) -> str:
    """Port of frontend/lib/utils/styleUtils.ts slugifyStyle. Must stay in step:
    non-genre tags are curated by slug, and a divergence here silently stops
    matching them."""
    t = unicodedata.normalize("NFD", tag)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return t.strip("-")


def variant_key(tag: str) -> str:
    """Fold spacing, punctuation, accents and a trailing plural."""
    t = unicodedata.normalize("NFKD", tag)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[\s\-_/&.']+", "", t.lower())
    return re.sub(r"s$", "", t)


def load_non_genre_slugs(path: str = CANON_PATH) -> set[str]:
    with open(path, encoding="utf-8") as fh:
        return set(json.load(fh)["non_genre_slugs"])


def build_variant_map(counts: dict[str, int]) -> dict[str, str]:
    """
    raw tag -> preferred spelling, for tags with more than one spelling.

    The most-used spelling wins; ties break alphabetically so the result is
    deterministic across runs.
    """
    groups: dict[str, list[str]] = {}
    for tag in counts:
        groups.setdefault(variant_key(tag), []).append(tag)

    mapping: dict[str, str] = {}
    for _key, variants in groups.items():
        if len(variants) < 2:
            continue
        winner = sorted(variants, key=lambda t: (-counts[t], t))[0]
        for v in variants:
            if v != winner:
                mapping[v] = winner
    return mapping


def folded_counts(counts: dict[str, int],
                  variant_map: dict[str, str]) -> dict[str, int]:
    """Counts after variants are merged into their preferred spelling."""
    out: dict[str, int] = {}
    for tag, n in counts.items():
        out[variant_map.get(tag, tag)] = out.get(variant_map.get(tag, tag), 0) + n
    return out


class Canonicaliser:
    """Applies the three rules to one row's tag list."""

    def __init__(self, counts: dict[str, int], non_genre_slugs: set[str] | None = None,
                 min_uses: int = MIN_USES):
        self.variant_map = build_variant_map(counts)
        self.counts = folded_counts(counts, self.variant_map)
        self.non_genre = (non_genre_slugs if non_genre_slugs is not None
                          else load_non_genre_slugs())
        self.min_uses = min_uses

    def classify(self, tag: str) -> tuple[str | None, str]:
        """
        Returns (canonical_tag_or_None, reason). None means drop.
        """
        t = tag.strip()
        if not t:
            return None, "empty"

        folded = self.variant_map.get(t, t)
        reason = "variant" if folded != t else "kept"

        if slugify_style(folded) in self.non_genre:
            return None, "non-genre"

        if self.counts.get(folded, 0) < self.min_uses:
            return None, "below-threshold"

        return folded, reason

    def apply(self, lastfm_tags: str | None) -> tuple[str, dict[str, str]]:
        """
        Canonicalises one comma-joined tag string.
        Returns (new_string, {original_tag: reason}) for every tag changed or
        dropped — the caller logs it, so a cleanup is always explainable.
        """
        if not lastfm_tags:
            return "", {}

        out: list[str] = []
        seen: set[str] = set()
        changes: dict[str, str] = {}

        for raw in lastfm_tags.split(","):
            t = raw.strip()
            if not t:
                continue
            canon, reason = self.classify(t)
            if canon is None:
                changes[t] = reason
                continue
            if canon.lower() in seen:
                # Folding can collide two spellings already on the same row.
                changes[t] = "duplicate-after-fold"
                continue
            seen.add(canon.lower())
            if canon != t:
                changes[t] = f"-> {canon}"
            out.append(canon)

        return ", ".join(out), changes
