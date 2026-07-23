"""
ai_matching — Gemini-powered expert recommendations (POST /matching/recommendations).

The org hits "Match me" and Gemini ranks the verified expert directory against
the org's profile + infrastructure (plus an optional free-text description of
what they need), returning best-fit experts with a score and human-readable
reasoning.

This is discovery only — the deterministic 4-factor score in match_scoring.py
still runs on every connection request per the contract. Gemini's output is
advisory and never stored.

Uses the google-genai SDK's native structured output: we hand it a Pydantic
schema and get a validated RankedMatches back, then defend against
hallucinated IDs by intersecting with the real candidate set.
"""

import json
from typing import List, Optional

from pydantic import BaseModel

from server.config import settings
from . import expert_model, match_scoring, organization_model

# The SDK is only needed when the endpoint is actually used — import lazily so
# the server runs fine for teammates who haven't installed it / set a key.
_client = None


class AIConfigurationError(Exception):
    """GEMINI_API_KEY missing — controller maps this to 503."""


class AIUnavailableError(Exception):
    """Gemini call failed after retries — controller maps this to 502."""


# ── Structured output schema (Gemini fills this shape) ────────────────────────

class ExpertRecommendation(BaseModel):
    expert_profile_id: int
    fit_score: int          # 0–100, honest — a bad fit should score low
    reasoning: str          # 1–3 sentences, written for the organization
    key_strengths: List[str]


class RankedMatches(BaseModel):
    recommendations: List[ExpertRecommendation]


SYSTEM_PROMPT = """\
You are the matching engine for QuantumConnect, a marketplace connecting
organizations facing post-quantum cryptography risk with verified quantum
security experts.

Given one organization (its sector, compliance requirements, current
encryption standards, budget, urgency, and optionally a free-text description
of what it needs) and a list of candidate experts, rank the experts by how
well they fit THIS organization.

Weigh, in rough order of importance:
1. Sector expertise — deep experience in the organization's own sector
   dominates; an expert with no experience in that sector is a poor match
   even if otherwise impressive.
2. Compliance overlap — how many of the org's compliance requirements the
   expert knows.
3. Engagement fit — whether the expert offers the kind of engagement the org
   is asking for (or plausibly needs), and whether typical budgets fall
   inside the org's budget range.
4. Availability, track record (rating, completed engagements), and rates.

Rules:
- Only recommend experts from the provided candidate list, identified by
  their exact expert_profile_id.
- fit_score is 0–100 and must be honest — do not inflate weak matches; it is
  fine to return fewer recommendations than the maximum if the rest fit badly.
- reasoning is 1–3 sentences addressed to the organization, grounded in the
  data provided (sector years, named compliance standards, budget numbers).
- key_strengths is 2–4 short phrases.
- Order recommendations from best fit to worst.
"""


def _get_client():
    """Create the Gemini client once, on first use. Raises if unconfigured."""
    global _client
    if not settings.gemini_api_key:
        raise AIConfigurationError(
            "AI matching requires GEMINI_API_KEY on the server"
        )
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _default(value):
    """json.dumps fallback for Decimal/date values coming out of asyncpg."""
    return str(value)


def _build_org_context(org, infrastructure):
    org_context = {
        "org_name": org["org_name"],
        "sector": org["sector"],
        "sub_sector": org["sub_sector"],
        "org_description": org["org_description"],
        "quantum_knowledge_level": org["quantum_knowledge_level"],
        "budget_range": org["budget_range"],
        "urgency_level": org["urgency_level"],
    }
    if infrastructure:
        org_context["infrastructure"] = {
            "compliance_requirements": infrastructure["compliance_requirements"],
            "current_encryption_standards": infrastructure["current_encryption_standards"],
            "storage_type": infrastructure["storage_type"],
            "data_categories": infrastructure["data_categories"],
            "oldest_system_age_years": infrastructure["oldest_system_age_years"],
            "known_risks": infrastructure["known_risks_freetext"],
        }
    return org_context


def _build_expert_card(c, sector_experience, engagement_types):
    """
    `sector_experience`/`engagement_types` are passed in already as native
    lists rather than read off `c` directly, since callers source them two
    different ways: list_matching_candidates() rows carry them as json_agg
    STRINGS (caller must json.loads first), while expert_model.get() already
    returns native parsed lists.
    """
    return {
        "expert_profile_id": c["expert_profile_id"],
        "name": f"{c['first_name']} {c['last_name']}",
        "headline": c["headline"],
        "years_of_experience": c["years_of_experience"],
        "hourly_rate_min": c["hourly_rate_min"],
        "hourly_rate_max": c["hourly_rate_max"],
        "availability_status": c["availability_status"],
        "avg_rating": c["avg_rating"],
        "total_completed_engagements": c["total_completed_engagements"],
        "specializations": list(c["specializations"] or []),
        "sector_experience": sector_experience,
        "engagement_types": engagement_types,
    }


def _build_user_prompt(org, infrastructure, need_description, candidates, limit):
    org_context = _build_org_context(org, infrastructure)

    expert_cards = [
        # json_agg columns arrive as JSON strings from asyncpg
        _build_expert_card(c, json.loads(c["sector_experience"]), json.loads(c["engagement_types"]))
        for c in candidates
    ]

    parts = [
        "ORGANIZATION:",
        json.dumps(org_context, default=_default),
    ]
    if need_description:
        parts += ["", "WHAT THE ORGANIZATION SAYS IT NEEDS:", need_description]
    parts += [
        "",
        f"CANDIDATE EXPERTS ({len(expert_cards)}):",
        json.dumps(expert_cards, default=_default),
        "",
        f"Return your top matches (at most {limit}).",
    ]
    return "\n".join(parts)


