"""
classify() precision regression (2026-07-24).

The seed's category used to be inherited by ANY result that merely said
"soundtrack", on the reasoning that the seed only searched for one. Amazon's
search is fuzzy and returns unrelated soundtracks for any query, so this
fabricated categories at scale: 4 in 5 of the live rows classified through that
branch were wrong — "Halloween Kills" and "You've Got Mail" were filed as game
records, "Dirty Dancing" as anime.

The category now requires the title to actually name the seed.
"""
import pytest

from soundtrack_discovery import (
    Seed,
    build_title_classifier,
    classify,
    SOUNDTRACK_TAG,
)

# A vocabulary standing in for soundtrack_seeds.json. Hades/Journey are flagged
# ambiguous exactly as they are in the real file — they are ordinary words.
SEEDS = [
    Seed("The Legend of Zelda", "title", "game", aliases=["Zelda"]),
    Seed("Studio Ghibli", "title", "anime"),
    Seed("Hades", "title", "game", ambiguous=True),
    Seed("Journey", "title", "game", ambiguous=True),
]
CLASSIFIER = build_title_classifier(SEEDS)

ZELDA, GHIBLI, HADES, JOURNEY = SEEDS


def tags_for(title, seed):
    return classify(title, seed, CLASSIFIER)[0]


class TestFranchiseNamed:
    def test_seed_name_in_title_keeps_category(self):
        assert tags_for("Hero of Time (Music from The Legend of Zelda)", ZELDA) == \
            [SOUNDTRACK_TAG, "game"]

    def test_alias_counts_as_the_franchise(self):
        assert tags_for("Zelda: Ocarina of Time (Original Soundtrack)", ZELDA) == \
            [SOUNDTRACK_TAG, "game"]


class TestAmbiguousSeedClaimsItsOwnName:
    # Ambiguous seeds are held out of the shared vocabulary, but the seed that
    # ran the search may still claim its own name when the title says it.
    def test_ambiguous_seed_named_in_title_keeps_category(self):
        assert tags_for("Hades Original Soundtrack 4xLP Smoke Grey Vinyl", HADES) == \
            [SOUNDTRACK_TAG, "game"]

    def test_ambiguous_seed_does_not_label_other_seeds_results(self):
        # "Hades" must not leak onto a Zelda search result.
        assert tags_for("Hades Original Soundtrack", ZELDA) == [SOUNDTRACK_TAG]


class TestFuzzySearchNoiseLosesTheCategory:
    """The actual production failures. Each was live and mis-tagged."""

    @pytest.mark.parametrize("title,seed", [
        ("Halloween Kills (Original Motion Picture Soundtrack)", HADES),
        ("YOU'VE GOT MAIL (Original Soundtrack) RUBY VINYL", HADES),
        ("Almost Famous Soundtrack - Exclusive Limited Edition", JOURNEY),
        ("Nekromantik (Original Soundtrack) [Limited Picture Disc]", JOURNEY),
        ("Deathloop (Original Soundtrack)", GHIBLI),
    ])
    def test_unrelated_soundtrack_is_soundtrack_only(self, title, seed):
        assert tags_for(title, seed) == [SOUNDTRACK_TAG]

    def test_generic_ost_title_is_soundtrack_only(self):
        # The case the old branch was written for. Still queued, still tagged a
        # soundtrack — just no invented category.
        assert tags_for("Original Soundtrack [LP]", HADES) == [SOUNDTRACK_TAG]


class TestNoSoundtrackEvidence:
    def test_unproven_record_stays_untagged(self):
        assert tags_for("Frontiers - 40th Anniversary (Remastered)", JOURNEY) is None


class TestContradictionStillReported:
    def test_different_franchise_in_title_is_a_conflict(self):
        tags, conflict = classify(
            "Studio Ghibli: Spirited Away (Original Soundtrack)", ZELDA, CLASSIFIER)
        assert tags is None
        assert "contradicted" in conflict
