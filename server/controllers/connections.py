from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.db import connection_pool as pool
from server.dependencies import get_current_user, require_role
from server.models import connection_model, expert_model, matching, organization_model
from server.models.errors import NotFoundError

router = APIRouter(tags=["connections"])


class ConnectionCreate(BaseModel):
    expert_id: int
    initial_message: Optional[str] = None
    org_stated_need: Optional[str] = None
    org_stated_timeline: Optional[str] = None


class ConnectionRespond(BaseModel):
    status: str  # 'accepted' | 'declined'


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


async def _require_connection_participant(connection: dict, current_user: dict) -> None:
    role = current_user["role"]
    if role == "admin":
        return
    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is not None and org["org_profile_id"] == connection["org_id"]:
            return
    elif role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert is not None and expert["expert_profile_id"] == connection["expert_id"]:
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": {"code": "FORBIDDEN", "message": "Not a participant in this connection request"}},
    )


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

    expert = await expert_model.get(body.expert_id)
    if expert["availability_status"] == "unavailable":
        raise HTTPException(
            status_code=422,
            detail={
                "error": {
                    "code": "UNAVAILABLE",
                    "message": "This expert is not currently available for new requests.",
                }
            },
        )

    try:
        org_infra = await organization_model.get_infrastructure(org["org_profile_id"])
    except NotFoundError:
        org_infra = None

    match_score, factors = matching.compute_match_factors(org, org_infra, expert)

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
        match_score=match_score,
        factors=factors,
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
            return _paginate([])
        params = [expert["expert_profile_id"]]
        where = "cr.expert_id = $1"
        if connection_status:
            where += " AND cr.status = $2"
            params.append(connection_status)
        rows = await pool.fetch(
            f"""
            SELECT cr.connection_id, cr.org_id, cr.expert_id, cr.status,
                   cr.initial_message, cr.org_stated_need, cr.org_stated_timeline,
                   cr.match_score, cr.created_at, cr.expires_at, cr.responded_at,
                   op.org_name, op.sector AS org_sector
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            WHERE {where}
            ORDER BY cr.created_at DESC
            """,
            *params,
        )
        return _paginate([dict(r) for r in rows])

    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is None:
            return _paginate([])
        params = [org["org_profile_id"]]
        where = "cr.org_id = $1"
        if connection_status:
            where += " AND cr.status = $2"
            params.append(connection_status)
        rows = await pool.fetch(
            f"""
            SELECT cr.connection_id, cr.org_id, cr.expert_id, cr.status,
                   cr.initial_message, cr.org_stated_need, cr.org_stated_timeline,
                   cr.match_score, cr.created_at, cr.expires_at, cr.responded_at,
                   op.org_name, op.sector AS org_sector
            FROM connection_requests cr
            JOIN organization_profiles op ON op.org_profile_id = cr.org_id
            WHERE {where}
            ORDER BY cr.created_at DESC
            """,
            *params,
        )
        return _paginate([dict(r) for r in rows])

    return _paginate([])


@router.get("/connections/{connection_id}")
async def get_connection(
    connection_id: int,
    current_user=Depends(get_current_user),
):
    connection = await connection_model.get(connection_id)
    await _require_connection_participant(connection, current_user)
    return dict(connection)


@router.get("/connections/{connection_id}/score-factors")
async def get_connection_score_factors(
    connection_id: int,
    current_user=Depends(get_current_user),
):
    connection = await connection_model.get(connection_id)
    await _require_connection_participant(connection, current_user)
    factors = await connection_model.get_score_factors(connection_id)
    return {
        "connection_id": connection_id,
        "match_score": connection["match_score"],
        "factors": [dict(f) for f in factors],
    }


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
    return dict(updated)
