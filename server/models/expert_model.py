"""
expert_model — data access for expert_profiles and its five sub-resource tables.
"""
from __future__ import annotations

import asyncio
import math

from server.db import connection_pool as pool
from .enums import (
    AVAILABILITY_STATUS,
    ENGAGEMENT_TYPE,
    PREFERRED_ENGAGEMENT_LENGTH,
    PROFICIENCY_LEVEL,
    SECTOR,
)
from .errors import ConflictError, NotFoundError
from .validators import check_enum, check_rate_range

_PROFILE_COLS = (
    "expert_profile_id, user_id, first_name, last_name, headline, bio, "
    "years_of_experience, linkedin_url, hourly_rate_min, hourly_rate_max, "
    "availability_status, preferred_engagement_length, "
    "is_verified, verification_status, avg_rating, total_completed_engagements, "
    "created_at, updated_at"
)

_SORT_COLS = {"created_at", "avg_rating", "hourly_rate_min", "years_of_experience"}

_PROFICIENCY_RANK = {
    "familiar": 1, "proficient": 2, "expert": 3, "leading_researcher": 4,
}


async def _sub_resources(expert_id: int) -> dict:
    """Fetch all five sub-resource tables for a profile concurrently."""
    credentials, work_history, specializations, sector_exp, eng_types = await asyncio.gather(
        pool.fetch(
            """
            SELECT ec.credential_id, ec.credential_type, ec.credential_name,
                   ec.institution, ec.year_obtained, ec.expiry_date,
                   ec.verification_url,
                   EXISTS(
                       SELECT 1 FROM verification_records vr
                       WHERE vr.related_credential_id = ec.credential_id
                         AND vr.status = 'approved'
                   ) AS is_verified
            FROM expert_credentials ec
            WHERE ec.expert_id = $1
            ORDER BY ec.created_at
            """,
            expert_id,
        ),
        pool.fetch(
            """
            SELECT work_history_id, organization_name, job_title, employment_type,
                   start_date, end_date, is_current, description, order_index
            FROM expert_work_history
            WHERE expert_id = $1
            ORDER BY COALESCE(order_index, 2147483647), start_date DESC
            """,
            expert_id,
        ),
        pool.fetch(
            """
            SELECT specialization_id, specialization, proficiency_level,
                   years_in_specialization
            FROM expert_specializations
            WHERE expert_id = $1
            ORDER BY created_at
            """,
            expert_id,
        ),
        pool.fetch(
            """
            SELECT sector_exp_id, sector, years_experience_in_sector,
                   compliance_standards_known, anonymized_client_examples
            FROM expert_sector_experience
            WHERE expert_id = $1
            ORDER BY created_at
            """,
            expert_id,
        ),
        pool.fetch(
            """
            SELECT eng_type_id, engagement_type, typical_duration_weeks_min,
                   typical_duration_weeks_max, typical_budget_min, typical_budget_max,
                   approach_description
            FROM expert_engagement_types
            WHERE expert_id = $1
            ORDER BY created_at
            """,
            expert_id,
        ),
    )
    return {
        "credentials": [dict(r) for r in credentials],
        "work_history": [dict(r) for r in work_history],
        "specializations": [dict(r) for r in specializations],
        "sector_experience": [dict(r) for r in sector_exp],
        "engagement_types": [dict(r) for r in eng_types],
    }


async def _full_profile(row) -> dict:
    result = dict(row)
    result.update(await _sub_resources(result["expert_profile_id"]))
    return result


def _validate_profile_fields(data: dict) -> None:
    if "availability_status" in data:
        check_enum(data["availability_status"], AVAILABILITY_STATUS, "availability_status")
    if data.get("preferred_engagement_length") is not None:
        check_enum(
            data["preferred_engagement_length"],
            PREFERRED_ENGAGEMENT_LENGTH,
            "preferred_engagement_length",
        )
    check_rate_range(data.get("hourly_rate_min"), data.get("hourly_rate_max"))


# ── Core CRUD ─────────────────────────────────────────────────────────────────

