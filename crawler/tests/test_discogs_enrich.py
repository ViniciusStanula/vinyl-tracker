from discogs_enrich import (
    verify_match,
    clean_catno,
    sibling_consensus,
    master_consensus,
)


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
        # A readable title that agrees on nothing is still a rejection.
        assert not verify_match(
            "Steve Davis", "Steve Davis Meets Hank Jones",
            hit("Magdalena Bay - Mini Mix Vol. 3"), from_barcode=True,
        )
        # Verified live: barcode 5030679660417 on our Queen "Greatest Hits" row
        # returns Judas Priest. Nothing agrees, so nothing is written.
        assert not verify_match(
            "Queen", "LP QUEEN GREATEST HITS (NACIONAL)",
            hit("Judas Priest - The Best Of Judas Priest"), from_barcode=True,
        )

    def test_wrong_artist_column_does_not_veto_a_right_title(self):
        # Our artista column is wrong often enough that requiring it to agree
        # threw away correct matches. Verified live: barcode 0602577935046 on
        # our "Duck Fight Goose" row returns exactly one release, Boy & Bear's
        # "Suck On Light" (2019, Universal). Duck Fight Goose have no such
        # album — the artist column is wrong and the match is right.
        assert verify_match(
            "Duck Fight Goose", "Suck On Light",
            hit("Boy & Bear - Suck On Light"), from_barcode=True,
        )

    def test_one_shared_word_is_not_a_match(self):
        # "the" alone used to carry both halves of the check, which is how
        # "See the Sun" was stored with The Paper Dolls' tracklist.
        assert not verify_match(
            "See the Sun", "See The Sun [Disco de Vinil]",
            hit("The Paper Dolls* - My Life (Is In Your Hands)"),
            from_barcode=True,
        )

    def test_artist_agreement_carries_a_censored_title(self):
        # Discogs censors this title; ours is uncensored, so no word lines up.
        assert verify_match(
            "KMD", "BLACK BASTARDS (2LP)",
            hit("KMD - Bl_ck B_st_rds"), from_barcode=True,
        )

    def test_mixed_script_still_compared(self):
        # Enough Latin to compare, so the normal rule applies and this is wrong.
        assert not verify_match(
            "Coldplay", "Parachutes",
            hit("Metallica - Master of Puppets (メタリカ)"), from_barcode=True,
        )


class TestCatnoBarcodeJunk:
    def test_padded_upc_in_the_catalogue_field_is_rejected(self):
        # Anne Wilson "REBEL" carries catno "00602458871463" — the 12-digit UPC
        # with two leading zeros. A length-13 test let it through and the page
        # would have published a barcode as a catalogue number.
        assert clean_catno("00602458871463") is None
        assert clean_catno("602458871463") is None
        assert clean_catno("0602458871463") is None

    def test_real_catalogue_numbers_survive(self):
        assert clean_catno("MOVLP208") == "MOVLP208"
        assert clean_catno("DOC310") == "DOC310"
        assert clean_catno("8023") == "8023"


class TestSiblingConsensus:
    """A barcode with several releases behind it can still give one answer."""

    def test_agreeing_siblings_yield_the_value(self):
        sibs = [{"catno": "MOVLP208"}, {"catno": "MOVLP208"}]
        assert sibling_consensus(sibs, "catno") == "MOVLP208"

    def test_disagreeing_siblings_yield_nothing(self):
        sibs = [{"catno": "MOVLP208"}, {"catno": "DOC310"}]
        assert sibling_consensus(sibs, "catno") is None

    def test_a_missing_value_does_not_veto_the_others(self):
        sibs = [{"catno": "MOVLP208"}, {"catno": None}, {"catno": ""}]
        assert sibling_consensus(sibs, "catno") == "MOVLP208"

    def test_label_is_a_list_on_search_results(self):
        sibs = [{"label": ["Music On Vinyl", "Sony"]}, {"label": ["Music On Vinyl"]}]
        assert sibling_consensus(sibs, "label") == "Music On Vinyl"

    def test_barcode_junk_in_catno_is_still_rejected(self):
        # Consensus must not smuggle past clean_catno: two siblings agreeing on
        # a barcode still do not have a catalogue number.
        sibs = [{"catno": "00602458871463"}, {"catno": "00602458871463"}]
        assert sibling_consensus(sibs, "catno") is None


class TestMasterConsensus:
    """One shared master beats asking every pressing to agree field by field."""

    def test_all_pressings_share_one_master(self):
        # Niall Horan "Flicker": eight pressings spanning 2017 to 2026, all
        # carrying master 1254664. They never agree on a year, but they are
        # unambiguously one album.
        sibs = [{"master_id": 1254664, "year": "2017"},
                {"master_id": 1254664, "year": "2026"},
                {"master_id": 1254664, "year": "2017"}]
        assert master_consensus(sibs) == 1254664

    def test_two_masters_is_not_consensus(self):
        sibs = [{"master_id": 1254664}, {"master_id": 999}]
        assert master_consensus(sibs) is None

    def test_missing_master_ids_are_ignored_not_counted(self):
        sibs = [{"master_id": 1254664}, {"year": "2019"}, {"master_id": None}]
        assert master_consensus(sibs) == 1254664

    def test_no_masters_at_all(self):
        assert master_consensus([{"year": "2019"}, {}]) is None


class TestReissueSeriesJunk:
    def test_label_series_does_not_dilute_the_title(self):
        # "Jazz Samba Encore! (Verve Acoustic Sounds Series)" — the series is
        # the label's branding. Counting its words dropped title coverage to
        # 0.43 and lost the match. Our artist here is wrong too ("The Verve"
        # is the label, not the band), so the title has to carry it alone.
        assert verify_match(
            "The Verve", "Jazz Samba Encore! (Verve Acoustic Sounds Series)",
            hit("Stan Getz / Luiz Bonfa* - Jazz Samba Encore!"), from_barcode=True,
        )
        assert verify_match(
            "Sonny Clark", "Dial 'S' For Sonny (Blue Note Classic Vinyl Series)",
            hit("Sonny Clark - Dial 'S' For Sonny"), from_barcode=True,
        )

    def test_an_ordinary_parenthetical_is_left_alone(self):
        from discogs_enrich import _strip_series
        assert _strip_series("Greatest Hits (Live In Paris)") == "Greatest Hits (Live In Paris)"
