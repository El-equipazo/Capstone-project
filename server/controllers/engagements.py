from __future__ import annotations

from fastapi import APIRouter, Depends

from server.dependencies import get_current_user
from server.models import engagement_model, expert_model, organization_model

router = APIRouter(tags=["engagements"])


@router.get("/engagements")
async def list_engagements(current_user=Depends(get_current_user)):
    role = current_user["role"]

    if role == "expert":
        expert = await expert_model.find_by_user(current_user["user_id"])
        if expert is None:
            return []
        return await engagement_model.list_for_expert(expert["expert_profile_id"])

    if role == "organization":
        org = await organization_model.find_by_user(current_user["user_id"])
        if org is None:
            return []
        return await engagement_model.list_for_org(org["org_profile_id"])

    return []