async def create(user_id: int, data: dict) -> dict:
    _validate_profile_fields(data)
    try:
        row = await pool.fetchrow(
            f"""
            INSERT INTO expert_profiles (
                user_id, first_name, last_name, headline, bio,
                years_of_experience, linkedin_url, hourly_rate_min, hourly_rate_max,
                availability_status, preferred_engagement_length
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING {_PROFILE_COLS}
            """,
            user_id,
            data["first_name"],
            data["last_name"],
            data.get("headline"),
            data.get("bio"),
            data.get("years_of_experience"),
            data.get("linkedin_url"),
            data.get("hourly_rate_min"),
            data.get("hourly_rate_max"),
            data.get("availability_status", "available"),
            data.get("preferred_engagement_length"),
        )
    except Exception as e:
        if getattr(e, "sqlstate", None) == "23505":
            raise ConflictError("a profile already exists for this user") from e
        raise
    return await _full_profile(row)


async def get(expert_id: int) -> dict:
    row = await pool.fetchrow(
        f"SELECT {_PROFILE_COLS} FROM expert_profiles WHERE expert_profile_id = $1",
        expert_id,
    )
    if row is None:
        raise NotFoundError("expert profile not found")
    return await _full_profile(row)


async def find_by_user(user_id: int):
    row = await pool.fetchrow(
        f"SELECT {_PROFILE_COLS} FROM expert_profiles WHERE user_id = $1",
        user_id,
    )
    if row is None:
        return None
    return await _full_profile(row)


async def update(expert_id: int, patch: dict) -> dict:
    if not patch:
        return await get(expert_id)
    _validate_profile_fields(patch)
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 2}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"""
        UPDATE expert_profiles
        SET {set_clause}, updated_at = NOW()
        WHERE expert_profile_id = $1
        RETURNING {_PROFILE_COLS}
        """,
        expert_id,
        *vals,
    )
    if row is None:
        raise NotFoundError("expert profile not found")
    return await _full_profile(row)


