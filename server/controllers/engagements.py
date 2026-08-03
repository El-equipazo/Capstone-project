from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.dependencies import get_current_user, require_role
from server.models import (
    connection_model, engagement_model, engagement_note_model, expert_model,
    milestone_model, notification_model, organization_model,
)

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
    proposal_expires_at: Optional[datetime] = None


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


class MilestoneProposeChange(BaseModel):
    due_date: Optional[date] = None
    deliverable_description: Optional[str] = None


class EngagementTermsPropose(BaseModel):
    start_date: Optional[date] = None
    estimated_end_date: Optional[date] = None
    agreed_budget: Optional[float] = None
    payment_structure: Optional[str] = None


class EngagementNoteUpdate(BaseModel):
    content: Optional[str] = None


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

    # The "connection accepted" notification lives here rather than in
    # PATCH /connections/:id -- this is the first point a real engagement_id
    # exists for the notification's action_url to link to.
    notify_org = await organization_model.get(connection["org_id"])
    notify_expert = await expert_model.get(connection["expert_id"])
    await notification_model.create(
        notify_org["user_id"], "connection_accepted",
        f"{notify_expert['first_name']} {notify_expert['last_name']} accepted your connection request",
        related_entity_type="engagement", related_entity_id=row["engagement_id"],
        action_url=f"/engagements/{row['engagement_id']}",
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
    await engagement_model.expire_stale_proposals()
    role = current_user["role"]

    if role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert is None:
            return _paginate([])
        rows = await engagement_model.list_for_expert(
            expert["expert_profile_id"], status=status, engagement_type=engagement_type,
        )
        return _paginate(rows)

    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is None:
            return _paginate([])
        rows = await engagement_model.list_for_org(
            org["org_profile_id"], status=status, engagement_type=engagement_type,
        )
        return _paginate(rows)

    return _paginate([])


# ---------------------------------------------------------------------------
# GET /engagements/:engagementId
# ---------------------------------------------------------------------------

@router.get("/engagements/{engagement_id}")
async def get_engagement(engagement_id: int, current_user=Depends(get_current_user)):
    await engagement_model.expire_stale_proposals()
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
    await engagement_model.expire_stale_proposals()
    role, _ = await _require_participant(engagement_id, current_user)
    updates = body.model_dump(exclude_none=True)
    return await engagement_model.update(engagement_id, caller_role=role, updates=updates)


# ---------------------------------------------------------------------------
# Engagement terms negotiation -- once active/on_hold, dates/budget/payment
# structure no longer go through PATCH (see the guard in engagement_model.
# update()); either party proposes a change here and the *other* party
# accepts or declines. Mirrors the milestone propose/accept/decline endpoints
# above, but bidirectional -- either role can be the proposer.
# ---------------------------------------------------------------------------

def _terms_change_label(eng: dict) -> str:
    labels = []
    if eng.get("pending_start_date") is not None:
        labels.append("start date")
    if eng.get("pending_estimated_end_date") is not None:
        labels.append("estimated end date")
    if eng.get("pending_agreed_budget") is not None:
        labels.append("budget")
    if eng.get("pending_payment_structure") is not None:
        labels.append("payment structure")
    if len(labels) <= 1:
        return labels[0] if labels else "the engagement terms"
    return ", ".join(labels[:-1]) + f" and {labels[-1]}"


@router.post("/engagements/{engagement_id}/propose-terms")
async def propose_engagement_terms(
    engagement_id: int,
    body: EngagementTermsPropose,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    eng = await engagement_model.get(engagement_id)
    updated = await engagement_model.propose_terms_change(
        engagement_id, current_user["user_id"], **body.model_dump(exclude_none=True)
    )

    org = await organization_model.get(eng["org_id"])
    expert = await expert_model.get(eng["expert_id"])
    other_user_id = expert["user_id"] if role == "organization" else org["user_id"]
    proposer_name = org["org_name"] if role == "organization" else f"{expert['first_name']} {expert['last_name']}"
    await notification_model.create(
        other_user_id, "engagement_terms_proposed",
        f"{proposer_name} proposed a change to {_terms_change_label(updated)}",
        related_entity_type="engagement", related_entity_id=engagement_id,
        action_url=f"/engagements/{engagement_id}",
    )
    return updated


@router.post("/engagements/{engagement_id}/terms/accept")
async def accept_engagement_terms(
    engagement_id: int,
    current_user=Depends(get_current_user),
):
    await _require_participant(engagement_id, current_user)
    eng = await engagement_model.get(engagement_id)
    if eng["pending_requested_by_user_id"] == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You cannot accept your own proposed change"}},
        )
    proposer_user_id = eng["pending_requested_by_user_id"]
    label = _terms_change_label(eng)
    updated = await engagement_model.accept_terms_change(engagement_id)

    if proposer_user_id is not None:
        await notification_model.create(
            proposer_user_id, "engagement_terms_accepted",
            f"Your proposed change to {label} was accepted",
            related_entity_type="engagement", related_entity_id=engagement_id,
            action_url=f"/engagements/{engagement_id}",
        )
    return updated


@router.post("/engagements/{engagement_id}/terms/decline")
async def decline_engagement_terms(
    engagement_id: int,
    current_user=Depends(get_current_user),
):
    await _require_participant(engagement_id, current_user)
    eng = await engagement_model.get(engagement_id)
    if eng["pending_requested_by_user_id"] == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You cannot decline your own proposed change"}},
        )
    proposer_user_id = eng["pending_requested_by_user_id"]
    label = _terms_change_label(eng)
    updated = await engagement_model.decline_terms_change(engagement_id)

    if proposer_user_id is not None:
        await notification_model.create(
            proposer_user_id, "engagement_terms_declined",
            f"Your proposed change to {label} was declined",
            related_entity_type="engagement", related_entity_id=engagement_id,
            action_url=f"/engagements/{engagement_id}",
        )
    return updated


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
    created = await milestone_model.create(
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
    if role == "expert":
        org = await organization_model.get(eng["org_id"])
        await notification_model.create(
            org["user_id"], "milestone_proposed",
            f"The expert proposed a new milestone \"{created['title']}\"",
            related_entity_type="milestone", related_entity_id=created["milestone_id"],
            action_url=f"/engagements/{engagement_id}?highlight_milestone={created['milestone_id']}",
        )
    return created


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
# Milestone change negotiation -- once a milestone is confirmed/in_progress,
# the org can no longer PATCH it directly (see patch_milestone above); instead
# it proposes a change or a cancellation, and the expert accepts or declines.
# Deliberately separate endpoints rather than folding into patch_milestone:
# that keeps "immediate mutation" and "deferred proposal" as distinct verbs.
# ---------------------------------------------------------------------------

def _milestone_or_404(m: dict, engagement_id: int) -> None:
    if m["engagement_id"] != engagement_id:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Milestone not found in this engagement"}},
        )


