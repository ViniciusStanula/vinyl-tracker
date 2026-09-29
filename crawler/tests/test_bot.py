from bot import build_caption, _hashtags
from bridge import priority_for


def _caption(**kw):
    args = dict(
        titulo="Pump", artista="Aerosmith", estilo="hard rock, seen live, rock",
        preco_brl=230.55, avg_30d=352.64, low_all_time=230.54,
        affiliate_url="https://www.amazon.com.br/dp/B0X?tag=a&th=1",
        slug="pump-abc123",
    )
    args.update(kw)
    return build_caption(**args)


def test_hashtags_keep_genres_only():
    assert _hashtags("hard rock, seen live, rock, pop") == "#hardrock #rock"
    assert _hashtags("hip-hop, rap") == "#hiphop #rap"
    assert _hashtags(None) == ""
    assert _hashtags("seen live, favorites") == ""


def test_caption_labels_average_not_de_por():
    cap = _caption()
    assert "Média 30 dias: R$ 352,64" in cap
    assert "De:" not in cap


def test_caption_atl_within_tolerance():
    assert "Menor preço histórico" in _caption(preco_brl=230.55, low_all_time=230.54)
    assert "Menor preço histórico" not in _caption(preco_brl=240.00, low_all_time=230.54)


def test_caption_links_and_disclosure():
    cap = _caption()
    assert "https://www.amazon.com.br/dp/B0X?tag=a&amp;th=1" in cap
    assert "https://www.garimpavinil.com.br/disco/pump-abc123" in cap
    assert "#hardrock #rock" in cap
    assert "Link de afiliado" in cap


def test_caption_without_slug_or_tags():
    cap = _caption(slug=None, estilo=None)
    assert "Histórico de preço" not in cap
    assert "#" not in cap


def _deal(**kw):
    d = dict(avg_30d=100, preco_brl=80, low_all_time=50, popularity_score=3.25, deal_score=2)
    d.update(kw)
    return d


def test_priority_weights_popularity():
    assert priority_for(_deal(popularity_score=6.5)) > priority_for(_deal(popularity_score=1.0))
    assert priority_for(_deal(popularity_score=None)) == 10.0  # 20% × 0.5


def test_priority_bonuses():
    base = priority_for(_deal())
    assert priority_for(_deal(low_all_time=80)) == base + 10
    assert priority_for(_deal(deal_score=3)) == base + 5


def _x_len(text: str, url: str) -> int:
    return len(text) - len(url) + 23


def test_x_text_fits_and_links_to_site():
    from x_post import build_text
    url = "https://www.garimpavinil.com.br/disco/eyes-open-abc123"
    deal = dict(artista="Snow Patrol", titulo="Eyes Open", estilo="alternative, rock",
                preco_brl=255.86, avg_30d=449.0, low_all_time=255.80, slug="eyes-open-abc123")
    text = build_text(deal)
    assert "#alternative #rock #vinil" in text
    assert "43% abaixo da média de 30 dias" in text
    assert text.endswith(url)

    long_deal = dict(deal, titulo="Very Long Title " * 30)
    long_text = build_text(long_deal)
    assert _x_len(long_text, url) <= 280
    assert "…" in long_text


def _roundup_deal(artista, titulo, preco, avg):
    return dict(artista=artista, titulo=titulo, preco_brl=preco, avg_30d=avg)


def test_x_roundup_fits_and_numbers_match_images():
    from x_post import build_roundup_text, _x_len as x_len
    deals = [
        _roundup_deal("Tom Waits", "Nighthawks At The Diner", 246.74, 371.0),
        _roundup_deal("Orla Gartland", "Woman On The Internet", 111.70, 162.0),
        _roundup_deal("Aesop Rock", "Float (Vinil Verde)", 150.56, 209.0),
        _roundup_deal("Yungblud", "Yungblud", 147.31, 199.0),
    ]
    text = build_roundup_text("top5", deals)
    assert "1. Tom Waits — Nighthawks At The Diner: R$ 247 (-33%)" in text
    assert "4. Yungblud" in text
    assert text.endswith("https://www.garimpavinil.com.br/ofertas")
    assert x_len(text) <= 280

    question = build_roundup_text("question", deals)
    assert "R$" not in question
    assert "Todos em oferta:" in question

    # Long titles get shortened, then dropped, but the post always fits.
    long_deals = [dict(d, artista=d["artista"] * 2, titulo="Very Long Title " * 10) for d in deals]
    assert x_len(build_roundup_text("atl", long_deals)) <= 280


def test_x_len_counts_links_and_emoji_like_x():
    from x_post import _x_len as x_len
    assert x_len("abc https://example.com/" + "x" * 100) == 4 + 23
    assert x_len("🔥 a\nb") == 2 + 1 + 1 + 1 + 1
