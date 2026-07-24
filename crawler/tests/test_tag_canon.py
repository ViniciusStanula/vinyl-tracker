"""tag_canon rules — variants fold, non-genres drop, long tail drops."""
import pytest

from tag_canon import Canonicaliser, build_variant_map, slugify_style

# A miniature corpus. Counts are catalog-wide use counts, as the real caller
# passes them.
COUNTS = {
    "rock": 5538,
    "hip-hop": 1611,
    "hip hop": 44,
    "hiphop": 1,
    "post-rock": 177,
    "post rock": 15,
    "shania twain": 300,      # frequent, but an artist name
    "blackgaze": 2,           # real genre, too rare to show
    "arniecore": 1,           # junk
    "jazz": 2200,
}
NON_GENRE = {"shania-twain"}


@pytest.fixture
def canon():
    return Canonicaliser(COUNTS, non_genre_slugs=NON_GENRE)


class TestSlugify:
    # Must match frontend/lib/utils/styleUtils.ts slugifyStyle.
    @pytest.mark.parametrize("tag,slug", [
        ("Hip-Hop", "hip-hop"),
        ("Música Popular", "musica-popular"),
        ("R&B", "r-b"),
        ("  spaced  out  ", "spaced-out"),
    ])
    def test_matches_frontend(self, tag, slug):
        assert slugify_style(tag) == slug


class TestVariantFolding:
    def test_most_used_spelling_wins(self):
        m = build_variant_map(COUNTS)
        assert m["hip hop"] == "hip-hop"
        assert m["hiphop"] == "hip-hop"
        assert "hip-hop" not in m          # the winner is not remapped

    def test_row_tag_is_rewritten(self, canon):
        out, changes = canon.apply("hip hop, rock")
        assert out == "hip-hop, rock"
        assert changes["hip hop"] == "-> hip-hop"

    def test_folding_rescues_a_tag_from_the_threshold(self, canon):
        # "hiphop" alone is used once and would drop; folded into hip-hop it
        # survives. Folding must therefore run BEFORE the threshold test.
        out, _ = canon.apply("hiphop")
        assert out == "hip-hop"

    def test_fold_collision_on_one_row_dedupes(self, canon):
        out, changes = canon.apply("hip-hop, hip hop")
        assert out == "hip-hop"
        assert changes["hip hop"] == "duplicate-after-fold"


class TestNonGenre:
    def test_artist_name_dropped_however_frequent(self, canon):
        out, changes = canon.apply("shania twain, rock")
        assert out == "rock"
        assert changes["shania twain"] == "non-genre"


class TestLongTail:
    def test_rare_tag_dropped(self, canon):
        out, changes = canon.apply("rock, arniecore")
        assert out == "rock"
        assert changes["arniecore"] == "below-threshold"

    def test_real_but_rare_genre_also_dropped(self, canon):
        # Deliberate: the frontend already hides these. Documenting the cost.
        out, changes = canon.apply("blackgaze")
        assert out == ""
        assert changes["blackgaze"] == "below-threshold"


class TestNoOpAndEdges:
    def test_clean_row_is_untouched(self, canon):
        out, changes = canon.apply("rock, jazz")
        assert out == "rock, jazz"
        assert changes == {}

    @pytest.mark.parametrize("value", [None, "", "   ", ",,"])
    def test_empty_inputs(self, canon, value):
        out, changes = canon.apply(value)
        assert out == ""
        assert changes == {}

    def test_row_can_end_up_empty(self, canon):
        out, _ = canon.apply("arniecore")
        assert out == ""
