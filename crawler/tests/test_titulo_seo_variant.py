"""Weight, reissue and the vaguest edition label — the three facts added on top
of the existing cor/edicao/versao rules.

They exist as separate fields because they co-occur constantly: the single most
common discogs_format_desc on the catalog is the shape
"LP, Album, Reissue, Stereo, 180g", which is all three at once.
"""
import pytest

from titulo_seo import compose, resolve_variant


def variant(fmt_desc, titulo="Some Album", artista="Some Artist"):
    return resolve_variant(artista, titulo, fmt_desc)


class TestGramatura:
    @pytest.mark.parametrize(
        "fmt_desc, esperado",
        [
            ("LP, Album, Reissue, Stereo, 180g", "180g"),
            ("LP, Album, Reissue, 180 Gram", "180g"),
            ("LP, Album, 180 g", "180g"),
            ("2xLP, Album, 200g", "200g"),
            ("LP, Album, 200 Gram, Limited Edition", "200g"),
            ("LP, Album, Reissue", None),
            ("LP, Album, 140g", None),
        ],
    )
    def test_spellings(self, fmt_desc, esperado):
        assert variant(fmt_desc)[3] == esperado

    def test_200g_wins_over_180g(self):
        # A "180g or 200g" listing is claiming the heavier of the two.
        assert variant("LP, 180g, 200g")[3] == "200g"

    def test_falls_back_to_titulo(self):
        # The docstring's own example: "Killers[180g LP]".
        assert variant(None, titulo="Killers [180g LP]")[3] == "180g"

    def test_titulo_ignored_when_fmt_desc_answers(self):
        assert variant("LP, Album, 200g", titulo="Killers [180g LP]")[3] == "200g"


class TestReedicao:
    @pytest.mark.parametrize(
        "fmt_desc, esperado",
        [
            ("LP, Album, Reissue, Stereo, 180g", True),
            ("LP, Album, Repress", True),
            ("LP, Album, Re-Edition", True),
            ("LP, Album, Limited Edition", False),
            ("LP, Album", False),
        ],
    )
    def test_from_fmt_desc(self, fmt_desc, esperado):
        assert variant(fmt_desc)[4] is esperado

    def test_unknown_without_fmt_desc(self):
        # None, not False. A record Discogs never resolved is not evidence of
        # an original pressing, and the decade pages count on that difference.
        assert variant(None)[4] is None

    def test_titulo_never_consulted(self):
        assert variant(None, titulo="Abbey Road (Reissue)")[4] is None


class TestEdicaoLimitada:
    def test_recognised(self):
        assert variant("LP, Album, Limited Edition")[1] == "Edição Limitada"

    @pytest.mark.parametrize(
        "fmt_desc, esperado",
        [
            ("LP, Limited Edition, Numbered", "Numerado"),
            ("LP, Limited Edition, Picture Disc", "Picture Disc"),
            ("LP, Limited Edition, Box Set", "Box Set"),
            ("LP, Limited Edition, Deluxe Edition", "Edição Deluxe"),
        ],
    )
    def test_yields_to_more_specific_labels(self, fmt_desc, esperado):
        assert variant(fmt_desc)[1] == esperado


class TestVagueLabelDoesNotShadowTitulo:
    """Both regressions the first catalog dry run of "Edição Limitada" caused."""

    def test_boxset_in_titulo_beats_limited_in_fmt_desc(self):
        cor, edicao, *_ = resolve_variant(
            "The Rolling Stones",
            'The Rolling Stones Singles 1966-1971[18 x 7" Single Boxset]',
            "Compilation, Limited Edition, Stereo, Mono",
        )
        assert edicao == "Box Set"

    def test_deluxe_in_titulo_beats_limited_in_fmt_desc(self):
        cor, edicao, *_ = resolve_variant(
            "Various Artists",
            "Major League 2--Deluxe & Expanded Soundtrack & Score (DELUXE EDITION, HALF-RED)",
            '2xLP, 12", Limited Edition, Half Red, Half Blue',
        )
        assert edicao == "Edição Deluxe"

    def test_fmt_desc_still_wins_when_both_are_specific(self):
        # Source trust is unchanged outside the vague-label case: a specific
        # fmt_desc label is believed over a different specific one in the
        # título, whatever their relative rank.
        cor, edicao, *_ = resolve_variant(
            "Some Artist", "Some Album (Anniversary Edition)", "LP, Picture Disc",
        )
        assert edicao == "Picture Disc"

    def test_limited_still_applies_when_titulo_is_silent(self):
        assert variant("LP, Album, Limited Edition", titulo="Plain Album")[1] == "Edição Limitada"


class TestSuffix:
    def test_gramatura_appended_last(self):
        h1 = compose("Miles Davis", "Kind of Blue", "Kind of Blue", None,
                     "LP, Album, Limited Edition, Black, 180g")[0]
        assert h1 == "Kind of Blue (Vinil Preto, Edição Limitada, 180g)"

    def test_reedicao_absent_from_title(self):
        h1, _, _, _, _, _, reedicao = compose(
            "The Beatles", "Abbey Road", "Abbey Road", None, "LP, Album, Reissue"
        )
        assert reedicao is True
        assert "eedi" not in h1
        assert h1 == "Abbey Road"

    def test_plain_record_unchanged(self):
        assert compose("Some Artist", "Some Album", "Some Album", None, "LP, Album")[0] == "Some Album"
