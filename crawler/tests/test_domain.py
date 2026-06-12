import pytest
from bs4 import BeautifulSoup
from domain import (
    is_vinyl,
    detect_format,
    normalize_artist,
    parse_price_br,
    is_fake_artist,
    _is_plausible_artist,
    UNKNOWN_ARTIST,
)


def _soup(html: str):
    return BeautifulSoup(html, "lxml")


# ─── parse_price_br ──────────────────────────────────────────────────────────

class TestParsePriceBr:
    def test_standard_br_format(self):
        assert parse_price_br("R$ 189,90") == 189.90

    def test_no_currency_symbol(self):
        assert parse_price_br("49,99") == 49.99

    def test_thousands_separator(self):
        assert parse_price_br("R$ 1.299,00") == 1299.00

    def test_empty_string_returns_none(self):
        assert parse_price_br("") is None

    def test_garbage_returns_none(self):
        assert parse_price_br("sem preço") is None

    def test_none_input_returns_none(self):
        assert parse_price_br(None) is None


# ─── is_vinyl ────────────────────────────────────────────────────────────────

class TestIsVinyl:
    def test_explicit_vinil_word_in_title(self):
        assert is_vinyl("Pink Floyd - The Wall - Disco de Vinil LP") is True

    def test_cd_in_title_rejected(self):
        assert is_vinyl("The Beatles Abbey Road CD") is False

    def test_lp_keyword_accepted(self):
        assert is_vinyl("Led Zeppelin IV LP 180g") is True

    def test_180g_accepted(self):
        assert is_vinyl("Dark Side of the Moon 180g") is True

    def test_rpm_accepted(self):
        assert is_vinyl("Single 7\" 45rpm") is True

    def test_compact_disc_rejected(self):
        assert is_vinyl("Compact Disc Edition Remastered") is False

    def test_ambiguous_title_defaults_true(self):
        # Title with no vinyl OR CD keyword → function returns True (give benefit of doubt)
        assert is_vinyl("Billie Eilish - Happier Than Ever") is True


# ─── detect_format (CD-leak audit, 2026-06-12) ───────────────────────────────

class TestDetectFormat:
    # Title signals (no soup)
    def test_title_cd_keyword(self):
        assert detect_format("Box Metallica - The Metallica Blacklist 4 CDs") == "cd"

    def test_title_vinyl_keyword(self):
        assert detect_format("Abbey Road [Disco de Vinil]") == "vinyl"

    def test_silent_title_no_soup_is_unknown(self):
        assert detect_format("Adele - 30") == "unknown"

    # Selected swatch — pt-BR label "CD de áudio" (regression: \x08 bytes made
    # the cd/mp3/dvd/digital alternatives of _FORMAT_NONVINYL_RE unmatchable)
    def test_selected_swatch_cd_de_audio(self):
        html = (
            '<div id="tmmSwatches">'
            '<div class="swatchElement selected"><span>CD de áudio R$ 69,82</span></div>'
            "</div>"
        )
        assert detect_format("Adele - 30", _soup(html)) == "cd"

    def test_selected_swatch_vinyl(self):
        html = (
            '<div id="tmmSwatches">'
            '<div class="swatchElement selected"><span>Disco de Vinil R$ 199,00</span></div>'
            "</div>"
        )
        assert detect_format("Abbey Road", _soup(html)) == "vinyl"

    # Sibling-variant: vinyl swatch links a DIFFERENT ASIN → this ASIN is the
    # non-vinyl variant
    def test_vinyl_sibling_swatch_means_cd(self):
        html = (
            '<div id="tmmSwatches">'
            '<div class="swatchElement"><a href="/Album-Vinil/dp/B000OTHER01/ref=x">'
            "Disco de Vinil R$ 219,00</a></div>"
            "</div>"
        )
        assert detect_format("Some Album", _soup(html), asin="B000THISCD") == "cd"

    def test_vinyl_swatch_own_asin_not_sibling(self):
        html = (
            '<div id="tmmSwatches">'
            '<div class="swatchElement"><a href="/dp/B000THISLP">Disco de Vinil</a></div>'
            "</div>"
        )
        assert detect_format("Some Album", _soup(html), asin="B000THISLP") == "unknown"

    # Details "Formato" row (single-format pages)
    def test_details_row_audio_cd(self):
        html = '<div id="detailBullets_feature_div">Formato : Áudio CD</div>'
        assert detect_format("Silent Title", _soup(html)) == "cd"

    def test_details_row_vinil(self):
        html = '<div id="detailBullets_feature_div">Formato : Vinil</div>'
        assert detect_format("Silent Title", _soup(html)) == "vinyl"

    # Breadcrumb regression: root category "CD e Vinil" appears on every BR
    # music product and must NOT count as vinyl evidence
    def test_breadcrumb_cd_e_vinil_is_not_vinyl_evidence(self):
        html = (
            '<div id="wayfinding-breadcrumbs_feature_div">'
            "CD e Vinil › Hard Rock e Metal › Heavy Metal</div>"
            '<div id="detailBullets_feature_div">Peso do produto : 100 g</div>'
        )
        assert detect_format("Countdown To Extinction [Remastered]", _soup(html)) == "unknown"


