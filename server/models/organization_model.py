"""
organization_model — data access for organization_profiles and organization_infrastructure.
"""
from __future__ import annotations

from server.db import connection_pool as pool
from .errors import ConflictError, NotFoundError

_ORG_COLS = (
    "org_profile_id, user_id, org_name, contact_name, contact_title, sector, sub_sector, "
    "founded_year, employee_count_range, country, state_province, website, org_description, "
    "quantum_knowledge_level, budget_range, urgency_level, "
    "default_connection_expiry_days, is_verified, created_at, updated_at"
)

_INFRA_COLS = (
    "infra_id, org_id, data_categories, storage_type, primary_cloud_providers, "
    "current_encryption_standards, data_retention_years, oldest_system_age_years, "
    "compliance_requirements, has_dedicated_security_team, "
    "had_prior_quantum_assessment, known_risks_freetext, created_at, updated_at"
)


async def find_by_user(user_id: int):
    """Return the org profile for a user_id, or None."""
    row = await pool.fetchrow(
        f"SELECT {_ORG_COLS} FROM organization_profiles WHERE user_id = $1",
        user_id,
    )
    return dict(row) if row else None


async def get(org_profile_id: int) -> dict:
    row = await pool.fetchrow(
        f"SELECT {_ORG_COLS} FROM organization_profiles WHERE org_profile_id = $1",
        org_profile_id,
    )
    if row is None:
        raise NotFoundError("organization profile not found")
    return dict(row)


async def create(user_id: int, data: dict) -> dict:
    try:
        row = await pool.fetchrow(
            f"""
            INSERT INTO organization_profiles (
                user_id, org_name, contact_name, contact_title, sector, sub_sector, founded_year,
                employee_count_range, country, state_province, website,
                org_description, quantum_knowledge_level, budget_range,
                urgency_level, default_connection_expiry_days
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING {_ORG_COLS}
            """,
            user_id,
            data["org_name"],
            data.get("contact_name"),
            data.get("contact_title"),
            data.get("sector", "other"),
            data.get("sub_sector"),
            data.get("founded_year"),
            data.get("employee_count_range"),
            data.get("country"),
            data.get("state_province"),
            data.get("website"),
            data.get("org_description"),
            data.get("quantum_knowledge_level"),
            data.get("budget_range"),
            data.get("urgency_level"),
            data.get("default_connection_expiry_days", 30),
        )
    except Exception as e:
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("a profile already exists for this organization") from e
        raise
    return dict(row)


async def update(org_profile_id: int, patch: dict) -> dict:
    if not patch:
        return await get(org_profile_id)
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 2}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"""
        UPDATE organization_profiles
        SET {set_clause}, updated_at = NOW()
        WHERE org_profile_id = $1
        RETURNING {_ORG_COLS}
        """,
        org_profile_id,
        *vals,
    )
    if row is None:
        raise NotFoundError("organization profile not found")
    return dict(row)


async def upsert_infrastructure(org_id: int, data: dict) -> dict:
    cols = list(data.keys())
    vals = [data[c] for c in cols]
    if not cols:
        # Upsert with no fields: ensure the row exists
        row = await pool.fetchrow(
            f"""
            INSERT INTO organization_infrastructure (org_id)
            VALUES ($1)
            ON CONFLICT (org_id) DO UPDATE SET updated_at = NOW()
            RETURNING {_INFRA_COLS}
            """,
            org_id,
        )
        return dict(row)

    set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for col in cols)
    col_names = ", ".join(cols)
    placeholders = ", ".join(f"${i + 2}" for i in range(len(cols)))
    row = await pool.fetchrow(
        f"""
        INSERT INTO organization_infrastructure (org_id, {col_names})
        VALUES ($1, {placeholders})
        ON CONFLICT (org_id) DO UPDATE SET {set_clause}, updated_at = NOW()
        RETURNING {_INFRA_COLS}
        """,
        org_id,
        *vals,
    )
    return dict(row)


