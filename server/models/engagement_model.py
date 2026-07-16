"""
engagement_model — data access for the engagements table.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .errors import NotFoundError


async def create(
    connection_id: int,
    org_id: int,
    expert_id: int,
    engagement_type: str,
    title: str = None,
) -> dict:
    row = await pool.fetchrow(
        """
        INSERT INTO engagements (
            connection_id, org_id, expert_id, engagement_type, title, status
        ) VALUES ($1, $2, $3, $4, $5, 'scoping')
        RETURNING *
        """,
        connection_id, org_id, expert_id, engagement_type, title,
    )
    return dict(row)


async def list_for_expert(expert_id: int) -> list:
    """Return engagements for an expert, with org_name joined in."""
    rows = await pool.fetch(
        """
        SELECT e.engagement_id, e.connection_id, e.org_id, e.expert_id,
               e.engagement_type, e.title, e.description, e.status,
               e.agreed_budget, e.payment_structure,
               e.start_date, e.estimated_end_date, e.actual_end_date,
               e.created_at, e.updated_at,
               op.org_name
        FROM engagements e
        JOIN organization_profiles op ON op.org_profile_id = e.org_id
        WHERE e.expert_id = $1
        ORDER BY e.created_at DESC
        """,
        expert_id,
    )
    return [dict(r) for r in rows]


async def list_for_org(org_id: int) -> list:
    rows = await pool.fetch(
        """
        SELECT e.engagement_id, e.connection_id, e.org_id, e.expert_id,
               e.engagement_type, e.title, e.description, e.status,
               e.agreed_budget, e.payment_structure,
               e.start_date, e.estimated_end_date, e.actual_end_date,
               e.created_at, e.updated_at
        FROM engagements e
        WHERE e.org_id = $1
        ORDER BY e.created_at DESC
        """,
        org_id,
    )
    return [dict(r) for r in rows]


async def get(engagement_id: int) -> dict:
    row = await pool.fetchrow(
        "SELECT * FROM engagements WHERE engagement_id = $1",
        engagement_id,
    )
    if row is None:
        raise NotFoundError("engagement not found")
    return dict(row)
