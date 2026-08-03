from __future__ import annotations

from fastapi import APIRouter, Depends, Request, UploadFile

from server.dependencies import get_current_user
from server.storage import save_upload

router = APIRouter(tags=["uploads"])


@router.post("/uploads")
async def upload_file(
    request: Request,
    file: UploadFile,
    current_user=Depends(get_current_user),
):
    """
    Generic file upload — any authenticated user. Returns an absolute URL
    (not just a browser-relative path) since submitted_document_urls entries
    are also fetched server-side (ai_verification.py), not only opened by a
    browser tab.
    """
    relative_path = await save_upload(file)
    absolute_url = str(request.base_url).rstrip("/") + relative_path
    return {"url": absolute_url}