@router.post("/engagements/{engagement_id}/milestones/{milestone_id}/propose-change")
async def propose_milestone_change(
    engagement_id: int,
    milestone_id: int,
    body: MilestoneProposeChange,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "organization":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only organizations can propose milestone changes"}},
        )
    eng = await engagement_model.get(engagement_id)
    if eng["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Cannot propose milestone changes on a completed or cancelled engagement"}},
        )
    m = await milestone_model.get(milestone_id)
    _milestone_or_404(m, engagement_id)
    if m["status"] not in ("confirmed", "in_progress"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE",
                              "message": "Can only propose changes to a confirmed or in-progress milestone"}},
        )
    if body.due_date is None and body.deliverable_description is None:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "VALIDATION_ERROR",
                              "message": "Provide at least one of due_date or deliverable_description"}},
        )

    updated = await milestone_model.propose_change(
        milestone_id, current_user["user_id"],
        due_date=body.due_date, deliverable_description=body.deliverable_description,
    )

    org = await organization_model.get(eng["org_id"])
    expert = await expert_model.get(eng["expert_id"])
    await notification_model.create(
        expert["user_id"], "milestone_change_proposed",
        f"{org['org_name']} proposed a change to milestone \"{m['title']}\"",
        related_entity_type="milestone", related_entity_id=milestone_id,
        action_url=f"/engagements/{engagement_id}?highlight_milestone={milestone_id}",
    )
    return updated


