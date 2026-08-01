from deal_scorer import (
    _compute_raw_score,
    DEAL_TIER_GOOD,
    DEAL_TIER_GREAT,
    DEAL_TIER_BEST,
    CONFIDENCE_INSUFFICIENT,
    CONFIDENCE_LOW,
    CONFIDENCE_MODERATE,
    CONFIDENCE_HIGH,
)


def score(price, avg_30d=100.0, avg_90d=100.0, low_all_time=50.0, confidence=CONFIDENCE_HIGH):
    return _compute_raw_score(price, avg_30d, avg_90d, low_all_time, confidence)


# ─── dual gate ───────────────────────────────────────────────────────────────

class TestDualGate:
    def test_no_deal_when_price_at_average(self):
        assert score(100.0) is None

    def test_percentage_gate_rejects_small_discount(self):
        # 5% below avg — under DEAL_THRESHOLD_PCT
        assert score(95.0) is None

    def test_absolute_gate_rejects_cheap_items(self):
        # 20% below avg, but only R$1 in absolute terms
        assert score(4.0, avg_30d=5.0, avg_90d=5.0, low_all_time=1.0) is None

    def test_qualifies_when_both_gates_pass(self):
        assert score(85.0, avg_90d=200.0, low_all_time=1.0) is not None


# ─── confidence gating ───────────────────────────────────────────────────────

class TestConfidence:
    def test_insufficient_never_scores(self):
        assert score(10.0, confidence=CONFIDENCE_INSUFFICIENT) is None

    def test_low_confidence_caps_at_tier_1(self):
        # Would otherwise be Tier 3: far below both averages and under the low.
        assert score(10.0, confidence=CONFIDENCE_LOW) == DEAL_TIER_GOOD

    def test_moderate_confidence_caps_at_tier_2(self):
        assert score(10.0, confidence=CONFIDENCE_MODERATE) == DEAL_TIER_GREAT

    def test_high_confidence_reaches_tier_3(self):
        assert score(10.0, confidence=CONFIDENCE_HIGH) == DEAL_TIER_BEST


# ─── the ladder is monotonic ─────────────────────────────────────────────────

class TestMonotonicLadder:
    def test_tier_2_requires_being_below_90d_average(self):
        # Below the 30-day average but NOT the 90-day one.
        assert score(85.0, avg_30d=100.0, avg_90d=80.0, low_all_time=1.0) == DEAL_TIER_GOOD

    def test_tier_3_requires_tier_2_first(self):
        # At the recorded low, but above avg_90d so Tier 2 was never reached.
        # The old scorer let Tier 3 short-circuit Tier 2 and returned BEST here.
        assert score(85.0, avg_30d=100.0, avg_90d=80.0, low_all_time=85.0) == DEAL_TIER_GOOD

    def test_tier_3_needs_to_match_or_beat_the_recorded_low(self):
        # One cent above the low is not "menor preço".
        assert score(50.01, avg_90d=100.0, low_all_time=50.0) == DEAL_TIER_GREAT
        assert score(50.00, avg_90d=100.0, low_all_time=50.0) == DEAL_TIER_BEST
        assert score(49.99, avg_90d=100.0, low_all_time=50.0) == DEAL_TIER_BEST

    def test_no_proximity_margin_on_tier_3(self):
        # A 2% margin used to grant BEST here; the badge sits directly above an
        # on-page line naming the recorded low, so it must not round.
        assert score(51.0, avg_90d=100.0, low_all_time=50.0) == DEAL_TIER_GREAT


# ─── missing data ────────────────────────────────────────────────────────────

class TestMissingData:
    def test_no_average_means_no_score(self):
        assert _compute_raw_score(10.0, 0.0, 100.0, 50.0, CONFIDENCE_HIGH) is None

    def test_missing_90d_average_caps_at_tier_1(self):
        assert score(10.0, avg_90d=None) == DEAL_TIER_GOOD

    def test_missing_all_time_low_caps_at_tier_2(self):
        assert score(10.0, low_all_time=None) == DEAL_TIER_GREAT

    def test_zero_all_time_low_caps_at_tier_2(self):
        assert score(10.0, low_all_time=0.0) == DEAL_TIER_GREAT
