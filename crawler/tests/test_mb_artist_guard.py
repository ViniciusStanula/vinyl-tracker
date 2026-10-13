"""Tests for mb_enrich.artist_credit_matches — the MusicBrainz artist guard."""
import pytest

from mb_enrich import artist_credit_matches as ok


def group(*credits):
    """A release-group dict with an artist-credit list of (name, sort-name, joinphrase)."""
    return {"artist-credit": [
        {"name": n, "joinphrase": j, "artist": {"name": n, "sort-name": s}}
        for n, s, j in credits
    ]}


CASES = [
    # wrong artist with a perfect title: the bug this guard closes
    ("Joy Division", group(("Febuary", "Febuary", "")), False),
    ("Pearl Jam", group(("Ten", "Ten", "")), False),
    ("Primal Scream", group(("Future", "Future", "")), False),
    ("Marillion", group(("Fugazi", "Fugazi", "")), False),
    # same artist, different spellings or fuller credits
    ("J.I.D", group(("JID", "JID", "")), True),
    ("Tom Petty", group(("Tom Petty and the Heartbreakers", "Petty, Tom and the Heartbreakers", "")), True),
    ("Siouxsie & The Banshees", group(("Siouxsie and the Banshees", "Siouxsie and the Banshees", "")), True),
    ("Abel Tesfaye, Daniel Lopatin",
     group(("Abel Tesfaye", "Tesfaye, Abel", " & "), ("Daniel Lopatin", "Lopatin, Daniel", "")), True),
    ("Françoise Hardy", group(("Francoise Hardy", "Hardy, Françoise", "")), True),
    # placeholders and missing data keep the old behaviour
    ("Various Artists", group(("Original Soundtrack", "Original Soundtrack", "")), True),
    ("Pearl Jam", {}, True),
]


@pytest.mark.parametrize("artist,grp,expected", CASES)
def test_artist_guard(artist, grp, expected):
    assert ok(artist, grp) is expected
