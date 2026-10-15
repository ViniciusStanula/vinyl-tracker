from datetime import date

from bf_baseline import baseline_window, bf_week, black_friday


def test_black_friday_is_day_after_fourth_thursday():
    assert black_friday(2025) == date(2025, 11, 28)
    assert black_friday(2026) == date(2026, 11, 27)
    assert black_friday(2027) == date(2027, 11, 26)
    # Nov 1 on a Thursday: fourth Thursday is the 22nd.
    assert black_friday(2029) == date(2029, 11, 23)


def test_bf_week_runs_monday_to_cyber_monday():
    assert bf_week(2026) == (date(2026, 11, 23), date(2026, 11, 30))


def test_baseline_window_closes_before_amazon_esquenta():
    # 2025's esquenta started 21 Oct at the earliest.
    assert baseline_window(2026) == (date(2026, 9, 1), date(2026, 10, 16))


def test_in_bf_week_bounds():
    from bf_baseline import in_bf_week
    assert not in_bf_week(date(2026, 11, 22))
    assert in_bf_week(date(2026, 11, 23))
    assert in_bf_week(date(2026, 11, 30))
    assert not in_bf_week(date(2026, 12, 1))


def test_bf_caption_measures_against_baseline():
    from bot import build_bf_caption
    cap = build_bf_caption([
        {"artista": "Seether", "titulo": "Disclaimer [Disco de Vinil]",
         "preco_brl": 276.97, "avg_30d": 510.98},
        {"artista": "A & B", "titulo": "<X>", "preco_brl": 90, "avg_30d": 100},
    ])
    assert "1. Seether — Disclaimer: R$ 276,97 (-46%)" in cap
    assert "A &amp; B — &lt;X&gt;: R$ 90,00 (-10%)" in cap
    assert "https://www.garimpavinil.com.br/black-friday" in cap
