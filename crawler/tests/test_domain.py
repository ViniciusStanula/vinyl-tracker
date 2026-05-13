import pytest
from domain import (
    is_vinyl,
    normalize_artist,
    parse_price_br,
    is_fake_artist,
    _is_plausible_artist,
    UNKNOWN_ARTIST,
)


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