# ─── normalize_artist ────────────────────────────────────────────────────────

class TestNormalizeArtist:
    def test_inverted_last_first(self):
        assert normalize_artist("SWIFT,TAYLOR") == "Taylor Swift"

    def test_inverted_with_space_after_comma(self):
        assert normalize_artist("ZEPPELIN, LED") == "Led Zeppelin"

    def test_all_caps_converted_to_title_case(self):
        assert normalize_artist("LED ZEPPELIN") == "Led Zeppelin"

    def test_short_all_caps_preserved(self):
        # ABBA has 4 alpha chars — threshold is > 4, so ABBA stays
        assert normalize_artist("ABBA") == "ABBA"

    def test_unknown_artist_preserved(self):
        assert normalize_artist(UNKNOWN_ARTIST) == UNKNOWN_ARTIST

    def test_none_preserved(self):
        assert normalize_artist(None) is None

    def test_empty_string_preserved(self):
        assert normalize_artist("") == ""

    def test_normal_name_unchanged(self):
        assert normalize_artist("Taylor Swift") == "Taylor Swift"

    def test_connector_words_lowercase(self):
        result = normalize_artist("GUNS AND ROSES")
        assert result == "Guns and Roses"


# ─── is_fake_artist ──────────────────────────────────────────────────────────

class TestIsFakeArtist:
    def test_price_phrase_detected(self):
        assert is_fake_artist("R$ 49,90 sem juros") is True

    def test_amazon_promo_phrase_detected(self):
        assert is_fake_artist("Ouça com Amazon Music") is True

    def test_date_prefix_detected(self):
        assert is_fake_artist("13 mai. entrega grátis") is True

    def test_valid_artist_not_fake(self):
        assert is_fake_artist("Miles Davis") is False

    def test_empty_string_not_fake(self):
        assert is_fake_artist("") is False

    def test_sponsored_label_detected(self):
        assert is_fake_artist("Patrocinado pela Amazon") is True


# ─── _is_plausible_artist ────────────────────────────────────────────────────

class TestIsPlausibleArtist:
    def test_valid_artist_plausible(self):
        assert _is_plausible_artist("David Bowie") is True

    def test_price_string_not_plausible(self):
        assert _is_plausible_artist("R$ 29,90") is False

    def test_numbers_only_not_plausible(self):
        assert _is_plausible_artist("123456") is False

    def test_empty_string_not_plausible(self):
        assert _is_plausible_artist("") is False

    def test_too_long_not_plausible(self):
        assert _is_plausible_artist("A" * 121) is False

    def test_embedded_price_not_plausible(self):
        assert _is_plausible_artist("preco 49,90") is False
