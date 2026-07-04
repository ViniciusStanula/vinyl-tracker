"""Tests for lastfm.clean_album_title — edition/format junk stripping.

Guards two directions:
  STRIP    — junk that blocks Last.fm matches must be removed.
  PRESERVE — real album titles (esp. ones ending in colour words) must survive.
"""
import pytest

from lastfm import clean_album_title as C

# (artist, raw_title, expected_clean)
STRIP_CASES = [
    # separators
    ("Usher", "USHER / MY WAY", "MY WAY"),
    # brazilian parentheticals
    ("Nick Cave & the Bad Seeds", "LP THE GOOD SON (NACIONAL)", "THE GOOD SON"),
    ("Engenheiros do Hawaii", "LP TCHAU RADAR (DUPLO) (NACIONAL)", "TCHAU RADAR"),
    # trailing hard format tokens (bare, no brackets)
    ("Why Don't We", "8 Letters vinyl", "8 Letters"),
    ("Patrice Rushen", "posh LP", "posh"),
    ("Niall Horan", "MELTDOWN 18cm", "MELTDOWN"),
    ("Cyndi Lauper", "Money Changes Everything 45 rpm", "Money Changes Everything"),
    ("Chase Atlantic", "LOST IN HEAVEN Vinyl LP", "LOST IN HEAVEN"),
    # trailing after dash
    ("Keane", "Cause and Effect - Boxset [VINYL] [Disco de Vinil]", "Cause and Effect"),
    ("Nothing But Thieves", "Moral Panic - Picture Disc", "Moral Panic"),
    # gram weight in parens
    ("Dominic Fike", "SUNBURN (150G)", "SUNBURN"),
    # leading format with dash
    ("Disney", "- Vinil Disney - The Little Mermaid", "The Little Mermaid"),
    # trailing "Limited" strips; " - Edition" caught by existing dash pass
    ("Blur", "Bustin' + Dronin' Limited", "Bustin' + Dronin'"),
    ("Nick Cave & the Bad Seeds", "The Good Son - Deluxe Edition", "The Good Son"),
    # Amazon "(X)" explicit marker
    ("Godsmack", "AWAKE (X) (2LP)", "AWAKE"),
    ("Jhené Aiko", "SAIL OUT (X)", "SAIL OUT"),
]

# titles ending in colour/loaded words that MUST survive untouched
PRESERVE_CASES = [
    ("Amy Winehouse", "Back to Black", "Back to Black"),
    ("Prince", "Purple Rain", "Purple Rain"),
    ("New Order", "Blue Monday", "Blue Monday"),
    ("Metallica", "Fade to Black", "Fade to Black"),
    ("Dua Lipa", "Dua Lipa", "Dua Lipa"),          # self-titled, never empty
    ("Radiohead", "OK Computer", "OK Computer"),
    ("Jay-Z", "The Blueprint", "The Blueprint"),   # 'blue' substring, not a word
    ("The Beatles", "Let It Be", "Let It Be"),
    # single-word titles that are also junk tokens must NOT be emptied
    ("K.Flay", "MONO - Coke Bottle Clear", "MONO"),
    ("Dexter and The Moonrocks", "The Double EP", "The Double EP"),  # never strip EP
]


@pytest.mark.parametrize("artist,raw,expected", STRIP_CASES)
def test_strip(artist, raw, expected):
    assert C(raw, artist) == expected


@pytest.mark.parametrize("artist,raw,expected", PRESERVE_CASES)
def test_preserve(artist, raw, expected):
    assert C(raw, artist) == expected


def test_never_empty():
    # all-junk title should not collapse to empty string
    assert C("Vinyl LP", "Some Artist") != ""
