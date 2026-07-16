from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.db import connection_pool as pool
from server.dependencies import get_current_user, require_role
from server.models import connection_model, engagement_model, expert_model, organization_model
from server.models.errors import GoneError, NotFoundError, TransitionError

router = APIRouter(tags=["connections"])


class ConnectionCreate(BaseModel):
    expert_id: int
    initial_message: Optional[str] = None
    org_stated_need: Optional[str] = None
    org_stated_timeline: Optional[str] = None


class ConnectionRespond(BaseModel):
    status: str  # 'accepted' | 'declined'


def _make_engagement_title(org_stated_need: Optional[str], org_name: str) -> str:
    if org_stated_need:
        label = org_stated_need.replace("_", " ").title()
        return f"{label} — {org_name}"
    return f"Engagement — {org_name}"


@router.post("/connections", status_code=201)
async def create_connection(
    body: ConnectionCreate,
    current_user=Depends(require_role("organization")),
):
    org = await organization_model.find_by_user(current_user["user_id"])
    if org is None:
        # Auto-create a minimal profile so new org accounts can send requests
        # without a separate setup step. They can fill in details later via PATCH /organizations.
        org_name = current_user["email"].split("@")[0]
        org = await organization_model.create(current_user["user_id"], {
            "org_name": org_name,
            "sector": "other",
        })

    # Default expiry from org's preference, fallback to 30 days
    expiry_days = org.get("default_connection_expiry_days") or 30
    expires_at = datetime.utcnow() + timedelta(days=expiry_days)

    row = await connection_model.create(
        org_id=org["org_profile_id"],
        expert_id=body.expert_id,
        initiated_by_user_id=current_user["user_id"],
        initial_message=body.initial_message,
        org_stated_need=body.org_stated_need,
        org_stated_timeline=body.org_stated_timeline,
        expires_at=expires_at,
    )
    return dict(row)


@router.get("/connections")
async def list_connections(
    connection_status: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
):
    role = current_user["role"]

    if role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert is None:
            return []
        rows = await pool.fetch(
            """
            SELECT cr.connection_id, cr.org_id, cr.expert_id, cr.status,
                   cr.initial_message, cr.org_stated_need, cr.org_stated_timeline,
                   cr.match_score, cr.created_at, cr.expires_at, cr.responded_at,
                   op.org_name, op.sector AS org_sector
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            WHERE cr.expert_id = $1
            ORDER BY cr.created_at DESC
            """,
            expert["expert_profile_id"],
        )
        return [dict(r) for r in rows]

    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is None:
            return []
        rows = await pool.fetch(
            """
            SELECT cr.connection_id, cr.org_id, cr.expert_id, cr.status,
                   cr.initial_message, cr.org_stated_need, cr.org_stated_timeline,
                   cr.match_score, cr.created_at, cr.expires_at, cr.responded_at,
                   op.org_name, op.sector AS org_sector
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            WHERE cr.org_id = $1
            ORDER BY cr.created_at DESC
            """,
            org["org_profile_id"],
        )
        return [dict(r) for r in rows]

    return []


@router.patch("/connections/{connection_id}")
async def respond_to_connection(
    connection_id: int,
    body: ConnectionRespond,
    current_user=Depends(require_role("expert")),
):
    expert = await expert_model.find_by_user(current_user["user_id"])
    if expert is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Complete your expert profile first"}},
        )

    connection = await connection_model.get(connection_id)
    if connection["expert_id"] != expert["expert_profile_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not your connection request"}},
        )

    updated = await connection_model.respond(connection_id, body.status)

    if body.status == "accepted":
        org_row = await pool.fetchrow(
            "SELECT org_name FROM organization_profiles WHERE org_profile_id = $1",
            updated["org_id"],
        )
        org_name = org_row["org_name"] if org_row else "Unknown"
        engagement_type = updated["org_stated_need"] or "risk_assessment"
        title = _make_engagement_title(updated["org_stated_need"], org_name)
        await engagement_model.create(
            connection_id=updated["connection_id"],
            org_id=updated["org_id"],
            expert_id=updated["expert_id"],
            engagement_type=engagement_type,
            title=title,
        )

    return dict(updated)
