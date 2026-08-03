from __future__ import annotations

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, StringConstraints

from server.dependencies import get_current_user
from server.models import verification_model

router = APIRouter(tags=["verifications"])

_EXPERT_TYPES = {"identity", "professional_credential", "background_check"}
_ORG_TYPES = {"identity", "organization_legitimacy"}

# submitted_document_urls is server-side-fetched later (ai_verification.py) --
# capping count and per-URL length keeps a single verification from carrying
# an unbounded number of fetch targets.
_MAX_DOCUMENT_URLS = 5
_MAX_URL_LENGTH = 2048
DocumentUrl = Annotated[str, StringConstraints(max_length=_MAX_URL_LENGTH, min_length=1)]


class SubmitVerificationBody(BaseModel):
    verification_type: str
    related_credential_id: Optional[int] = None
    submitted_document_urls: Optional[List[DocumentUrl]] = Field(default=None, max_length=_MAX_DOCUMENT_URLS)


@router.post("/verifications", status_code=201)
async def submit_verification(
    body: SubmitVerificationBody,
    current_user=Depends(get_current_user),
):
    role = current_user["role"]
    user_id = current_user["user_id"]

    allowed = _EXPERT_TYPES if role == "expert" else _ORG_TYPES
    if body.verification_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_TYPE",
                    "message": f"verification_type must be one of: {', '.join(sorted(allowed))}",
                }
            },
        )

    if body.verification_type == "professional_credential":
        if not body.related_credential_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "MISSING_CREDENTIAL",
                        "message": "related_credential_id is required for professional_credential verification",
                    }
                },
            )
        owned = await verification_model.credential_belongs_to_user(
            body.related_credential_id, user_id
        )
        if not owned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "Credential does not belong to your profile",
                    }
                },
            )

    record = await verification_model.create(
        user_id=user_id,
        verification_type=body.verification_type,
        related_credential_id=body.related_credential_id,
        submitted_document_urls=body.submitted_document_urls,
    )
    return record


@router.get("/verifications")
async def list_my_verifications(current_user=Depends(get_current_user)):
    return await verification_model.list_for_user(current_user["user_id"])
