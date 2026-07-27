"""
message_model — data access for messages (+ resolving file attachments from
secure_document_shares). Engagement-scoped, per api-contract.md §8.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .enums import CLIENT_MESSAGE_TYPE
from .errors import ValidationError
from .validators import check_enum

_DOC_COLS = "document_name, document_type, file_size_bytes"


async def _resolve_document(document_id: int, engagement_id: int) -> dict:
    """
    A file message must reference a document already uploaded to THIS
    engagement (api-contract.md §8: "400 ... document_id referencing a
    document outside this engagement"). Raises ValidationError (400) if the
    document doesn't exist or belongs to a different engagement.
    """
    row = await pool.fetchrow(
        f"SELECT {_DOC_COLS} FROM secure_document_shares "
        f"WHERE document_id = $1 AND engagement_id = $2",
        document_id, engagement_id,
    )
    if row is None:
        raise ValidationError(
            "document_id does not reference a document on this engagement",
            field="document_id", issue="not_found",
        )
    return dict(row)


async def create(engagement_id: int, sender_id: int, message_type: str,
                 content: str = None, document_id: int = None) -> dict:
    check_enum(message_type, CLIENT_MESSAGE_TYPE, "message_type")
    if message_type == "file" and document_id is None:
        raise ValidationError(
            "document_id is required for a file message",
            field="document_id", issue="required",
        )

    document = None
    if document_id is not None:
        document = await _resolve_document(document_id, engagement_id)

    row = await pool.fetchrow(
        """
        INSERT INTO messages (engagement_id, sender_id, content, message_type, document_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        engagement_id, sender_id, content, message_type, document_id,
    )
    result = dict(row)
    result.update(document or {"document_name": None, "document_type": None, "file_size_bytes": None})
    return result


async def list_for_engagement(engagement_id: int, *, unread: bool = None,
                              page: int = 1, limit: int = 20) -> tuple[list, int]:
    """Newest-first, real pagination (mirrors connection_model.list_requests)."""
    where = ["m.engagement_id = $1"]
    params = [engagement_id]
    if unread:
        where.append("m.is_read = false")
    where_sql = " AND ".join(where)

    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM messages m WHERE {where_sql}", *params
    )
    rows = await pool.fetch(
        f"""
        SELECT m.message_id, m.engagement_id, m.sender_id, m.content, m.message_type,
               m.document_id, m.is_read, m.read_at, m.created_at,
               d.document_name, d.document_type, d.file_size_bytes
        FROM messages m
        LEFT JOIN secure_document_shares d ON d.document_id = m.document_id
        WHERE {where_sql}
        ORDER BY m.created_at DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *params, limit, (page - 1) * limit,
    )
    return [dict(r) for r in rows], total


async def mark_read(engagement_id: int, user_id: int, *,
                    message_ids: list = None, all: bool = False) -> int:
    """
    Marks messages read. Only affects messages NOT sent by the caller --
    marking your own message "read" is meaningless. Returns the count updated.
    """
    if all:
        result = await pool.query(
            """
            UPDATE messages SET is_read = true, read_at = NOW()
            WHERE engagement_id = $1 AND sender_id != $2 AND is_read = false
            """,
            engagement_id, user_id,
        )
    elif message_ids:
        result = await pool.query(
            """
            UPDATE messages SET is_read = true, read_at = NOW()
            WHERE engagement_id = $1 AND sender_id != $2
              AND message_id = ANY($3::int[]) AND is_read = false
            """,
            engagement_id, user_id, message_ids,
        )
    else:
        return 0
    # asyncpg's execute() status string looks like "UPDATE 3"
    return int(result.split()[-1])


# -- THREAD-SCOPED VARIANTS ---------------------------------------------------
# Same logic as the engagement-scoped functions above, but keyed on thread_id.
# No document attachments in thread messages (pre-connection, no shared docs).

async def create_for_thread(thread_id: int, sender_id: int, message_type: str,
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


async def mark_read_for_thread(thread_id: int, user_id: int, *,
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
