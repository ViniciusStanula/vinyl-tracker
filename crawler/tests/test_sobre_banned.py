"""Guards on disco_sobre_writer._BANNED_RE.

"ao longo dos anos" is filler on its own and a date when a decade follows it,
and the substring rule could not tell the two apart. These pin the distinction
so a later edit to the banned list does not quietly bring the false positives
back.
"""
import pytest

from disco_sobre_writer import _BANNED_RE

BANNED = dict(_BANNED_RE)


@pytest.mark.parametrize("text", [
    "Ao longo dos anos 1990, Dilla trabalhou com Slum Village.",
    "Ao longo dos anos 2000 e 2010 a banda passou por mudanças.",
    "A transformação aconteceu gradualmente ao longo dos anos 80.",
    "Continuou gravando ao longo dos anos 1970 e 1980.",
])
def test_decade_is_a_date_not_filler(text):
    assert not BANNED["ao longo dos anos"].search(text)


@pytest.mark.parametrize("text", [
    "A formação passou por rotações ao longo dos anos, mas Lux ficou.",
    "Ao longo dos anos, a banda evoluiu seu som.",
    "mesmo com várias mudanças de formação ao longo dos anos.",
])
def test_bare_phrase_still_banned(text):
    assert BANNED["ao longo dos anos"].search(text)


def test_left_anchor_still_holds():
    # The word boundary that keeps "calendário" from firing "lendári".
    assert BANNED["lendári"].search("um disco lendário")
    assert not BANNED["lendári"].search("o calendário de lançamentos")


def test_sibling_phrases_have_no_suffix_guard():
    # Only "ao longo dos anos" is date-ambiguous; the career variants are
    # filler in every form, including before a number.
    assert BANNED["ao longo de sua carreira"].search(
        "Ao longo de sua carreira gravou 11 álbuns.")
    assert BANNED["ao longo da carreira"].search(
        "Ao longo da carreira escreveu 1800 canções.")
