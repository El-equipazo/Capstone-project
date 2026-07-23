from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Connection requests (§6) ──────────────────────────────────────────────────
# Enum-ish fields stay plain strings: the model layer validates them via
# check_enum so errors come back in the contract's §1.1 envelope.

class ConnectionCreate(BaseModel):
    expert_id: int
    initial_message: Optional[str] = None
    org_stated_need: Optional[str] = None      # canonical engagement_type; None = "not sure"
    org_stated_timeline: Optional[str] = None


class ConnectionRespond(BaseModel):
    status: str  # "accepted" | "declined" — validated in connection_model.respond


class ConnectionResponse(BaseModel):
    connection_id: int
    org_id: int
    expert_id: int
    initiated_by_user_id: int
    status: str
    initial_message: Optional[str] = None
    org_stated_need: Optional[str] = None
    org_stated_timeline: Optional[str] = None
    match_score: Optional[float] = None        # NUMERIC(5,2) — pydantic coerces Decimal
    ai_fit_score: Optional[int] = None         # Gemini's advisory score, computed once at creation
    ai_reasoning: Optional[str] = None         # explanation for ai_fit_score; null alongside it
    expires_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    created_at: datetime
    # Org profile fields joined in from list_requests
    org_name: Optional[str] = None
    org_sector: Optional[str] = None
    sub_sector: Optional[str] = None
    org_description: Optional[str] = None
    employee_count_range: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    quantum_knowledge_level: Optional[str] = None
    budget_range: Optional[str] = None
    urgency_level: Optional[str] = None
    org_is_verified: Optional[bool] = None
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None


class ScoreFactor(BaseModel):
    factor_name: str
    weight: float
    raw_score: float
    weighted_contribution: float


class ScoreFactorsResponse(BaseModel):
    connection_id: int
    match_score: Optional[float] = None
    factors: List[ScoreFactor]


# ── AI matching (POST /matching/recommendations) ──────────────────────────────

class AIMatchRequest(BaseModel):
    need_description: Optional[str] = Field(
        None, max_length=2000,
        description="Optional free-text description of what the org is looking for",
    )
    limit: int = Field(5, ge=1, le=10)


class AIRecommendation(BaseModel):
    expert_profile_id: int
    first_name: str
    last_name: str
    headline: Optional[str] = None
    hourly_rate_min: Optional[float] = None
    hourly_rate_max: Optional[float] = None
    availability_status: Optional[str] = None
    is_verified: bool
    avg_rating: Optional[float] = None
    total_completed_engagements: Optional[int] = None
    fit_score: int
    reasoning: str
    key_strengths: List[str] = []
    # The same deterministic score POST /connections would compute for this
    # org/expert pair (§6) — distinct from fit_score, which is Gemini's
    # advisory read of the same candidate. Shown side by side in the UI so
    # the two aren't mistaken for the same measurement.
    profile_match_score: float


class AIMatchResponse(BaseModel):
    model: str                                  # which Gemini model produced the ranking
    recommendations: List[AIRecommendation]