SINGLE_SCORE_SYSTEM_PROMPT = """\
You are the matching engine for QuantumConnect, a marketplace connecting
organizations facing post-quantum cryptography risk with verified quantum
security experts.

Given one organization (its sector, compliance requirements, current
encryption standards, budget, urgency) and ONE specific expert, assess how
well this expert fits THIS organization.

Weigh, in rough order of importance:
1. Sector expertise — deep experience in the organization's own sector
   dominates; no experience in that sector is a poor match even if otherwise
   impressive.
2. Compliance overlap — how many of the org's compliance requirements the
   expert knows.
3. Engagement fit — whether the expert offers a fitting engagement type, and
   whether typical budgets fall inside the org's budget range.
4. Availability, track record (rating, completed engagements), and rates.

Rules:
- fit_score is 0–100 and must be honest — a bad fit should score low, do not
  inflate it just because it's the only expert being assessed.
- reasoning is 1–3 sentences addressed to the organization, grounded in the
  data provided (sector years, named compliance standards, budget numbers).
- key_strengths is 2–4 short phrases.
"""


def _build_single_score_prompt(org, infrastructure, expert):
    org_context = _build_org_context(org, infrastructure)
    expert_card = _build_expert_card(
        expert, expert["sector_experience"], expert["engagement_types"]
    )
    return "\n".join([
        "ORGANIZATION:",
        json.dumps(org_context, default=_default),
        "",
        "EXPERT TO ASSESS:",
        json.dumps(expert_card, default=_default),
    ])


async def score_single(org_profile_id: int, expert_profile_id: int) -> Optional[dict]:
    """
    Best-effort AI fit score for one specific org/expert pair, computed once
    at POST /connections time and stored on the connection row — unlike
    recommend(), which is live/on-demand and never stored.

    Returns None on ANY failure (no GEMINI_API_KEY, network/API error,
    unparseable response, bad org/expert id, ...) rather than raising —
    this must never block connection creation, only the deterministic
    match_score in match_scoring.py is required.
    """
    try:
        client = _get_client()
        org = await organization_model.get(org_profile_id)
        infrastructure = await organization_model.find_infrastructure(org_profile_id)
        expert = await expert_model.get(expert_profile_id)

        from google.genai import errors as genai_errors, types

        prompt = _build_single_score_prompt(org, infrastructure, expert)
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SINGLE_SCORE_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=ExpertRecommendation,
            ),
        )
        rec = response.parsed
        if rec is None:
            rec = ExpertRecommendation.model_validate(json.loads(response.text))
        return {
            "fit_score": max(0, min(100, rec.fit_score)),
            "reasoning": rec.reasoning,
        }
    except Exception:
        return None


async def recommend(org_profile_id: int,
                    need_description: Optional[str],
                    limit: int) -> List[dict]:
    """
    Rank the expert directory for one organization. Returns a list of dicts
    ready for AIRecommendation (expert card fields + fit_score/reasoning),
    best fit first. Empty directory -> [] without calling Gemini.
    """
    org = await organization_model.get(org_profile_id)
    infrastructure = await organization_model.find_infrastructure(org_profile_id)
    candidates = await expert_model.list_matching_candidates(limit=50)
    if not candidates:
        return []

    client = _get_client()
    from google.genai import errors as genai_errors, types

    prompt = _build_user_prompt(org, infrastructure, need_description,
                                candidates, limit)
    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=RankedMatches,
            ),
        )
    except genai_errors.APIError as e:
        raise AIUnavailableError(f"Gemini request failed: {e}") from e

    ranked = response.parsed
    if ranked is None:  # schema parse fell through — recover from raw text
        try:
            ranked = RankedMatches.model_validate(json.loads(response.text))
        except Exception as e:
            raise AIUnavailableError(
                "Gemini returned an unparseable ranking"
            ) from e

    # Hallucination guard: only real candidates, sane scores, capped length.
    by_id = {c["expert_profile_id"]: c for c in candidates}
    results = []
    for rec in ranked.recommendations:
        card = by_id.get(rec.expert_profile_id)
        if card is None:
            continue  # model invented an ID — drop it

        # Alongside Gemini's advisory fit_score, also surface the same
        # deterministic score POST /connections would compute for this
        # org/expert pair — reusing data already fetched above, no extra
        # queries. org_stated_need is None here since AI Match only collects
        # free text, not the structured enum connections use.
        profile_match_score, _ = match_scoring.compute_factors(
            {
                "org": org,
                "infrastructure": infrastructure,
                "expert": {"availability_status": card["availability_status"]},
                "sector_experience": json.loads(card["sector_experience"]),
                "engagement_types": json.loads(card["engagement_types"]),
            },
            org_stated_need=None,
        )

        results.append({
            "expert_profile_id": card["expert_profile_id"],
            "first_name": card["first_name"],
            "last_name": card["last_name"],
            "headline": card["headline"],
            "hourly_rate_min": card["hourly_rate_min"],
            "hourly_rate_max": card["hourly_rate_max"],
            "availability_status": card["availability_status"],
            "is_verified": card["is_verified"],
            "avg_rating": card["avg_rating"],
            "total_completed_engagements": card["total_completed_engagements"],
            "fit_score": max(0, min(100, rec.fit_score)),
            "reasoning": rec.reasoning,
            "key_strengths": rec.key_strengths[:4],
            "profile_match_score": float(profile_match_score),
        })
        if len(results) >= limit:
            break
    return results
