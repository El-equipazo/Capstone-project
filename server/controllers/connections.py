"""
connections — the matching feature's API surface (contract §6).

  POST   /connections                      org sends a request (server scores it)
  GET    /connections                      org: sent · expert: received · admin: all
  GET    /connections/{id}                 participant or admin
  GET    /connections/{id}/score-factors   match score breakdown
  PATCH  /connections/{id}                 recipient expert accepts/declines
  POST   /matching/recommendations         AI (Gemini) ranks the directory for an org

Model errors bubble to the handlers in main.py (ValidationError→400,
NotFoundError→404, ConflictError→409, GoneError→410, TransitionError→422).
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from server.dependencies import get_current_user, require_role
from server.models import (
    ai_matching,
    connection_model,
    engagement_model,
    expert_model,
    match_scoring,
    notification_model,
    organization_model,
)
from server.schemas.common import PaginatedResponse
from server.schemas.connections import (
    AIMatchRequest,
    AIMatchResponse,
    ConnectionCreate,
    ConnectionRespond,
    ConnectionResponse,
    ScoreFactorsResponse,
)
from server.config import settings

router = APIRouter(tags=["connections"])

_FORBIDDEN_NOT_PARTICIPANT = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this connection"}},
)

_FORBIDDEN_NO_ORG_PROFILE = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail={"error": {"code": "FORBIDDEN",
                      "message": "Create an organization profile before using matching"}},
)


async def _assert_participant_or_admin(current_user, connection_row):
    """403 unless the caller is an admin, the org side, or the expert side.
    Connection rows carry profile ids, so resolve the caller's profile first."""
    if current_user["role"] == "admin":
        return
    if current_user["role"] == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org and org["org_profile_id"] == connection_row["org_id"]:
            return
    elif current_user["role"] == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert and expert["expert_profile_id"] == connection_row["expert_id"]:
            return
    raise _FORBIDDEN_NOT_PARTICIPANT


def _paginate(rows, total, page, limit):
    return {
        "data": [dict(r) for r in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    }


# ── Connection requests ───────────────────────────────────────────────────────

@router.post("/connections", status_code=201, response_model=ConnectionResponse)
async def create_connection(
    body: ConnectionCreate,
    current_user=Depends(require_role("organization")),
):
    # Sweep first: a time-expired pending request would otherwise still hold
    # the (org, expert) unique index and 409 a legitimate new request.
    await connection_model.expire_stale()

    org = await organization_model.find_by_user(current_user["user_id"])
    if org is None:
        # Auto-create a minimal profile so new org accounts can send requests
        # without a separate setup step. They can fill in details later via
        # PATCH /organizations.
        org_name = current_user["email"].split("@")[0]
        org = await organization_model.create(current_user["user_id"], {
            "org_name": org_name,
            "sector": "other",
        })

    # Block duplicate requests: one open engagement per org/expert pair is enough.
    # body.expert_id is the expert_profile_id — matches engagement_model columns directly.
    open_eng = await engagement_model.find_open_between(org["org_profile_id"], body.expert_id)
    if open_eng:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "CONFLICT", "message": "You already have an open engagement with this expert"}},
        )

    # Server computes the score + factor breakdown (404 unknown expert /
    # 422 unavailable bubble up from the scorer).
    match_score, factors = await match_scoring.score(
        org["org_profile_id"], body.expert_id, body.org_stated_need
    )

    # Best-effort AI fit score, computed once here and stored — never blocks
    # connection creation (score_single() swallows every failure internally).
    ai_result = await ai_matching.score_single(org["org_profile_id"], body.expert_id)

    row = await connection_model.create(
        org_id=org["org_profile_id"],
        expert_id=body.expert_id,
        initiated_by_user_id=current_user["user_id"],
        initial_message=body.initial_message,
        org_stated_need=body.org_stated_need,
        org_stated_timeline=body.org_stated_timeline,
        match_score=match_score,
        expiry_days=org["default_connection_expiry_days"] or 30,
        factors=factors,
        ai_fit_score=(ai_result or {}).get("fit_score"),
        ai_reasoning=(ai_result or {}).get("reasoning"),
    )
    return dict(row)