async def get_infrastructure(org_id: int) -> dict:
    row = await pool.fetchrow(
        f"SELECT {_INFRA_COLS} FROM organization_infrastructure WHERE org_id = $1",
        org_id,
    )
    if row is None:
        raise NotFoundError("infrastructure record not found")
    return dict(row)


async def find_infrastructure(org_id: int):
    """Same as get_infrastructure, but returns None instead of raising when
    the org hasn't filled in an infrastructure record yet. Used by the
    matching feature, which treats "no infrastructure on file" as a neutral
    signal rather than a hard error."""
    row = await pool.fetchrow(
        f"SELECT {_INFRA_COLS} FROM organization_infrastructure WHERE org_id = $1",
        org_id,
    )
    return dict(row) if row else None


async def hard_delete(user_id: int) -> None:
    """
    Permanently erases an organization account -- not the soft
    is_active=false deactivation used elsewhere.

    engagements.org_id, connection_requests, and chat_threads carry no (or
    an insufficient) ON DELETE CASCADE back to organization_profiles/users,
    so they're deleted explicitly here, in dependency order, before the
    user row itself is removed. Note: a two-hop CASCADE (users ->
    chat_threads -> messages) does NOT reliably clear messages.sender_id's
    direct NO ACTION reference to users before that constraint is checked
    -- confirmed by hitting messages_sender_id_fkey when this relied on the
    implicit cascade -- so chat_threads must be deleted explicitly too, not
    left for the users-row cascade to reach transitively.

      1. engagements (cascades to engagement_milestones, engagement_notes,
         secure_document_shares, reviews, and from there risk_assessments ->
         assessment_findings -> remediation_recommendations)
      2. connection_requests (cascades to match_scoring_factors) -- deleted
         explicitly rather than left to organization_profiles' cascade,
         since engagements.connection_id is ON DELETE RESTRICT against it
         and would otherwise block that cascade if step 1 hadn't already run
      3. chat_threads (cascades to messages) -- deleted explicitly for the
         two-hop-cascade reason above
      4. users -- cascades to organization_profiles, organization_infrastructure,
         notifications, and verification_records

    Every expert who had an engagement with this org is then notified that
    the org left and its data is gone -- captured before the delete, since
    engagements (and the org's name) won't exist to query afterward.

    All in one transaction: either the whole account disappears (with
    notifications sent) or none of it does.
    """
    async with pool.transaction() as conn:
        org = await conn.fetchrow(
            "SELECT org_profile_id, org_name FROM organization_profiles WHERE user_id = $1",
            user_id,
        )
        expert_user_ids: list[int] = []
        if org is not None:
            org_id = org["org_profile_id"]
            expert_rows = await conn.fetch(
                """
                SELECT DISTINCT ep.user_id
                FROM engagements e
                JOIN expert_profiles ep ON ep.expert_profile_id = e.expert_id
                WHERE e.org_id = $1
                """,
                org_id,
            )
            expert_user_ids = [r["user_id"] for r in expert_rows]
            await conn.execute("DELETE FROM engagements WHERE org_id = $1", org_id)
            await conn.execute("DELETE FROM connection_requests WHERE org_id = $1", org_id)
        await conn.execute("DELETE FROM chat_threads WHERE org_user_id = $1", user_id)
        await conn.execute("DELETE FROM users WHERE user_id = $1", user_id)

        if org is not None:
            org_name = org["org_name"]
            for expert_user_id in expert_user_ids:
                await conn.execute(
                    """
                    INSERT INTO notifications (user_id, type, title, body)
                    VALUES ($1, 'organization_deleted', $2, $3)
                    """,
                    expert_user_id,
                    f"{org_name} has left the platform",
                    "This organization deleted its account, and all engagement, "
                    "message, and milestone history with them has been permanently removed.",
                )