async def list(
    *,
    filters: dict = None,
    page: int = 1,
    limit: int = 20,
    sort: str = "created_at",
    order: str = "desc",
) -> dict:
    filters = filters or {}
    sort = sort if sort in _SORT_COLS else "created_at"
    order_sql = "ASC" if order.lower() == "asc" else "DESC"

    params: list = []
    where_parts: list = [
        "ep.is_verified = true",
        "EXISTS (SELECT 1 FROM users u WHERE u.user_id = ep.user_id AND u.is_active = true)",
    ]

    def p(val) -> str:
        params.append(val)
        return f"${len(params)}"

    if "q" in filters:
        val = f"%{filters['q']}%"
        where_parts.append(
            f"(ep.first_name || ' ' || ep.last_name ILIKE {p(val)} "
            f"OR ep.headline ILIKE {p(val)} OR ep.bio ILIKE {p(val)})"
        )

    if "specialization" in filters:
        where_parts.append(
            f"EXISTS (SELECT 1 FROM expert_specializations es "
            f"WHERE es.expert_id = ep.expert_profile_id AND es.specialization = {p(filters['specialization'])})"
        )

    if "proficiency_min" in filters:
        rank = _PROFICIENCY_RANK.get(filters["proficiency_min"], 1)
        proficiency_case = (
            "CASE proficiency_level "
            "WHEN 'familiar' THEN 1 "
            "WHEN 'proficient' THEN 2 "
            "WHEN 'expert' THEN 3 "
            "WHEN 'leading_researcher' THEN 4 "
            "ELSE 0 END"
        )
        where_parts.append(
            f"EXISTS (SELECT 1 FROM expert_specializations es "
            f"WHERE es.expert_id = ep.expert_profile_id AND {proficiency_case} >= {p(rank)})"
        )

    if "sector" in filters:
        where_parts.append(
            f"EXISTS (SELECT 1 FROM expert_sector_experience ese "
            f"WHERE ese.expert_id = ep.expert_profile_id AND ese.sector = {p(filters['sector'])})"
        )

    if "compliance" in filters:
        where_parts.append(
            f"EXISTS (SELECT 1 FROM expert_sector_experience ese "
            f"WHERE ese.expert_id = ep.expert_profile_id "
            f"AND {p(filters['compliance'])} = ANY(ese.compliance_standards_known))"
        )

    if "engagement_type" in filters:
        where_parts.append(
            f"EXISTS (SELECT 1 FROM expert_engagement_types eet "
            f"WHERE eet.expert_id = ep.expert_profile_id AND eet.engagement_type = {p(filters['engagement_type'])})"
        )

    if "availability" in filters:
        where_parts.append(f"ep.availability_status = {p(filters['availability'])}")

    if "rate_max" in filters:
        where_parts.append(
            f"(ep.hourly_rate_min IS NULL OR ep.hourly_rate_min <= {p(float(filters['rate_max']))})"
        )

    if "rating_min" in filters:
        where_parts.append(f"ep.avg_rating >= {p(float(filters['rating_min']))}")

    if "years_experience_min" in filters:
        where_parts.append(
            f"ep.years_of_experience >= {p(int(filters['years_experience_min']))}"
        )

    where_sql = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""

    total = await pool.fetchval(
        f"SELECT COUNT(*) FROM expert_profiles ep {where_sql}",
        *params,
    )

    n = len(params)
    params_page = params + [limit, (page - 1) * limit]
    rows = await pool.fetch(
        f"""
        SELECT ep.expert_profile_id, ep.first_name, ep.last_name, ep.headline,
               ep.availability_status, ep.hourly_rate_min, ep.hourly_rate_max,
               ep.is_verified, ep.avg_rating, ep.total_completed_engagements,
               ep.years_of_experience
        FROM expert_profiles ep
        {where_sql}
        ORDER BY ep.{sort} {order_sql} NULLS LAST
        LIMIT ${n + 1} OFFSET ${n + 2}
        """,
        *params_page,
    )

    # Batch-load specializations for all returned experts in one query
    expert_ids = [r["expert_profile_id"] for r in rows]
    specs_by_expert: dict = {}
    if expert_ids:
        spec_rows = await pool.fetch(
            """
            SELECT expert_id, specialization_id, specialization,
                   proficiency_level, years_in_specialization
            FROM expert_specializations
            WHERE expert_id = ANY($1::int[])
            ORDER BY expert_id, created_at
            """,
            expert_ids,
        )
        for s in spec_rows:
            specs_by_expert.setdefault(s["expert_id"], []).append({
                "specialization_id": s["specialization_id"],
                "specialization": s["specialization"],
                "proficiency_level": s["proficiency_level"],
                "years_in_specialization": s["years_in_specialization"],
            })

    data = []
    for r in rows:
        row_dict = dict(r)
        row_dict["specializations"] = specs_by_expert.get(row_dict["expert_profile_id"], [])
        data.append(row_dict)

    total_pages = max(1, math.ceil(total / limit))
    return {
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": total_pages,
        },
    }


# ── Sub-resource helpers ──────────────────────────────────────────────────────

async def _assert_expert_exists(expert_id: int) -> None:
    exists = await pool.fetchval(
        "SELECT 1 FROM expert_profiles WHERE expert_profile_id = $1", expert_id
    )
    if not exists:
        raise NotFoundError("expert profile not found")


# Credentials ─────────────────────────────────────────────────────────────────

async def add_credential(expert_id: int, data: dict):
    await _assert_expert_exists(expert_id)
    return await pool.fetchrow(
        """
        INSERT INTO expert_credentials (
            expert_id, credential_type, credential_name, institution,
            year_obtained, expiry_date, verification_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING credential_id, credential_type, credential_name, institution,
                  year_obtained, expiry_date, verification_url,
                  false AS is_verified
        """,
        expert_id,
        data["credential_type"],
        data["credential_name"],
        data.get("institution"),
        data.get("year_obtained"),
        data.get("expiry_date"),
        data.get("verification_url"),
    )


