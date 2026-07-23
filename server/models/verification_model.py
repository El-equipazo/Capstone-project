from __future__ import annotations

from server.db import connection_pool as pool

_COLS = (
    "verification_id, user_id, verification_type, related_credential_id, "
    "status, submitted_document_urls, admin_notes, rejection_reason, "
    "reviewed_at, expires_at, created_at"
)


async def create(
    user_id: int,
    verification_type: str,
    related_credential_id=None,
    submitted_document_urls=None,
) -> dict:
    row = await pool.fetchrow(
        f"""
        INSERT INTO verification_records
            (user_id, verification_type, related_credential_id, submitted_document_urls, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING {_COLS}
        """,
        user_id,
        verification_type,
        related_credential_id,
        submitted_document_urls,
    )
    return dict(row)


async def list_for_user(user_id: int) -> list:
    rows = await pool.fetch(
        f"""
        SELECT {", ".join(f"vr.{c.strip()}" for c in _COLS.split(","))},
               ec.credential_name
        FROM verification_records vr
        LEFT JOIN expert_credentials ec ON ec.credential_id = vr.related_credential_id
        WHERE vr.user_id = $1
        ORDER BY vr.created_at DESC
        """,
        user_id,
    )
    return [dict(r) for r in rows]


async def credential_belongs_to_user(credential_id: int, user_id: int) -> bool:
    val = await pool.fetchval(
        """
        SELECT 1
        FROM expert_credentials ec
        JOIN expert_profiles ep ON ep.expert_profile_id = ec.expert_id
        WHERE ec.credential_id = $1 AND ep.user_id = $2
        """,
        credential_id,
        user_id,
    )
    return val == 1
