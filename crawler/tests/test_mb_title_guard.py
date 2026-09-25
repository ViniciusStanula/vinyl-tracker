"""Tests for mb_enrich.title_matches_release — the MusicBrainz title guard."""
import pytest

from mb_enrich import title_matches_release as ok

# (mb_title, cleaned product title, artist, expected)
CASES = [
    # artist baked into the MB title still matches (why discounting exists)
    ("John Lennon/Plastic Ono Band", "Plastic Ono Band", "John Lennon", True),
    # self-titled product keeps its self-titled release-group
    ("Blind Faith", "Blind Faith (International Version)", "Blind Faith", True),
    ("Françoise Hardy", "Francoise Hardy", "Françoise Hardy", True),
    ("Djavan", "Djavan 1978", "Djavan", True),
    # a named album must not fall back to the self-titled one
    ("Bon Jovi", "New Jersey", "Bon Jovi", False),
    ("Bob Marley", "Bob Marley & The Wailers - Uprising", "Bob Marley", False),
    # a partial artist token is not the artist
    ("Big Stones", "Big Hits", "The Rolling Stones", False),
    ("Perez", "Chemistry", "Gigi Perez", False),
    ("7 Roses", "Perhaps (7)", "Guns N' Roses", False),
    # ordinary title match unchanged
    ("Hysteria", "Hysteria", "Def Leppard", True),
]


@pytest.mark.parametrize("mb_title,album,artist,expected", CASES)
def test_title_guard(mb_title, album, artist, expected):
    assert ok(mb_title, album, artist) is expected