async def list_credentials(expert_id: int):
    return await pool.fetch(
        """
        SELECT ec.credential_id, ec.credential_type, ec.credential_name,
               ec.institution, ec.year_obtained, ec.expiry_date,
               ec.verification_url,
               EXISTS(
                   SELECT 1 FROM verification_records vr
                   WHERE vr.related_credential_id = ec.credential_id
                     AND vr.status = 'approved'
               ) AS is_verified
        FROM expert_credentials ec
        WHERE ec.expert_id = $1
        ORDER BY ec.created_at
        """,
        expert_id,
    )


async def get_credential(credential_id: int):
    row = await pool.fetchrow(
        """
        SELECT credential_id, expert_id, credential_type, credential_name,
               institution, year_obtained, expiry_date, verification_url
        FROM expert_credentials
        WHERE credential_id = $1
        """,
        credential_id,
    )
    if row is None:
        raise NotFoundError("credential not found")
    return dict(row)


async def update_credential(expert_id: int, credential_id: int, patch: dict):
    if not patch:
        row = await pool.fetchrow(
            "SELECT * FROM expert_credentials WHERE credential_id = $1 AND expert_id = $2",
            credential_id, expert_id,
        )
        if row is None:
            raise NotFoundError("credential not found")
        return row
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 3}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"UPDATE expert_credentials SET {set_clause} "
        f"WHERE credential_id = $1 AND expert_id = $2 RETURNING *",
        credential_id, expert_id, *vals,
    )
    if row is None:
        raise NotFoundError("credential not found")
    return row


async def delete_credential(expert_id: int, credential_id: int) -> None:
    result = await pool.query(
        "DELETE FROM expert_credentials WHERE credential_id = $1 AND expert_id = $2",
        credential_id, expert_id,
    )
    if result == "DELETE 0":
        raise NotFoundError("credential not found")


# Work history ────────────────────────────────────────────────────────────────

async def add_work_history(expert_id: int, data: dict):
    await _assert_expert_exists(expert_id)
    return await pool.fetchrow(
        """
        INSERT INTO expert_work_history (
            expert_id, organization_name, job_title, employment_type,
            start_date, end_date, is_current, description, order_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING work_history_id, organization_name, job_title, employment_type,
                  start_date, end_date, is_current, description, order_index
        """,
        expert_id,
        data["organization_name"],
        data["job_title"],
        data.get("employment_type"),
        data["start_date"],
        data.get("end_date"),
        data.get("is_current", False),
        data.get("description"),
        data.get("order_index"),
    )


async def list_work_history(expert_id: int):
    return await pool.fetch(
        """
        SELECT work_history_id, organization_name, job_title, employment_type,
               start_date, end_date, is_current, description, order_index
        FROM expert_work_history
        WHERE expert_id = $1
        ORDER BY COALESCE(order_index, 2147483647), start_date DESC
        """,
        expert_id,
    )


async def update_work_history(expert_id: int, work_history_id: int, patch: dict):
    if not patch:
        row = await pool.fetchrow(
            "SELECT * FROM expert_work_history WHERE work_history_id = $1 AND expert_id = $2",
            work_history_id, expert_id,
        )
        if row is None:
            raise NotFoundError("work history entry not found")
        return row
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 3}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"UPDATE expert_work_history SET {set_clause} "
        f"WHERE work_history_id = $1 AND expert_id = $2 RETURNING *",
        work_history_id, expert_id, *vals,
    )
    if row is None:
        raise NotFoundError("work history entry not found")
    return row


async def delete_work_history(expert_id: int, work_history_id: int) -> None:
    result = await pool.query(
        "DELETE FROM expert_work_history WHERE work_history_id = $1 AND expert_id = $2",
        work_history_id, expert_id,
    )
    if result == "DELETE 0":
        raise NotFoundError("work history entry not found")


# Specializations ─────────────────────────────────────────────────────────────

async def add_specialization(expert_id: int, data: dict):
    await _assert_expert_exists(expert_id)
    check_enum(data["proficiency_level"], PROFICIENCY_LEVEL, "proficiency_level")
    return await pool.fetchrow(
        """
        INSERT INTO expert_specializations (
            expert_id, specialization, proficiency_level, years_in_specialization
        ) VALUES ($1, $2, $3, $4)
        RETURNING specialization_id, specialization, proficiency_level, years_in_specialization
        """,
        expert_id,
        data["specialization"],
        data["proficiency_level"],
        data.get("years_in_specialization"),
    )


