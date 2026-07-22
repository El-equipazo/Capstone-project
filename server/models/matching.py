"""
matching — computes connection_requests.match_score and its
match_scoring_factors breakdown at POST /connections time.

Weights (sector_match 0.30, compliance_overlap 0.25, budget_fit 0.20,
availability_fit 0.25) match the example in api-contract.md §6 and sum to
1.00, satisfying the DB's deferred weight-sum trigger on
match_scoring_factors.
"""
from __future__ import annotations

# Rough total-engagement-budget ceiling in USD for a coarse budget_fit
# comparison. None means "no useful ceiling to compare against" (treated as
# neutral-positive, not penalized).
_BUDGET_CEILING_USD = {
    "under_10k": 10_000,
    "10k_50k": 50_000,
    "50k_250k": 250_000,
    "250k_plus": None,
    "undisclosed": None,
}

_AVAILABILITY_FIT = {
    "available": 100.0,
    "limited": 70.0,
    "booking_future": 50.0,
    # 'unavailable' never reaches this point — POST /connections 422s first.
}

# Assumed typical engagement length, used only to translate an hourly rate
# into a rough total-cost figure comparable to the org's budget_range bucket.
_TYPICAL_ENGAGEMENT_HOURS = 80


def _sector_match(org: dict, expert: dict) -> float:
    org_sector = org.get("sector")
    expert_sectors = {se.get("sector") for se in expert.get("sector_experience", [])}
    return 100.0 if org_sector in expert_sectors else 0.0


def _compliance_overlap(org_infra: dict | None, expert: dict) -> float:
    org_compliance = set((org_infra or {}).get("compliance_requirements") or [])
    if not org_compliance:
        return 50.0  # no org compliance data to compare against — can't assess
    expert_compliance = set()
    for se in expert.get("sector_experience", []):
        expert_compliance.update(se.get("compliance_standards_known") or [])
    overlap = len(org_compliance & expert_compliance)
    return round(100.0 * overlap / len(org_compliance), 2)


def _budget_fit(org: dict, expert: dict) -> float:
    ceiling = _BUDGET_CEILING_USD.get(org.get("budget_range"))
    if ceiling is None:
        return 80.0  # high/undisclosed budget — generally affordable, neutral-positive
    hourly_max = expert.get("hourly_rate_max")
    if hourly_max is None:
        return 50.0  # expert hasn't set a rate — can't assess
    typical_cost = float(hourly_max) * _TYPICAL_ENGAGEMENT_HOURS
    if typical_cost <= ceiling:
        return 100.0
    if typical_cost <= ceiling * 1.5:
        return 60.0
    return 30.0


def _availability_fit(expert: dict) -> float:
    return _AVAILABILITY_FIT.get(expert.get("availability_status"), 50.0)


def compute_match_factors(org: dict, org_infra: dict | None, expert: dict):
    """Returns (match_score: float, factors: list[dict]) ready to pass into
    connection_model.create(match_score=..., factors=...)."""
    raw_scores = {
        "sector_match": (_sector_match(org, expert), 0.30),
        "compliance_overlap": (_compliance_overlap(org_infra, expert), 0.25),
        "budget_fit": (_budget_fit(org, expert), 0.20),
        "availability_fit": (_availability_fit(expert), 0.25),
    }

    factors = []
    for factor_name, (raw_score, weight) in raw_scores.items():
        weighted_contribution = round(weight * raw_score, 2)
        factors.append({
            "factor_name": factor_name,
            "weight": weight,
            "raw_score": raw_score,
            "weighted_contribution": weighted_contribution,
        })

    match_score = round(sum(f["weighted_contribution"] for f in factors), 2)
    return match_score, factors
