from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from server.dependencies import require_role
from server.models import admin_model

router = APIRouter(tags=["admin"])


class SetUserActiveBody(BaseModel):
    is_active: bool


class DecideVerificationBody(BaseModel):
    status: str
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    expires_at: Optional[str] = None


class VerifyProfileBody(BaseModel):
    is_verified: bool


@router.get("/admin/users")
async def list_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user=Depends(require_role("admin")),
):
    return await admin_model.list_users(role=role, is_active=is_active)


@router.patch("/admin/users/{user_id}")
async def set_user_active(
    user_id: int,
    body: SetUserActiveBody,
    current_user=Depends(require_role("admin")),
):
    return await admin_model.set_user_active(user_id, body.is_active)


@router.get("/admin/verifications")
async def list_verifications(
    status_filter: Optional[str] = Query(None, alias="status"),
    verification_type: Optional[str] = Query(None),
    current_user=Depends(require_role("admin")),
):
    return await admin_model.list_verifications(
        status=status_filter, verification_type=verification_type
    )


@router.patch("/admin/verifications/{verification_id}")
async def decide_verification(
    verification_id: int,
    body: DecideVerificationBody,
    current_user=Depends(require_role("admin")),
):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_STATUS",
                              "message": "status must be 'approved' or 'rejected'"}},
        )
    expires_at: Optional[date] = None
    if body.expires_at is not None:
        try:
            expires_at = date.fromisoformat(body.expires_at)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_DATE",
                                  "message": "expires_at must be a valid ISO date (YYYY-MM-DD)"}},
            )
    return await admin_model.decide_verification(
        verification_id=verification_id,
        admin_user_id=current_user["user_id"],
        status=body.status,
        admin_notes=body.admin_notes,
        rejection_reason=body.rejection_reason,
        expires_at=expires_at,
    )


@router.get("/admin/experts")
async def list_expert_profiles(
    is_verified: Optional[bool] = Query(None),
    current_user=Depends(require_role("admin")),
):
    return await admin_model.list_expert_profiles(is_verified=is_verified)


@router.patch("/admin/experts/{expert_profile_id}/verify")
async def set_expert_verified(
    expert_profile_id: int,
    body: VerifyProfileBody,
    current_user=Depends(require_role("admin")),
):
    return await admin_model.set_expert_verified(expert_profile_id, body.is_verified)


@router.get("/admin/organizations")
async def list_organization_profiles(
    is_verified: Optional[bool] = Query(None),
    current_user=Depends(require_role("admin")),
):
    return await admin_model.list_organization_profiles(is_verified=is_verified)


@router.patch("/admin/organizations/{org_profile_id}/verify")
async def verify_organization(
    org_profile_id: int,
    body: VerifyProfileBody,
    current_user=Depends(require_role("admin")),
):
    if not body.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_VALUE",
                              "message": "is_verified must be true"}},
        )
    return await admin_model.verify_organization(org_profile_id)
