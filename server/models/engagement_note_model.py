"""
engagement_note_model — private per-engagement scratchpad for the expert.

One row per (engagement, expert_user_id) pair. Never exposed to the
organization side of the engagement.
"""
from __future__ import annotations

from server.db import connection_pool as pool


async def get(engagement_id: int, expert_user_id: int) -> dict | None:
    row = await pool.fetchrow(
        "SELECT * FROM engagement_notes WHERE engagement_id = $1 AND expert_user_id = $2",
        engagement_id, expert_user_id,
    )
    return dict(row) if row else None


async def upsert(engagement_id: int, expert_user_id: int, content: str | None) -> dict:
    row = await pool.fetchrow(
        """
        INSERT INTO engagement_notes (engagement_id, expert_user_id, content)
        VALUES ($1, $2, $3)
        ON CONFLICT (engagement_id, expert_user_id) DO UPDATE
            SET content = EXCLUDED.content, updated_at = NOW()
        RETURNING *
        """,
        engagement_id, expert_user_id, content,
    )
    return dict(row)
