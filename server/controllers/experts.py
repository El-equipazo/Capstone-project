from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from server.dependencies import get_current_user, require_role
from server.schemas.experts import (
    CredentialCreate,
    CredentialUpdate,
    EngagementTypeCreate,
    EngagementTypeUpdate,
    ExpertCreate,
    ExpertListItem,
    ExpertResponse,
    ExpertUpdate,
    SectorExperienceCreate,
    SectorExperienceUpdate,
    SpecializationCreate,
    SpecializationUpdate,
    WorkHistoryCreate,
    WorkHistoryUpdate,
)

try:
    from server.models import expert_model
except ImportError:
    class _Stub:
        def __getattr__(self, attr):
            async def _not_implemented(*args, **kwargs):
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "NOT_IMPLEMENTED", "message": "expert_model not yet available"}},
                )
            return _not_implemented
    expert_model = _Stub()

router = APIRouter(tags=["experts"])


def _assert_owner_or_admin(current_user, expert_row):
    """Raise 403 if the caller is not the profile owner or an admin."""
    if current_user["role"] != "admin" and expert_row["user_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not the profile owner"}},
        )


# ── Core profile ──────────────────────────────────────────────────────────────

@router.post("/experts", status_code=201, response_model=ExpertResponse)
async def create_expert(
    body: ExpertCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.create(current_user["user_id"], body.model_dump())
    return dict(row)


@router.get("/experts")
async def list_experts(
    q: Optional[str] = Query(None),
    specialization: Optional[str] = Query(None),
    proficiency_min: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    compliance: Optional[str] = Query(None),
    engagement_type: Optional[str] = Query(None),
    availability: Optional[str] = Query(None),
    rate_max: Optional[float] = Query(None),
    rating_min: Optional[float] = Query(None, ge=1, le=5),
    years_experience_min: Optional[int] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at"),
    order: str = Query("desc"),
):
    filters = {
        k: v for k, v in {
            "q": q,
            "specialization": specialization,
            "proficiency_min": proficiency_min,
            "sector": sector,
            "compliance": compliance,
            "engagement_type": engagement_type,
            "availability": availability,
            "rate_max": rate_max,
            "rating_min": rating_min,
            "years_experience_min": years_experience_min,
        }.items() if v is not None
    }
    return await expert_model.list(filters=filters, page=page, limit=limit, sort=sort, order=order)


@router.get("/experts/{expert_id}", response_model=ExpertResponse)
async def get_expert(expert_id: int):
    row = await expert_model.get(expert_id)
    return dict(row)


@router.patch("/experts/{expert_id}", response_model=ExpertResponse)
async def update_expert(
    expert_id: int,
    body: ExpertUpdate,
    current_user=Depends(get_current_user),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    updated = await expert_model.update(expert_id, body.model_dump(exclude_none=True))
    return dict(updated)


# ── Credentials ───────────────────────────────────────────────────────────────

@router.post("/experts/{expert_id}/credentials", status_code=201, response_model=ExpertResponse.__annotations__["credentials"].__args__[0])
async def add_credential(
    expert_id: int,
    body: CredentialCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.add_credential(expert_id, body.model_dump())
    return dict(result)


@router.get("/experts/{expert_id}/credentials")
async def list_credentials(expert_id: int):
    return await expert_model.list_credentials(expert_id)


@router.patch("/experts/{expert_id}/credentials/{credential_id}")
async def update_credential(
    expert_id: int,
    credential_id: int,
    body: CredentialUpdate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.update_credential(expert_id, credential_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.delete("/experts/{expert_id}/credentials/{credential_id}", status_code=204)
async def delete_credential(
    expert_id: int,
    credential_id: int,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    await expert_model.delete_credential(expert_id, credential_id)
    return Response(status_code=204)


# ── Work history ──────────────────────────────────────────────────────────────

@router.post("/experts/{expert_id}/work-history", status_code=201)
async def add_work_history(
    expert_id: int,
    body: WorkHistoryCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.add_work_history(expert_id, body.model_dump())
    return dict(result)


@router.get("/experts/{expert_id}/work-history")
async def list_work_history(expert_id: int):
    return await expert_model.list_work_history(expert_id)


@router.patch("/experts/{expert_id}/work-history/{work_history_id}")
async def update_work_history(
    expert_id: int,
    work_history_id: int,
    body: WorkHistoryUpdate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.update_work_history(expert_id, work_history_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.delete("/experts/{expert_id}/work-history/{work_history_id}", status_code=204)
async def delete_work_history(
    expert_id: int,
    work_history_id: int,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    await expert_model.delete_work_history(expert_id, work_history_id)
    return Response(status_code=204)


# ── Specializations ───────────────────────────────────────────────────────────

@router.post("/experts/{expert_id}/specializations", status_code=201)
async def add_specialization(
    expert_id: int,
    body: SpecializationCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.add_specialization(expert_id, body.model_dump())
    return dict(result)


@router.get("/experts/{expert_id}/specializations")
async def list_specializations(expert_id: int):
    return await expert_model.list_specializations(expert_id)


@router.patch("/experts/{expert_id}/specializations/{specialization_id}")
async def update_specialization(
    expert_id: int,
    specialization_id: int,
    body: SpecializationUpdate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.update_specialization(expert_id, specialization_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.delete("/experts/{expert_id}/specializations/{specialization_id}", status_code=204)
async def delete_specialization(
    expert_id: int,
    specialization_id: int,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    await expert_model.delete_specialization(expert_id, specialization_id)
    return Response(status_code=204)


# ── Sector experience ─────────────────────────────────────────────────────────

@router.post("/experts/{expert_id}/sector-experience", status_code=201)
async def add_sector_experience(
    expert_id: int,
    body: SectorExperienceCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.add_sector_experience(expert_id, body.model_dump())
    return dict(result)


@router.get("/experts/{expert_id}/sector-experience")
async def list_sector_experience(expert_id: int):
    return await expert_model.list_sector_experience(expert_id)


@router.patch("/experts/{expert_id}/sector-experience/{sector_exp_id}")
async def update_sector_experience(
    expert_id: int,
    sector_exp_id: int,
    body: SectorExperienceUpdate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.update_sector_experience(expert_id, sector_exp_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.delete("/experts/{expert_id}/sector-experience/{sector_exp_id}", status_code=204)
async def delete_sector_experience(
    expert_id: int,
    sector_exp_id: int,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    await expert_model.delete_sector_experience(expert_id, sector_exp_id)
    return Response(status_code=204)


# ── Engagement types ──────────────────────────────────────────────────────────

@router.post("/experts/{expert_id}/engagement-types", status_code=201)
async def add_engagement_type(
    expert_id: int,
    body: EngagementTypeCreate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.add_engagement_type(expert_id, body.model_dump())
    return dict(result)


@router.get("/experts/{expert_id}/engagement-types")
async def list_engagement_types(expert_id: int):
    return await expert_model.list_engagement_types(expert_id)


@router.patch("/experts/{expert_id}/engagement-types/{eng_type_id}")
async def update_engagement_type(
    expert_id: int,
    eng_type_id: int,
    body: EngagementTypeUpdate,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    result = await expert_model.update_engagement_type(expert_id, eng_type_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.delete("/experts/{expert_id}/engagement-types/{eng_type_id}", status_code=204)
async def delete_engagement_type(
    expert_id: int,
    eng_type_id: int,
    current_user=Depends(require_role("expert")),
):
    row = await expert_model.get(expert_id)
    _assert_owner_or_admin(current_user, row)
    await expert_model.delete_engagement_type(expert_id, eng_type_id)
    return Response(status_code=204)