async def list_specializations(expert_id: int):
    return await pool.fetch(
        """
        SELECT specialization_id, specialization, proficiency_level, years_in_specialization
        FROM expert_specializations
        WHERE expert_id = $1
        ORDER BY created_at
        """,
        expert_id,
    )


async def update_specialization(expert_id: int, specialization_id: int, patch: dict):
    if "proficiency_level" in patch:
        check_enum(patch["proficiency_level"], PROFICIENCY_LEVEL, "proficiency_level")
    if not patch:
        row = await pool.fetchrow(
            "SELECT * FROM expert_specializations WHERE specialization_id = $1 AND expert_id = $2",
            specialization_id, expert_id,
        )
        if row is None:
            raise NotFoundError("specialization not found")
        return row
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 3}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"UPDATE expert_specializations SET {set_clause} "
        f"WHERE specialization_id = $1 AND expert_id = $2 RETURNING *",
        specialization_id, expert_id, *vals,
    )
    if row is None:
        raise NotFoundError("specialization not found")
    return row


async def delete_specialization(expert_id: int, specialization_id: int) -> None:
    result = await pool.query(
        "DELETE FROM expert_specializations WHERE specialization_id = $1 AND expert_id = $2",
        specialization_id, expert_id,
    )
    if result == "DELETE 0":
        raise NotFoundError("specialization not found")


# Sector experience ───────────────────────────────────────────────────────────

async def add_sector_experience(expert_id: int, data: dict):
    await _assert_expert_exists(expert_id)
    check_enum(data["sector"], SECTOR, "sector")
    return await pool.fetchrow(
        """
        INSERT INTO expert_sector_experience (
            expert_id, sector, years_experience_in_sector,
            compliance_standards_known, anonymized_client_examples
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING sector_exp_id, sector, years_experience_in_sector,
                  compliance_standards_known, anonymized_client_examples
        """,
        expert_id,
        data["sector"],
        data.get("years_experience_in_sector"),
        data.get("compliance_standards_known") or [],
        data.get("anonymized_client_examples"),
    )


async def list_sector_experience(expert_id: int):
    return await pool.fetch(
        """
        SELECT sector_exp_id, sector, years_experience_in_sector,
               compliance_standards_known, anonymized_client_examples
        FROM expert_sector_experience
        WHERE expert_id = $1
        ORDER BY created_at
        """,
        expert_id,
    )


async def update_sector_experience(expert_id: int, sector_exp_id: int, patch: dict):
    if "sector" in patch:
        check_enum(patch["sector"], SECTOR, "sector")
    if not patch:
        row = await pool.fetchrow(
            "SELECT * FROM expert_sector_experience WHERE sector_exp_id = $1 AND expert_id = $2",
            sector_exp_id, expert_id,
        )
        if row is None:
            raise NotFoundError("sector experience entry not found")
        return row
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 3}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"UPDATE expert_sector_experience SET {set_clause} "
        f"WHERE sector_exp_id = $1 AND expert_id = $2 RETURNING *",
        sector_exp_id, expert_id, *vals,
    )
    if row is None:
        raise NotFoundError("sector experience entry not found")
    return row


async def delete_sector_experience(expert_id: int, sector_exp_id: int) -> None:
    result = await pool.query(
        "DELETE FROM expert_sector_experience WHERE sector_exp_id = $1 AND expert_id = $2",
        sector_exp_id, expert_id,
    )
    if result == "DELETE 0":
        raise NotFoundError("sector experience entry not found")


# Engagement types ────────────────────────────────────────────────────────────

