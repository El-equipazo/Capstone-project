"""
thread_model — pre-connection chat threads between an org and an expert.

One thread per org-expert pair (UNIQUE constraint on the table). Threads are
created on first contact (POST /threads) and persist through the full
lifecycle: inquiry → connection request → engagement. The thread_id is the
stable room key used by the thread WebSocket manager.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .errors import NotFoundError


async def get_or_create(org_user_id: int, expert_user_id: int) -> dict:
    row = await pool.fetchrow(
        """
        INSERT INTO chat_threads (org_user_id, expert_user_id)
        VALUES ($1, $2)
        ON CONFLICT (org_user_id, expert_user_id) DO UPDATE
            SET org_user_id = EXCLUDED.org_user_id
        RETURNING *
        """,
        org_user_id, expert_user_id,
    )
    return dict(row)


async def get(thread_id: int) -> dict:
    row = await pool.fetchrow(
        "SELECT * FROM chat_threads WHERE thread_id = $1",
        thread_id,
    )
    if row is None:
        raise NotFoundError(f"Thread {thread_id} not found")
    return dict(row)


async def list_for_user(user_id: int) -> list[dict]:
    """
    Returns all threads the caller is a party to, enriched with the other
    party's display name, last message preview, and unread count.
    """
    rows = await pool.fetch(
        """
        SELECT
            ct.thread_id,
            ct.org_user_id,
            ct.expert_user_id,
            ct.created_at,
            op.org_name,
            op.org_profile_id,
            ep.first_name  AS expert_first_name,
            ep.last_name   AS expert_last_name,
            ep.expert_profile_id,
            COUNT(m.message_id) FILTER (
                WHERE m.is_read = false AND m.sender_id != $1
            ) AS unread_count,
            (
                SELECT m2.content
                FROM   messages m2
                WHERE  m2.thread_id = ct.thread_id
                ORDER  BY m2.created_at DESC
                LIMIT  1
            ) AS last_message_preview,
            (
                SELECT m2.created_at
                FROM   messages m2
                WHERE  m2.thread_id = ct.thread_id
                ORDER  BY m2.created_at DESC
                LIMIT  1
            ) AS last_message_at
        FROM chat_threads ct
        LEFT JOIN organization_profiles op ON op.user_id = ct.org_user_id
        LEFT JOIN expert_profiles        ep ON ep.user_id = ct.expert_user_id
        LEFT JOIN messages               m  ON m.thread_id = ct.thread_id
        WHERE ct.org_user_id = $1 OR ct.expert_user_id = $1
        GROUP BY
            ct.thread_id, op.org_name, op.org_profile_id,
            ep.first_name, ep.last_name, ep.expert_profile_id
        ORDER BY last_message_at DESC NULLS LAST
        """,
        user_id,
    )
    return [dict(r) for r in rows]
