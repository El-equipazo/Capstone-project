"""
message_model — data access for messages, keyed on thread_id.

All messages belong to a chat_thread. Engagements share the thread for their
org/expert pair — there is no separate engagement-scoped message store.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .enums import CLIENT_MESSAGE_TYPE
from .validators import check_enum


async def create(thread_id: int, sender_id: int, message_type: str,
                 content: str = None) -> dict:
    check_enum(message_type, CLIENT_MESSAGE_TYPE, "message_type")
    row = await pool.fetchrow(
        """
        INSERT INTO messages (thread_id, sender_id, content, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        thread_id, sender_id, content, message_type,
    )
    return dict(row)


async def list_for_thread(thread_id: int, *, unread: bool = None,
                          page: int = 1, limit: int = 20) -> tuple[list, int]:
    where = ["m.thread_id = $1"]
    params: list = [thread_id]
    if unread:
        where.append("m.is_read = false")
    where_sql = " AND ".join(where)

    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM messages m WHERE {where_sql}", *params
    )
    rows = await pool.fetch(
        f"""
        SELECT m.message_id, m.thread_id, m.sender_id, m.content,
               m.message_type, m.is_read, m.read_at, m.created_at
        FROM messages m
        WHERE {where_sql}
        ORDER BY m.created_at DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *params, limit, (page - 1) * limit,
    )
    return [dict(r) for r in rows], total


async def mark_read(thread_id: int, user_id: int, *,
                    message_ids: list = None, all: bool = False) -> int:
    if all:
        result = await pool.query(
            """
            UPDATE messages SET is_read = true, read_at = NOW()
            WHERE thread_id = $1 AND sender_id != $2 AND is_read = false
            """,
            thread_id, user_id,
        )
    elif message_ids:
        result = await pool.query(
            """
            UPDATE messages SET is_read = true, read_at = NOW()
            WHERE thread_id = $1 AND sender_id != $2
              AND message_id = ANY($3::int[]) AND is_read = false
            """,
            thread_id, user_id, message_ids,
        )
    else:
        return 0
    return int(result.split()[-1])
