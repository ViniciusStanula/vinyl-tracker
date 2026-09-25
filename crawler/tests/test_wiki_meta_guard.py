"""translate_wikis._looks_like_meta must reject LLM refusals, never real album text."""
import sys
import types

import pytest

sys.modules.setdefault("anthropic", types.ModuleType("anthropic"))
from translate_wikis import _looks_like_meta  # noqa: E402

REFUSALS = [
    "I appreciate you reaching out, but I need actual text content to translate.",
    "I notice you've provided only a track listing without any descriptive text.",
    "I'd be happy to help, but I don't see the English text about an album.",
    "# Texto insuficiente\n\nO texto fornecido é muito breve.",
    "Peço desculpas, mas o texto fornecido contém apenas a lista de faixas.",
    "Lamento, mas o texto fornecido contém apenas informações técnicas.",
    "Não é possível fazer uma tradução e análise contextual deste material.",
]
ALBUM_TEXTS = [
    "I Put a Spell on You é o sexto álbum de estúdio de Nina Simone.",
    "I Don't Want to Grow Up é o segundo álbum dos Descendents.",
    "I See You é o terceiro álbum de estúdio do The xx.",
    "I'm Your Baby Tonight é o terceiro álbum de estúdio de Whitney Houston.",
    "#1's é o primeiro álbum de maiores sucessos de Mariah Carey.",
    "Please Please Me é o álbum de estreia dos Beatles.",
    "Thank u, next é o quinto álbum de estúdio de Ariana Grande.",
]


@pytest.mark.parametrize("text", REFUSALS)
def test_refusal_rejected(text):
    assert _looks_like_meta(text)


@pytest.mark.parametrize("text", ALBUM_TEXTS)
def test_album_text_kept(text):
    assert not _looks_like_meta(text)
