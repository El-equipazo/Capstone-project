"""
expert_model — data access for expert_profiles and their sub-resources.

Currently implements the READ paths the matching feature needs (deterministic
scoring + AI recommendations). The remaining CRUD (create/update/list and the
five sub-resource add/update/delete families called by the experts controller)
is still to be written — until then, the module-level __getattr__ below keeps
those endpoints answering 503 NOT_IMPLEMENTED instead of crashing with an
AttributeError.
"""

from server.db import connection_pool as pool
from .errors import NotFoundError, NotImplementedModelError


async def find_by_user(user_id: int):
    """Return the expert profile row owned by a user, or None (1:1 with users)."""
    return await pool.fetchrow(
        "SELECT * FROM expert_profiles WHERE user_id = $1", user_id
    )


async def get(expert_profile_id: int):
    """Return the expert profile row, or raise NotFoundError (-> 404)."""
    row = await pool.fetchrow(
        "SELECT * FROM expert_profiles WHERE expert_profile_id = $1",
        expert_profile_id,
    )
    if row is None:
        raise NotFoundError("expert profile not found")
    return row


async def get_sector_experience(expert_profile_id: int):
    """All sector-experience rows for an expert (sector, years, compliance)."""
    return await pool.fetch(
        """
        SELECT sector_exp_id, sector, years_experience_in_sector,
               compliance_standards_known, anonymized_client_examples
        FROM expert_sector_experience
        WHERE expert_id = $1
        """,
        expert_profile_id,
    )


async def get_engagement_types(expert_profile_id: int):
    """All engagement-type offerings for an expert (type + duration/budget)."""
    return await pool.fetch(
        """
        SELECT eng_type_id, engagement_type,
               typical_duration_weeks_min, typical_duration_weeks_max,
               typical_budget_min, typical_budget_max, approach_description
        FROM expert_engagement_types
        WHERE expert_id = $1
        """,
        expert_profile_id,
    )


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
                    'years', se.years_experience_in_sector,
                    'compliance_standards', se.compliance_standards_known
                ))
                FROM expert_sector_experience se
                WHERE se.expert_id = e.expert_profile_id
            ), '[]') AS sector_experience,
            COALESCE((
                SELECT json_agg(json_build_object(
                    'engagement_type', et.engagement_type,
                    'budget_min', et.typical_budget_min,
                    'budget_max', et.typical_budget_max,
                    'duration_weeks_min', et.typical_duration_weeks_min,
                    'duration_weeks_max', et.typical_duration_weeks_max
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


def __getattr__(name):
    """Unwritten functions (create, update, list, sub-resource CRUD, ...) keep
    the old import-stub behavior: a clean 503 via NotImplementedModelError."""
    if name.startswith("__") and name.endswith("__"):
        raise AttributeError(name)  # dunders must fail normally (import machinery)

    async def _not_implemented(*args, **kwargs):
        raise NotImplementedModelError(
            f"expert_model.{name} not implemented yet"
        )
    return _not_implemented
