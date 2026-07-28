"""
storage — local disk storage for user-uploaded files (POST /uploads).

Not tied to any one feature — currently used for verification documents, but
generic enough for anything else that needs "let someone upload a file, get
back a URL." A real production deployment would use S3/GCS with signed
upload URLs instead; local disk is the right tradeoff for this project.
"""

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB — matches the fetch cap in ai_verification.py

_CONTENT_TYPE_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


async def save_upload(file: UploadFile) -> str:
    """
    Validates and saves an uploaded file to local disk. Returns the relative
    URL path (e.g. "/uploads/<uuid>.pdf") — never the user-supplied filename,
    to avoid path traversal/overwrite from a crafted upload.
    """
    extension = _CONTENT_TYPE_EXTENSIONS.get(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "UNSUPPORTED_TYPE",
                              "message": f"Unsupported file type: {file.content_type}. "
                                         f"Allowed: PDF, PNG, JPEG, WEBP."}},
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "FILE_TOO_LARGE",
                              "message": "File exceeds the 10MB upload limit."}},
        )

    UPLOAD_DIR.mkdir(exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)

    return f"/uploads/{filename}"
