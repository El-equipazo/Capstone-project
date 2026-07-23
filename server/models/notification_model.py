"""
notification_model — data access for notifications. Server-generated only
(api-contract.md §8: "no client POST endpoint") -- create() is called from
other controllers' side effects (a new message, a connection response),
never directly exposed to clients.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .enums import NOTIFICATION_TYPE
from .errors import NotFoundError
from .validators import check_enum


async def create(user_id: int, type: str, title: str, body: str = None, *,
                 related_entity_type: str = None, related_entity_id: int = None,
                 action_url: str = None) -> dict:
    check_enum(type, NOTIFICATION_TYPE, "type")
    row = await pool.fetchrow(
        """
        INSERT INTO notifications (
            user_id, type, title, body, related_entity_type, related_entity_id, action_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        """,
        user_id, type, title, body, related_entity_type, related_entity_id, action_url,
    )
    return dict(row)


async def list_for_user(user_id: int, *, is_read: bool = None,
                        page: int = 1, limit: int = 20) -> tuple[list, int]:
    where = ["user_id = $1"]
    params = [user_id]
    if is_read is not None:
        params.append(is_read)
        where.append(f"is_read = ${len(params)}")
    where_sql = " AND ".join(where)

    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM notifications WHERE {where_sql}", *params
    )
    rows = await pool.fetch(
        f"""
        SELECT * FROM notifications WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *params, limit, (page - 1) * limit,
    )
    return [dict(r) for r in rows], total


async def count_unread(user_id: int) -> int:
    return await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
        user_id,
    )


async def mark_read(notification_id: int, user_id: int) -> dict:
    row = await pool.fetchrow(
        """
        UPDATE notifications SET is_read = true, read_at = NOW()
        WHERE notification_id = $1 AND user_id = $2
        RETURNING *
        """,
        notification_id, user_id,
    )
    if row is None:
        raise NotFoundError("notification not found")
    return dict(row)


async def mark_all_read(user_id: int) -> int:
    result = await pool.query(
        "UPDATE notifications SET is_read = true, read_at = NOW() "
        "WHERE user_id = $1 AND is_read = false",
        user_id,
    )
    return int(result.split()[-1])
