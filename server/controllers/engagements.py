from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.dependencies import get_current_user, require_role
from server.models import connection_model, engagement_model, expert_model, organization_model

router = APIRouter(tags=["engagements"])


class EngagementCreate(BaseModel):
    connection_id: int
    engagement_type: str
    title: Optional[str] = None
    description: Optional[str] = None
    payment_structure: Optional[str] = None
    agreed_budget: Optional[float] = None
    start_date: Optional[date] = None
    estimated_end_date: Optional[date] = None


def _paginate(data: list) -> dict:
    return {
        "data": data,
        "pagination": {
            "page": 1,
            "limit": len(data),
            "total_items": len(data),
            "total_pages": 1,
        },
    }


async def _assert_participant_or_admin(current_user, engagement_row) -> None:
    """Own private copy (matches the convention already established across
    connections.py / organizations.py / experts.py) -- checked directly
    against the engagement row's own org_id/expert_id."""
    role = current_user["role"]
    if role == "admin":
        return
    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        participant = org is not None and org["org_profile_id"] == engagement_row["org_id"]
    elif role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        participant = expert is not None and expert["expert_profile_id"] == engagement_row["expert_id"]
    else:
        participant = False
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )


@router.post("/engagements", status_code=201)
async def create_engagement(
    body: EngagementCreate,
    current_user=Depends(require_role("organization", "expert")),
):
    connection = await connection_model.get(body.connection_id)

    role = current_user["role"]
    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        participant = org is not None and org["org_profile_id"] == connection["org_id"]
    else:  # expert
        expert = await expert_model.find_by_user(current_user["user_id"])
        participant = expert is not None and expert["expert_profile_id"] == connection["expert_id"]

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this connection request"}},
        )

    if connection["status"] != "accepted":
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "INVALID_STATE",
                    "message": "Connection request must be accepted before creating an engagement.",
                }
            },
        )

    row = await engagement_model.create(
        connection_id=connection["connection_id"],
        org_id=connection["org_id"],
        expert_id=connection["expert_id"],
        engagement_type=body.engagement_type,
        title=body.title,
        description=body.description,
        payment_structure=body.payment_structure,
        agreed_budget=body.agreed_budget,
        start_date=body.start_date,
        estimated_end_date=body.estimated_end_date,
    )
    return row


@router.get("/engagements/{engagement_id}")
async def get_engagement(engagement_id: int, current_user=Depends(get_current_user)):
    row = await engagement_model.get(engagement_id)
    await _assert_participant_or_admin(current_user, row)
    return row


@router.get("/engagements")
async def list_engagements(
    status: Optional[str] = Query(None),
    engagement_type: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    role = current_user["role"]

    if role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert is None:
            return _paginate([])
        rows = await engagement_model.list_for_expert(
            expert["expert_profile_id"], status=status, engagement_type=engagement_type
        )
        return _paginate(rows)

    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is None:
            return _paginate([])
        rows = await engagement_model.list_for_org(
            org["org_profile_id"], status=status, engagement_type=engagement_type
        )
        return _paginate(rows)

    return _paginate([])