@router.get("/connections", response_model=PaginatedResponse[ConnectionResponse])
async def list_connections(
    status_filter: Optional[str] = Query(None, alias="status"),
    expert_id: Optional[int] = Query(None),
    org_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    await connection_model.expire_stale()

    # Org sees sent, expert sees received (own side is forced — a caller
    # can't list someone else's by passing filters); admin sees all.
    if current_user["role"] == "organization":
        own = await organization_model.find_by_user(current_user["user_id"])
        if own is None:
            return _paginate([], 0, page, limit)  # no profile -> nothing sent
        org_id = own["org_profile_id"]
    elif current_user["role"] == "expert":
        own = await expert_model.find_by_user(current_user["user_id"])
        if own is None:
            return _paginate([], 0, page, limit)
        expert_id = own["expert_profile_id"]

    rows, total = await connection_model.list_requests(
        org_id=org_id, expert_id=expert_id, status=status_filter,
        page=page, limit=limit,
    )
    return _paginate(rows, total, page, limit)


@router.get("/connections/{connection_id}", response_model=ConnectionResponse)
async def get_connection(connection_id: int, current_user=Depends(get_current_user)):
    await connection_model.expire_stale()
    row = await connection_model.get(connection_id)
    await _assert_participant_or_admin(current_user, row)
    return dict(row)


@router.get("/connections/{connection_id}/score-factors",
            response_model=ScoreFactorsResponse)
async def get_score_factors(connection_id: int, current_user=Depends(get_current_user)):
    row = await connection_model.get(connection_id)
    await _assert_participant_or_admin(current_user, row)
    factors = await connection_model.get_score_factors(connection_id)
    return {
        "connection_id": connection_id,
        "match_score": row["match_score"],
        "factors": [dict(f) for f in factors],
    }


@router.patch("/connections/{connection_id}", response_model=ConnectionResponse)
async def respond_to_connection(
    connection_id: int,
    body: ConnectionRespond,
    current_user=Depends(require_role("expert")),
):
    row = await connection_model.get(connection_id)
    expert = await expert_model.find_by_user(current_user["user_id"])
    if expert is None or expert["expert_profile_id"] != row["expert_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN",
                              "message": "Only the recipient expert can respond"}},
        )
    updated = await connection_model.respond(connection_id, body.status)

    # Notify the org side of the response. §8: "Notifications are
    # server-generated only (connection received/responded, ...)".
    org = await organization_model.get(updated["org_id"])
    accepted = body.status == "accepted"
    await notification_model.create(
        org["user_id"],
        "connection_accepted" if accepted else "connection_declined",
        f"{expert['first_name']} {expert['last_name']} "
        f"{'accepted' if accepted else 'declined'} your connection request",
        related_entity_type="connection_request", related_entity_id=connection_id,
        action_url=f"/connections/{connection_id}",
    )

    return dict(updated)


# ── AI matching ───────────────────────────────────────────────────────────────

@router.post("/matching/recommendations", response_model=AIMatchResponse,
             tags=["matching"])
async def ai_recommendations(
    body: AIMatchRequest,
    current_user=Depends(require_role("organization")),
):
    """One click: Gemini ranks the verified expert directory against this
    org's profile/infrastructure (+ optional needs text). Advisory only —
    the stored match_score on each connection stays deterministic."""
    org = await organization_model.find_by_user(current_user["user_id"])
    if org is None:
        raise _FORBIDDEN_NO_ORG_PROFILE

    try:
        recommendations = await ai_matching.recommend(
            org["org_profile_id"], body.need_description, body.limit
        )
    except ai_matching.AIConfigurationError as e:
        raise HTTPException(
            status_code=503,
            detail={"error": {"code": "AI_NOT_CONFIGURED", "message": str(e)}},
        )
    except ai_matching.AIUnavailableError as e:
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "AI_UNAVAILABLE", "message": str(e)}},
        )

    return {"model": settings.gemini_model, "recommendations": recommendations}
