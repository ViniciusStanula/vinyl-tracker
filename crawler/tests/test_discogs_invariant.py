from discogs_enrich import pressing_invariant


def rel(style=None, year=None, fmt=("Vinyl", "LP")):
    return {"style": list(style) if style else None, "year": year, "format": list(fmt)}


# Modelled on Utada "One Last Kiss", which Amazon has no barcode for. Artist +
# title returns six vinyl pressings — Europe, Japan x2, US x3 — that differ in
# colour, catalogue number and country but agree on styles and year.

class TestPressingInvariant:
    def test_takes_styles_and_year_when_all_pressings_agree(self):
        results = [rel(("J-pop", "Theme", "Anison"), 2021) for _ in range(6)]
        out = pressing_invariant(results)
        assert out["year"] == 2021
        assert out["styles"] == "Anison, J-pop, Theme"  # sorted for stability

    def test_drops_styles_when_pressings_disagree(self):
        results = [rel(("J-pop",), 2021), rel(("J-pop", "Anison"), 2021)]
        out = pressing_invariant(results)
        assert "styles" not in out
        assert out["year"] == 2021  # year still agreed

    def test_drops_year_when_pressings_disagree(self):
        # A reissue alongside the original: the album year is not knowable here.
        results = [rel(("Rock",), 1973), rel(("Rock",), 2024)]
        out = pressing_invariant(results)
        assert "year" not in out
        assert out["styles"] == "Rock"

    def test_a_single_pressing_is_not_consensus(self):
        # One hit proves nothing about what varies between pressings.
        assert pressing_invariant([rel(("Rock",), 1973)]) == {}

    def test_ignores_non_vinyl_results(self):
        cds = [rel(("Rock",), 1973, fmt=("CD", "Album")) for _ in range(4)]
        assert pressing_invariant(cds) == {}

    def test_empty_input(self):
        assert pressing_invariant([]) == {}

    def test_rejects_implausible_years(self):
        assert "year" not in pressing_invariant([rel(("Rock",), 1200), rel(("Rock",), 1200)])

    def test_never_returns_pressing_level_fields(self):
        # Country, catalogue number and side layout differ between pressings —
        # returning them from an artist+title match is the exact mistake this
        # function exists to prevent.
        results = [
            {"style": ["Rock"], "year": 1973, "format": ["Vinyl"], "country": "US",
             "catno": "ABC-1", "label": ["Atlantic"]},
            {"style": ["Rock"], "year": 1973, "format": ["Vinyl"], "country": "Japan",
             "catno": "XYZ-9", "label": ["Warner"]},
        ]
        out = pressing_invariant(results)
        assert set(out) <= {"styles", "year"}
