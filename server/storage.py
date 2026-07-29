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
_READ_CHUNK_BYTES = 1024 * 1024  # 1MB — bounds how far over the cap a single chunk can push us

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

    # Read in bounded chunks and bail as soon as the cap is exceeded, rather
    # than buffering the whole body first -- an oversized upload would
    # otherwise sit fully in memory before this check ever ran.
    chunks = bytearray()
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        chunks.extend(chunk)
        if len(chunks) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "FILE_TOO_LARGE",
                                  "message": "File exceeds the 10MB upload limit."}},
            )

    UPLOAD_DIR.mkdir(exist_ok=True)
    filename = f"{uuid.uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(bytes(chunks))

    return f"/uploads/{filename}"
