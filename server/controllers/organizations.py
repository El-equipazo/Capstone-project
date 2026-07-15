from fastapi import APIRouter, Depends, HTTPException, Response, status

from server.dependencies import get_current_user, require_role
from server.schemas.organizations import (
    InfrastructureCreate,
    InfrastructureResponse,
    OrgCreate,
    OrgResponse,
    OrgUpdate,
)

try:
    from server.models import organization_model
except ImportError:
    class _Stub:
        def __getattr__(self, attr):
            async def _not_implemented(*args, **kwargs):
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "NOT_IMPLEMENTED", "message": "organization_model not yet available"}},
                )
            return _not_implemented
    organization_model = _Stub()

router = APIRouter(tags=["organizations"])


def _assert_owner_or_admin(current_user, org_row):
    """Raise 403 if caller is not the org owner or an admin."""
    if current_user["role"] != "admin" and org_row["user_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Not the organization owner"}},
        )


# ── Core profile ──────────────────────────────────────────────────────────────

@router.post("/organizations", status_code=201, response_model=OrgResponse)
async def create_organization(
    body: OrgCreate,
    current_user=Depends(require_role("organization")),
):
    row = await organization_model.create(current_user["user_id"], body.model_dump())
    return dict(row)


@router.get("/organizations/{org_id}", response_model=OrgResponse)
async def get_organization(org_id: int, current_user=Depends(get_current_user)):
    row = await organization_model.get(org_id)
    # Non-owners and non-admins see public fields only; owner/admin see everything.
    # The model can implement field filtering — for now return the full row to
    # all authenticated users and let the model layer handle visibility.
    return dict(row)


@router.patch("/organizations/{org_id}", response_model=OrgResponse)
async def update_organization(
    org_id: int,
    body: OrgUpdate,
    current_user=Depends(get_current_user),
):
    row = await organization_model.get(org_id)
    _assert_owner_or_admin(current_user, row)
    updated = await organization_model.update(org_id, body.model_dump(exclude_none=True))
    return dict(updated)


# ── Infrastructure ────────────────────────────────────────────────────────────

@router.put("/organizations/{org_id}/infrastructure", response_model=InfrastructureResponse)
async def upsert_infrastructure(
    org_id: int,
    body: InfrastructureCreate,
    current_user=Depends(require_role("organization")),
):
    org_row = await organization_model.get(org_id)
    _assert_owner_or_admin(current_user, org_row)
    result = await organization_model.upsert_infrastructure(org_id, body.model_dump(exclude_none=True))
    return dict(result)


@router.get("/organizations/{org_id}/infrastructure", response_model=InfrastructureResponse)
async def get_infrastructure(org_id: int, current_user=Depends(get_current_user)):
    org_row = await organization_model.get(org_id)
    # Infrastructure is sensitive — accessible only to the owner, admins, or an
    # expert with an accepted connection / active engagement (§3 of the contract).
    # The connection/engagement check requires the connection model; for now enforce
    # owner + admin access. Expand once the connection model is available.
    is_owner = org_row["user_id"] == current_user["user_id"]
    is_admin = current_user["role"] == "admin"
    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "Infrastructure data is restricted"}},
        )
    result = await organization_model.get_infrastructure(org_id)
    return dict(result)
