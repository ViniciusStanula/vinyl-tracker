from discogs_enrich import verify_match, clean_catno


def hit(title: str) -> dict:
    """A Discogs search result — its `title` is "Artist - Album" in one string."""
    return {"title": title}


# ─── verify_match ────────────────────────────────────────────────────────────
# A barcode is strong evidence but not proof: Amazon EANs can be wrong or
# reused, and attaching the wrong pressing is the exact failure this whole
# barcode approach exists to avoid.

class TestVerifyMatch:
    def test_accepts_the_obvious_match(self):
        assert verify_match("Coldplay", "Parachutes", hit("Coldplay - Parachutes"))

    def test_accepts_despite_our_title_junk(self):
        assert verify_match(
            "Radiohead", "OK Computer [Disco de Vinil]", hit("Radiohead - OK Computer")
        )

    def test_accepts_across_accents(self):
        assert verify_match("Maria Bethania", "Alibi", hit("Maria Bethânia - Álibi"))

    def test_rejects_a_different_record(self):
        assert not verify_match(
            "Coldplay", "Parachutes", hit("Metallica - Master of Puppets")
        )

    def test_rejects_right_label_wrong_artist(self):
        assert not verify_match(
            "Nirvana", "Nevermind", hit("Foo Fighters - The Colour and the Shape")
        )

    def test_various_artists_falls_back_to_title(self):
        # "Various" carries no artist signal, so the title has to carry it.
        assert verify_match(
            "Various Artists",
            "Black Panther: Wakanda Forever",
            hit("Various - Black Panther: Wakanda Forever"),
        )

    def test_various_artists_still_rejects_a_wrong_title(self):
        assert not verify_match(
            "Various Artists", "Wakanda Forever", hit("Various - NOW That's What I Call Music 42")
        )

    def test_rejects_empty_result(self):
        assert not verify_match("Coldplay", "Parachutes", hit(""))


# ─── clean_catno ─────────────────────────────────────────────────────────────
# Discogs editors have the same habits as MusicBrainz ones.

class TestCleanCatno:
    def test_keeps_a_real_catalogue_number(self):
        assert clean_catno("XLLP781") == "XLLP781"
        assert clean_catno("ABC-123") == "ABC-123"

    def test_rejects_a_barcode_in_the_catno_field(self):
        # Seen live: Coldplay "Parachutes" carries catno "5021732630865".
        assert clean_catno("5021732630865") is None
        assert clean_catno("602557247671") is None

    def test_rejects_placeholders(self):
        for v in ("none", "[none]", "n/a", "-", "", "not on label", "  "):
            assert clean_catno(v) is None, v

    def test_rejects_missing(self):
        assert clean_catno(None) is None

    def test_keeps_numeric_strings_that_are_not_barcode_length(self):
        assert clean_catno("130701") == "130701"  # a real Fat Cat sublabel catno


# ─── non-Latin titles ────────────────────────────────────────────────────────
# Discogs lists many releases under their native script. Joe Hisaishi's
# "La Folia" is "久石譲* / ヴィヴァルディ* - ラ・フォリア", which shares no
# tokens with our romanised "Joe Hisaishi", so the check rejected a correct
# barcode match and every Japanese/Korean/Cyrillic pressing with it.

class TestNonLatinTitles:
    def test_barcode_match_accepts_a_japanese_title(self):
        assert verify_match(
            "Joe Hisaishi",
            "La Folia Vivaldi",
            hit("久石譲* / ヴィヴァルディ* - ラ・フォリア - パン種とタマゴ姫"),
            from_barcode=True,
        )

    def test_barcode_match_accepts_cyrillic(self):
        assert verify_match("Kino", "Gruppa Krovi", hit("Кино - Группа Крови"), from_barcode=True)

    def test_artist_title_search_still_rejects_non_latin(self):
        # No barcode backing this path, so an unreadable title is not evidence.
        assert not verify_match(
            "Joe Hisaishi", "La Folia Vivaldi", hit("久石譲* - ラ・フォリア")
        )

    def test_relaxation_does_not_apply_to_latin_titles(self):
        # The wrong matches found in testing were all Latin — the guard must
        # keep catching them even when the caller came from a barcode.
        assert not verify_match(
            "Duck Fight Goose", "Suck On Light",
            hit("Boy & Bear - Suck On Light"), from_barcode=True,
        )
        assert not verify_match(
            "Steve Davis", "Steve Davis Meets Hank Jones",
            hit("Magdalena Bay - Mini Mix Vol. 3"), from_barcode=True,
        )

    def test_mixed_script_still_compared(self):
        # Enough Latin to compare, so the normal rule applies and this is wrong.
        assert not verify_match(
            "Coldplay", "Parachutes",
            hit("Metallica - Master of Puppets (メタリカ)"), from_barcode=True,
        )
