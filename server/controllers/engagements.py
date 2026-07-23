from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.dependencies import get_current_user, require_role
from server.models import connection_model, engagement_model, expert_model, milestone_model, organization_model

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


class EngagementPatch(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    engagement_type: Optional[str] = None
    payment_structure: Optional[str] = None
    agreed_budget: Optional[float] = None
    start_date: Optional[date] = None
    estimated_end_date: Optional[date] = None
    cancellation_reason: Optional[str] = None
    proposal_feedback: Optional[str] = None


class MilestoneCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: Optional[int] = None
    due_date: Optional[date] = None
    deliverable_description: Optional[str] = None
    requires_client_approval: bool = False


class MilestonePatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    due_date: Optional[date] = None
    deliverable_description: Optional[str] = None
    requires_client_approval: Optional[bool] = None
    status: Optional[str] = None


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


async def _require_participant(engagement_id: int, current_user: dict) -> tuple[str, int]:
    """Returns (role, profile_id). Raises 403 if not a participant."""
    is_p, role, profile_id = await engagement_model.is_participant(engagement_id, current_user["user_id"])
    if not is_p:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )
    return role, profile_id


# ---------------------------------------------------------------------------
# POST /engagements
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# GET /engagements
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# GET /engagements/:engagementId
# ---------------------------------------------------------------------------

@router.get("/engagements/{engagement_id}")
async def get_engagement(engagement_id: int, current_user=Depends(get_current_user)):
    is_p, role, _ = await engagement_model.is_participant(engagement_id, current_user["user_id"])
    if not is_p and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )
    return await engagement_model.get_with_milestones(engagement_id)


# ---------------------------------------------------------------------------
# PATCH /engagements/:engagementId
# ---------------------------------------------------------------------------

@router.patch("/engagements/{engagement_id}")
async def patch_engagement(
    engagement_id: int,
    body: EngagementPatch,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    updates = body.model_dump(exclude_none=True)
    return await engagement_model.update(engagement_id, caller_role=role, updates=updates)


# ---------------------------------------------------------------------------
# POST /engagements/:engagementId/milestones
# ---------------------------------------------------------------------------

@router.post("/engagements/{engagement_id}/milestones", status_code=201)
async def create_milestone(
    engagement_id: int,
    body: MilestoneCreate,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    eng = await engagement_model.get(engagement_id)
    if eng["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Cannot add milestones to a completed or cancelled engagement"}},
        )
    return await milestone_model.create(
        engagement_id=engagement_id,
        proposed_by_user_id=current_user["user_id"],
        proposed_by_role=role,
        title=body.title,
        description=body.description,
        order_index=body.order_index,
        due_date=body.due_date,
        deliverable_description=body.deliverable_description,
        requires_client_approval=body.requires_client_approval,
    )


# ---------------------------------------------------------------------------
# GET /engagements/:engagementId/milestones
# ---------------------------------------------------------------------------

@router.get("/engagements/{engagement_id}/milestones")
async def list_milestones(engagement_id: int, current_user=Depends(get_current_user)):
    is_p, _, _ = await engagement_model.is_participant(engagement_id, current_user["user_id"])
    if not is_p and current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this engagement"}},
        )
    return await milestone_model.list_for_engagement(engagement_id)


# ---------------------------------------------------------------------------
# PATCH /engagements/:engagementId/milestones/:milestoneId
# ---------------------------------------------------------------------------

_MILESTONE_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "confirmed":   {"in_progress"},
    "in_progress": {"completed", "blocked"},
}


@router.patch("/engagements/{engagement_id}/milestones/{milestone_id}")
async def patch_milestone(
    engagement_id: int,
    milestone_id: int,
    body: MilestonePatch,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    m = await milestone_model.get(milestone_id)
    if m["engagement_id"] != engagement_id:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Milestone not found in this engagement"}},
        )

    updates = body.model_dump(exclude_none=True)

    if role == "organization":
        allowed = {"due_date", "description"}
        forbidden_keys = set(updates.keys()) - allowed
        if forbidden_keys:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "Organizations can only update due_date and description"}},
            )
        if m["status"] != "proposed":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "Organization can only edit milestones in 'proposed' status"}},
            )

    if "status" in updates:
        new_s = updates["status"]
        old_s = m["status"]
        allowed_next = _MILESTONE_STATUS_TRANSITIONS.get(old_s, set())
        if new_s != "skipped" and new_s not in allowed_next:
            raise HTTPException(
                status_code=422,
                detail={"error": {"code": "INVALID_TRANSITION", "message": f"Cannot move milestone from '{old_s}' to '{new_s}'"}},
            )

    return await milestone_model.update(milestone_id, **updates)


# ---------------------------------------------------------------------------
# POST /engagements/:engagementId/milestones/:milestoneId/confirm
# ---------------------------------------------------------------------------

@router.post("/engagements/{engagement_id}/milestones/{milestone_id}/confirm")
async def confirm_milestone(
    engagement_id: int,
    milestone_id: int,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "organization":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only organizations can confirm milestones"}},
        )
    m = await milestone_model.get(milestone_id)
    if m["engagement_id"] != engagement_id:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Milestone not found in this engagement"}},
        )
    if m["status"] != "proposed":
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_TRANSITION", "message": "Only proposed milestones can be confirmed"}},
        )
    return await milestone_model.confirm(milestone_id)


# ---------------------------------------------------------------------------
# DELETE /engagements/:engagementId/milestones/:milestoneId
# ---------------------------------------------------------------------------

@router.delete("/engagements/{engagement_id}/milestones/{milestone_id}", status_code=204)
async def delete_milestone(
    engagement_id: int,
    milestone_id: int,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only experts can delete milestones"}},
        )
    eng = await engagement_model.get(engagement_id)
    if eng["status"] not in ("scoping", "proposal_sent"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Milestones can only be deleted during scoping or proposal_sent"}},
        )
    m = await milestone_model.get(milestone_id)
    if m["engagement_id"] != engagement_id:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Milestone not found in this engagement"}},
        )
    await milestone_model.delete(milestone_id)
