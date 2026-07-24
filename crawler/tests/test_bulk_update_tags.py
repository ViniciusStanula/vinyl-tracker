"""
bulk_update_tags NULL-guard regression (2026-07-24).

fetch_untagged_artists selects an artist when ANY of its rows has NULL tags, but
the write matched on artista alone. One new release therefore re-wrote every row
that artist had, overwriting per-ASIN tags with an artist-level answer — and when
Last.fm returned nothing, with ''. That silently erased soundtrack discovery's
per-ASIN tags: 52 candidates were marked 'tagged' while their Disco row carried
no tags at all.
"""
import pytest

import database


class _Cur:
    """Captures the SQL execute_batch is handed."""

    def __init__(self):
        self.sql = None
        self.rows = None
        self.rowcount = 0

    def execute(self, *_a, **_kw):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_a):
        return False


class _Conn:
    def __init__(self, cur):
        self._cur = cur
        self.committed = False

    def cursor(self):
        return self._cur

    def commit(self):
        self.committed = True


@pytest.fixture
def captured(monkeypatch):
    cur = _Cur()

    def fake_execute_batch(cursor, sql, rows, page_size=None):
        cur.sql, cur.rows = sql, list(rows)

    monkeypatch.setattr(database.psycopg2.extras, "execute_batch",
                        fake_execute_batch)
    return cur, _Conn(cur)


def test_update_is_restricted_to_null_rows(captured):
    cur, conn = captured
    database.bulk_update_tags(conn, {"Nirvana": "grunge, rock"})
    normalised = " ".join(cur.sql.split())
    assert "lastfm_tags IS NULL" in normalised, (
        "artist-level write must not touch rows that already carry tags"
    )


def test_empty_result_cannot_erase_existing_tags(captured):
    # The exact shape that wiped soundtrack tags: Last.fm found nothing, so ''
    # was written to every row of the artist.
    cur, conn = captured
    database.bulk_update_tags(conn, {"Various Artists": ""})
    normalised = " ".join(cur.sql.split())
    assert "lastfm_tags IS NULL" in normalised
    assert cur.rows == [("", "Various Artists")]


def test_no_write_when_nothing_to_update(captured):
    cur, conn = captured
    assert database.bulk_update_tags(conn, {}) == 0
    assert cur.sql is None