@router.post("/engagements/{engagement_id}/milestones/{milestone_id}/propose-cancel")
async def propose_milestone_cancel(
    engagement_id: int,
    milestone_id: int,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "organization":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only organizations can request milestone cancellation"}},
        )
    eng = await engagement_model.get(engagement_id)
    if eng["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Cannot request milestone cancellation on a completed or cancelled engagement"}},
        )
    m = await milestone_model.get(milestone_id)
    _milestone_or_404(m, engagement_id)
    if m["status"] not in ("confirmed", "in_progress"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE",
                              "message": "Can only request cancellation of a confirmed or in-progress milestone"}},
        )

    updated = await milestone_model.propose_cancel(milestone_id, current_user["user_id"])

    org = await organization_model.get(eng["org_id"])
    expert = await expert_model.get(eng["expert_id"])
    await notification_model.create(
        expert["user_id"], "milestone_change_proposed",
        f"{org['org_name']} proposed cancelling milestone \"{m['title']}\"",
        related_entity_type="milestone", related_entity_id=milestone_id,
        action_url=f"/engagements/{engagement_id}?highlight_milestone={milestone_id}",
    )
    return updated


@router.post("/engagements/{engagement_id}/milestones/{milestone_id}/accept-change")
async def accept_milestone_change(
    engagement_id: int,
    milestone_id: int,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only experts can accept milestone changes"}},
        )
    eng = await engagement_model.get(engagement_id)
    if eng["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Cannot accept milestone changes on a completed or cancelled engagement"}},
        )
    m = await milestone_model.get(milestone_id)
    _milestone_or_404(m, engagement_id)
    pending_action = m["pending_action"]  # read before accept_pending clears it

    updated = await milestone_model.accept_pending(milestone_id)

    org = await organization_model.get(eng["org_id"])
    if pending_action == "cancel":
        title = f"Milestone \"{m['title']}\" was cancelled"
    else:
        changed = []
        if m["pending_due_date"] is not None:
            changed.append("Date")
        if m["pending_deliverable_description"] is not None:
            changed.append("Deliverable")
        title = f"{' and '.join(changed)} change confirmed for milestone \"{m['title']}\""
    await notification_model.create(
        org["user_id"], "milestone_change_confirmed", title,
        related_entity_type="milestone", related_entity_id=milestone_id,
        action_url=f"/engagements/{engagement_id}?highlight_milestone={milestone_id}&flash=confirmed",
    )
    return updated


@router.post("/engagements/{engagement_id}/milestones/{milestone_id}/decline-change")
async def decline_milestone_change(
    engagement_id: int,
    milestone_id: int,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only experts can decline milestone changes"}},
        )
    eng = await engagement_model.get(engagement_id)
    if eng["status"] in ("completed", "cancelled"):
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "INVALID_STATE", "message": "Cannot decline milestone changes on a completed or cancelled engagement"}},
        )
    m = await milestone_model.get(milestone_id)
    _milestone_or_404(m, engagement_id)

    updated = await milestone_model.decline_pending(milestone_id)

    org = await organization_model.get(eng["org_id"])
    expert = await expert_model.get(eng["expert_id"])
    await notification_model.create(
        org["user_id"], "milestone_change_declined",
        f"{expert['first_name']} {expert['last_name']} declined your proposed change to milestone \"{m['title']}\"",
        related_entity_type="milestone", related_entity_id=milestone_id,
        action_url=f"/engagements/{engagement_id}?highlight_milestone={milestone_id}",
    )
    return updated


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


# ---------------------------------------------------------------------------
# GET/PUT /engagements/:engagementId/notes -- private, expert-only scratchpad.
# The organization side of the engagement never sees these.
# ---------------------------------------------------------------------------

@router.get("/engagements/{engagement_id}/notes")
async def get_engagement_notes(engagement_id: int, current_user=Depends(get_current_user)):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only the expert can view these notes"}},
        )
    note = await engagement_note_model.get(engagement_id, current_user["user_id"])
    return {"content": note["content"] if note else None}


@router.put("/engagements/{engagement_id}/notes")
async def update_engagement_notes(
    engagement_id: int,
    body: EngagementNoteUpdate,
    current_user=Depends(get_current_user),
):
    role, _ = await _require_participant(engagement_id, current_user)
    if role != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Only the expert can edit these notes"}},
        )
    note = await engagement_note_model.upsert(engagement_id, current_user["user_id"], body.content)
    return {"content": note["content"]}
