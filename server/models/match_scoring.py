"""
match_scoring — deterministic match score for connection requests (§6).

Produces the four factors stored in match_scoring_factors when an org sends a
connection request. Sector fit dominates by design: an expert with no
experience in the org's sector scores 0 on a 0.40-weight factor, so the best
they can reach overall is 60 — cross-sector matches sink to the bottom.

    factor               weight   raw score
    ─────────────────────────────────────────────────────────────────────
    sector_match          0.40    graded by years of experience in the
                                  org's sector (0 if none; 70–100 if any)
    compliance_overlap    0.25    share of the org's compliance requirements
                                  the expert knows (50 if org has none)
    budget_fit            0.15    org budget band overlaps the expert's
                                  typical budget for the stated need
    availability_fit      0.20    available 100 / limited 60 / booking 30

weighted_contribution = weight × raw_score (each rounded to 2 dp), and
match_score = SUM(weighted_contribution) exactly — the DB's deferred trigger
checks the weights sum to 1.00 at COMMIT.

All arithmetic is Decimal end-to-end: asyncpg binds NUMERIC columns as
Decimal, and floats would drift on the 2-dp equality above.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

from . import expert_model, organization_model
from .errors import TransitionError

TWO_PLACES = Decimal("0.01")

WEIGHTS = {
    "sector_match":       Decimal("0.40"),
    "compliance_overlap": Decimal("0.25"),
    "budget_fit":         Decimal("0.15"),
    "availability_fit":   Decimal("0.20"),
}
assert sum(WEIGHTS.values()) == Decimal("1.00")

# org budget_range enum -> (low, high); high=None means open-ended.
# 'undisclosed' is deliberately absent -> neutral path.
BUDGET_BANDS = {
    "under_10k": (Decimal(0),       Decimal(10_000)),
    "10k_50k":   (Decimal(10_000),  Decimal(50_000)),
    "50k_250k":  (Decimal(50_000),  Decimal(250_000)),
    "250k_plus": (Decimal(250_000), None),
}

AVAILABILITY_SCORES = {
    "available":      Decimal(100),
    "limited":        Decimal(60),
    "booking_future": Decimal(30),
    # 'unavailable' never reaches scoring — score() raises 422 first.
}

# "Not enough data to judge" — neither rewards nor punishes.
NEUTRAL = Decimal(50)


# -- PURE FACTOR FUNCTIONS -------------------------------------------------
# Plain-value inputs so these are unit-testable without a database.

def score_sector_match(org_sector: str, sector_rows: List[dict]) -> Decimal:
    """
    Graded by depth of experience in the org's sector: no experience -> 0,
    listed with no years -> 70, scaling to 100 at 5+ years. This is the
    dominant factor — it's what keeps a healthcare org from matching with an
    education-only expert.
    """
    for row in sector_rows:
        if row["sector"] == org_sector:
            years = min(row["years_experience_in_sector"] or 0, 5)
            return Decimal(70) + Decimal(years) * Decimal(6)
    return Decimal(0)


def score_compliance_overlap(org_requirements: Optional[List[str]],
                             expert_standards: List[str]) -> Decimal:
    """
    Coverage ratio: how much of what the org needs does the expert know.
    (Not Jaccard — an expert shouldn't lose points for knowing extra
    standards.) Case-insensitive so 'pci-dss' matches 'PCI-DSS'.
    """
    if not org_requirements:
        return NEUTRAL  # org never filled in infrastructure -> can't judge
    needed = {s.strip().lower() for s in org_requirements if s and s.strip()}
    if not needed:
        return NEUTRAL
    known = {s.strip().lower() for s in expert_standards if s and s.strip()}
    covered = len(needed & known)
    return (Decimal(covered) / Decimal(len(needed))) * Decimal(100)


def score_budget_fit(org_budget_range: Optional[str],
                     engagement_rows: List[dict],
                     org_stated_need: Optional[str]) -> Decimal:
    """
    Does the org's budget band overlap the expert's typical budget? Scoped to
    the stated-need engagement type when the expert offers it, else judged
    across everything they offer. Binary per row (overlap or not), best row
    wins.
    """
    band = BUDGET_BANDS.get(org_budget_range or "")
    if band is None:
        return NEUTRAL  # budget undisclosed/unset -> can't judge
    org_lo, org_hi = band

    candidates = [r for r in engagement_rows
                  if org_stated_need and r["engagement_type"] == org_stated_need]
    if not candidates:
        candidates = engagement_rows

    best = None
    for row in candidates:
        lo, hi = row["typical_budget_min"], row["typical_budget_max"]
        if lo is None and hi is None:
            continue  # no pricing info on this offering
        lo = Decimal(lo) if lo is not None else Decimal(0)
        overlaps = (org_hi is None or lo <= org_hi) and \
                   (hi is None or Decimal(hi) >= org_lo)
        score = Decimal(100) if overlaps else Decimal(0)
        best = score if best is None else max(best, score)
    return NEUTRAL if best is None else best  # no priced offerings -> can't judge


def score_availability_fit(availability_status: str) -> Decimal:
    return AVAILABILITY_SCORES.get(availability_status, Decimal(0))


def compute_factors(inputs: Dict,
                    org_stated_need: Optional[str]) -> Tuple[Decimal, List[dict]]:
    """
    Run all four factors and assemble the rows for match_scoring_factors.
    match_score sums the ALREADY-ROUNDED contributions, so it equals
    SUM(weighted_contribution) exactly as stored in NUMERIC(5,2).
    """
    org, expert = inputs["org"], inputs["expert"]
    infra = inputs["infrastructure"]

    expert_standards = []
    for row in inputs["sector_experience"]:
        expert_standards.extend(row["compliance_standards_known"] or [])

    raw_scores = {
        "sector_match": score_sector_match(
            org["sector"], inputs["sector_experience"]),
        "compliance_overlap": score_compliance_overlap(
            infra["compliance_requirements"] if infra else None,
            expert_standards),
        "budget_fit": score_budget_fit(
            org["budget_range"], inputs["engagement_types"], org_stated_need),
        "availability_fit": score_availability_fit(
            expert["availability_status"]),
    }

    factors = []
    match_score = Decimal(0)
    for name, weight in WEIGHTS.items():
        raw = raw_scores[name].quantize(TWO_PLACES, ROUND_HALF_UP)
        contribution = (weight * raw).quantize(TWO_PLACES, ROUND_HALF_UP)
        match_score += contribution
        factors.append({
            "factor_name": name,
            "weight": weight,
            "raw_score": raw,
            "weighted_contribution": contribution,
        })
    return match_score, factors


# -- ENTRY POINT -------------------------------------------------------------

async def fetch_inputs(org_profile_id: int, expert_profile_id: int) -> Dict:
    """Gather everything the factors need. NotFoundError bubbles as 404."""
    return {
        "org": await organization_model.get(org_profile_id),
        "infrastructure": await organization_model.find_infrastructure(org_profile_id),
        "expert": await expert_model.get(expert_profile_id),
        "sector_experience": await expert_model.get_sector_experience(expert_profile_id),
        "engagement_types": await expert_model.get_engagement_types(expert_profile_id),
    }


async def score(org_profile_id: int, expert_profile_id: int,
                org_stated_need: Optional[str]) -> Tuple[Decimal, List[dict]]:
    """
    Compute (match_score, factors) for a new connection request.
    Raises NotFoundError (404) for a bogus expert and TransitionError (422)
    when the expert is unavailable — per the contract, no request may be sent.
    """
    inputs = await fetch_inputs(org_profile_id, expert_profile_id)
    if inputs["expert"]["availability_status"] == "unavailable":
        raise TransitionError(
            "expert is currently unavailable for new connection requests"
        )
    return compute_factors(inputs, org_stated_need)
