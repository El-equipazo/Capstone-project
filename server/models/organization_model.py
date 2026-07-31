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
    "default_connection_expiry_days, is_verified, avg_rating, created_at, updated_at"
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