async def add_engagement_type(expert_id: int, data: dict):
    await _assert_expert_exists(expert_id)
    check_enum(data["engagement_type"], ENGAGEMENT_TYPE, "engagement_type")
    return await pool.fetchrow(
        """
        INSERT INTO expert_engagement_types (
            expert_id, engagement_type, typical_duration_weeks_min,
            typical_duration_weeks_max, typical_budget_min, typical_budget_max,
            approach_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING eng_type_id, engagement_type, typical_duration_weeks_min,
                  typical_duration_weeks_max, typical_budget_min, typical_budget_max,
                  approach_description
        """,
        expert_id,
        data["engagement_type"],
        data.get("typical_duration_weeks_min"),
        data.get("typical_duration_weeks_max"),
        data.get("typical_budget_min"),
        data.get("typical_budget_max"),
        data.get("approach_description"),
    )


async def list_engagement_types(expert_id: int):
    return await pool.fetch(
        """
        SELECT eng_type_id, engagement_type, typical_duration_weeks_min,
               typical_duration_weeks_max, typical_budget_min, typical_budget_max,
               approach_description
        FROM expert_engagement_types
        WHERE expert_id = $1
        ORDER BY created_at
        """,
        expert_id,
    )


async def update_engagement_type(expert_id: int, eng_type_id: int, patch: dict):
    if "engagement_type" in patch:
        check_enum(patch["engagement_type"], ENGAGEMENT_TYPE, "engagement_type")
    if not patch:
        row = await pool.fetchrow(
            "SELECT * FROM expert_engagement_types WHERE eng_type_id = $1 AND expert_id = $2",
            eng_type_id, expert_id,
        )
        if row is None:
            raise NotFoundError("engagement type not found")
        return row
    cols = list(patch.keys())
    vals = [patch[c] for c in cols]
    set_clause = ", ".join(f"{col} = ${i + 3}" for i, col in enumerate(cols))
    row = await pool.fetchrow(
        f"UPDATE expert_engagement_types SET {set_clause} "
        f"WHERE eng_type_id = $1 AND expert_id = $2 RETURNING *",
        eng_type_id, expert_id, *vals,
    )
    if row is None:
        raise NotFoundError("engagement type not found")
    return row


async def delete_engagement_type(expert_id: int, eng_type_id: int) -> None:
    result = await pool.query(
        "DELETE FROM expert_engagement_types WHERE eng_type_id = $1 AND expert_id = $2",
        eng_type_id, expert_id,
    )
    if result == "DELETE 0":
        raise NotFoundError("engagement type not found")


# ── Matching (AI recommendations) ────────────────────────────────────────────

async def list_matching_candidates(limit: int = 50):
    """
    Candidate pool for the AI matcher: verified experts who aren't
    'unavailable', with their sub-resources aggregated into arrays so one
    query returns everything the ranking prompt needs. Best-rated first.
    """
    return await pool.fetch(
        """
        SELECT
            e.expert_profile_id, e.first_name, e.last_name, e.headline,
            e.years_of_experience, e.hourly_rate_min, e.hourly_rate_max,
            e.availability_status, e.preferred_engagement_length,
            e.is_verified, e.avg_rating, e.total_completed_engagements,
            COALESCE((
                SELECT array_agg(s.specialization)
                FROM expert_specializations s
                WHERE s.expert_id = e.expert_profile_id
            ), '{}') AS specializations,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'sector', se.sector,
                    'years_experience_in_sector', se.years_experience_in_sector,
                    'compliance_standards_known', se.compliance_standards_known
                ))
                FROM expert_sector_experience se
                WHERE se.expert_id = e.expert_profile_id
            ), '[]') AS sector_experience,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'engagement_type', et.engagement_type,
                    'typical_budget_min', et.typical_budget_min,
                    'typical_budget_max', et.typical_budget_max,
                    'typical_duration_weeks_min', et.typical_duration_weeks_min,
                    'typical_duration_weeks_max', et.typical_duration_weeks_max
                ))
                FROM expert_engagement_types et
                WHERE et.expert_id = e.expert_profile_id
            ), '[]') AS engagement_types
        FROM expert_profiles e
        WHERE e.is_verified = true
          AND e.availability_status != 'unavailable'
        ORDER BY e.avg_rating DESC NULLS LAST, e.expert_profile_id
        LIMIT $1
        """,
        limit,
    )
