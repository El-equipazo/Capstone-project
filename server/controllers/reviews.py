from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.dependencies import get_current_user
from server.models import engagement_model, expert_model, notification_model, organization_model, review_model

router = APIRouter(tags=["reviews"])


class ReviewCreate(BaseModel):
    overall_rating: int
    review_title: Optional[str] = None
    review_body: Optional[str] = None
    is_public: bool = True


class ReviewFlag(BaseModel):
    flagged_reason: str


def _paginate(rows: list, total: int, page: int, limit: int) -> dict:
    return {
        "data": rows,
        "pagination": {
            "page": page, "limit": limit, "total_items": total,
            "total_pages": (total + limit - 1) // limit if total else 0,
        },
    }


async def _require_participant(engagement_id: int, current_user: dict) -> tuple[str, int]:
    is_p, role, profile_id = await engagement_model.is_participant(engagement_id, current_user["user_id"])
    if not is_p:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )
    return role, profile_id


@router.post("/engagements/{engagement_id}/reviews", status_code=201)
async def create_review(
    engagement_id: int,
    body: ReviewCreate,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    eng = await engagement_model.get(engagement_id)
    if eng["status"] != "completed":
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE",
                              "message": "Reviews can only be left once the engagement is completed"}},
        )

    org = await organization_model.get(eng["org_id"])
    expert = await expert_model.get(eng["expert_id"])
    reviewee_user_id = expert["user_id"] if role == "organization" else org["user_id"]

    row = await review_model.create(
        engagement_id=engagement_id,
        reviewer_id=current_user["user_id"],
        reviewee_id=reviewee_user_id,
        reviewer_role=role,
        overall_rating=body.overall_rating,
        review_title=body.review_title,
        review_body=body.review_body,
        is_public=body.is_public,
    )

    reviewer_name = org["org_name"] if role == "organization" else f"{expert['first_name']} {expert['last_name']}"
    await notification_model.create(
        reviewee_user_id, "review_received",
        f"{reviewer_name} left you a review",
        related_entity_type="review", related_entity_id=row["review_id"],
        action_url=f"/engagements/{engagement_id}",
    )
    return row


@router.get("/engagements/{engagement_id}/reviews")
async def list_engagement_reviews(engagement_id: int, current_user=Depends(get_current_user)):
    is_admin = current_user["role"] == "admin"
    is_p, _, _ = await engagement_model.is_participant(engagement_id, current_user["user_id"])
    if not is_p and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )

    rows = await review_model.get_for_engagement(engagement_id)
    if is_admin:
        return rows

    # Blind the counterparty's review until the caller has submitted their
    # own -- otherwise a participant could read the other side's rating/text
    # via this endpoint before writing (or without ever writing) theirs,
    # even though the frontend only checks existence and never renders it.
    my_submitted = any(r["reviewer_id"] == current_user["user_id"] for r in rows)
    return rows if my_submitted else []


@router.get("/experts/{expert_id}/reviews")
async def list_expert_reviews(
    expert_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None),
    min_stars: Optional[int] = Query(None, ge=1, le=5),
    sort: str = Query("top", pattern="^(top|recent)$"),
):
    rows, total, agg = await review_model.list_for_expert(
        expert_id, page=page, limit=limit, q=q, min_stars=min_stars, sort=sort,
    )
    result = _paginate(rows, total, page, limit)
    result["aggregate"] = {
        "avg_overall": float(agg["avg_overall"]) if agg["avg_overall"] is not None else None,
        "count": agg["count"],
    }
    return result


@router.post("/reviews/{review_id}/flag")
async def flag_review(review_id: int, body: ReviewFlag, current_user=Depends(get_current_user)):
    review = await review_model.get(review_id)
    is_admin = current_user["role"] == "admin"
    is_p, _, _ = await engagement_model.is_participant(review["engagement_id"], current_user["user_id"])
    if not is_p and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )
    # A review's own reviewee flagging it themselves would let them suppress
    # a negative review the moment they see it -- is_flagged takes effect
    # immediately (no admin approval gate), so this can't be caught later.
    if current_user["user_id"] == review["reviewee_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You cannot flag a review of yourself"}},
        )
    return await review_model.flag(review_id, body.flagged_reason)
