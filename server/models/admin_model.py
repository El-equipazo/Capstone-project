from __future__ import annotations

from server.db import connection_pool as pool
from .errors import NotFoundError

_USER_COLS = (
    "user_id, email, role, is_email_verified, is_active, last_login_at, created_at, updated_at"
)

_VR_COLS = (
    "verification_id, user_id, verification_type, related_credential_id, "
    "status, reviewed_by_admin_id, submitted_document_urls, admin_notes, "
    "rejection_reason, reviewed_at, expires_at, "
    "ai_recommendation, ai_confidence, ai_reasoning, ai_red_flags, ai_reviewed_at, "
    "created_at"
)

_VR_COLS_JOINED = (
    "vr.verification_id, vr.user_id, vr.verification_type, vr.related_credential_id, "
    "vr.status, vr.reviewed_by_admin_id, vr.submitted_document_urls, vr.admin_notes, "
    "vr.rejection_reason, vr.reviewed_at, vr.expires_at, "
    "vr.ai_recommendation, vr.ai_confidence, vr.ai_reasoning, vr.ai_red_flags, vr.ai_reviewed_at, "
    "vr.created_at"
)


async def list_users(role=None, is_active=None) -> list:
    conditions = []
    args = []
    if role is not None:
        args.append(role)
        conditions.append(f"role = ${len(args)}")
    if is_active is not None:
        args.append(is_active)
        conditions.append(f"is_active = ${len(args)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await pool.fetch(
        f"SELECT {_USER_COLS} FROM users {where} ORDER BY created_at DESC",
        *args,
    )
    return [dict(r) for r in rows]


async def set_user_active(user_id: int, is_active: bool) -> dict:
    row = await pool.fetchrow(
        f"""
        UPDATE users
        SET is_active = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING {_USER_COLS}
        """,
        is_active,
        user_id,
    )
    if row is None:
        raise NotFoundError("user not found")
    return dict(row)


async def list_verifications(status=None, verification_type=None) -> list:
    conditions = []
    args = []
    if status is not None:
        args.append(status)
        conditions.append(f"vr.status = ${len(args)}")
    if verification_type is not None:
        args.append(verification_type)
        conditions.append(f"vr.verification_type = ${len(args)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await pool.fetch(
        f"""
        SELECT {_VR_COLS_JOINED},
               u.email AS user_email,
               u.role  AS user_role,
               ec.credential_type, ec.credential_name, ec.institution,
               ec.year_obtained, ec.expiry_date, ec.verification_url AS credential_verification_url
        FROM verification_records vr
        JOIN users u ON u.user_id = vr.user_id
        LEFT JOIN expert_credentials ec ON ec.credential_id = vr.related_credential_id
        {where}
        ORDER BY vr.created_at DESC
        """,
        *args,
    )
    return [dict(r) for r in rows]


async def get_verification(verification_id: int) -> dict:
    row = await pool.fetchrow(
        f"""
        SELECT {_VR_COLS_JOINED},
               u.email AS user_email,
               u.role  AS user_role,
               ec.credential_type, ec.credential_name, ec.institution,
               ec.year_obtained, ec.expiry_date, ec.verification_url AS credential_verification_url
        FROM verification_records vr
        JOIN users u ON u.user_id = vr.user_id
        LEFT JOIN expert_credentials ec ON ec.credential_id = vr.related_credential_id
        WHERE vr.verification_id = $1
        """,
        verification_id,
    )
    if row is None:
        raise NotFoundError("verification record not found")
    return dict(row)


async def save_ai_review(verification_id: int, *, recommendation: str,
                         confidence: str, reasoning: str, red_flags: list) -> dict:
    row = await pool.fetchrow(
        f"""
        UPDATE verification_records
        SET ai_recommendation = $1,
            ai_confidence     = $2,
            ai_reasoning      = $3,
            ai_red_flags      = $4,
            ai_reviewed_at    = NOW()
        WHERE verification_id = $5
        RETURNING {_VR_COLS}
        """,
        recommendation, confidence, reasoning, red_flags, verification_id,
    )
    if row is None:
        raise NotFoundError("verification record not found")
    return dict(row)


async def decide_verification(
    verification_id: int,
    admin_user_id: int,
    status: str,
    admin_notes=None,
    rejection_reason=None,
    expires_at=None,
) -> dict:
    row = await pool.fetchrow(
        f"""
        UPDATE verification_records
        SET status               = $1,
            reviewed_by_admin_id = $2,
            admin_notes          = COALESCE($3, admin_notes),
            rejection_reason     = COALESCE($4, rejection_reason),
            expires_at           = COALESCE($5, expires_at),
            reviewed_at          = NOW()
        WHERE verification_id = $6
        RETURNING {_VR_COLS}
        """,
        status,
        admin_user_id,
        admin_notes,
        rejection_reason,
        expires_at,
        verification_id,
    )
    if row is None:
        raise NotFoundError("verification record not found")
    result = dict(row)

    if status == "approved" and result["verification_type"] != "professional_credential":
        user_row = await pool.fetchrow(
            "SELECT role FROM users WHERE user_id = $1",
            result["user_id"],
        )
        if user_row:
            if user_row["role"] == "expert":
                await pool.query(
                    """
                    UPDATE expert_profiles
                    SET is_verified = true, verification_status = 'verified', updated_at = NOW()
                    WHERE user_id = $1
                    """,
                    result["user_id"],
                )
            elif user_row["role"] == "organization":
                await pool.query(
                    """
                    UPDATE organization_profiles
                    SET is_verified = true, updated_at = NOW()
                    WHERE user_id = $1
                    """,
                    result["user_id"],
                )

    return result


async def list_expert_profiles(is_verified=None) -> list:
    conditions = []
    args = []
    if is_verified is not None:
        args.append(is_verified)
        conditions.append(f"ep.is_verified = ${len(args)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await pool.fetch(
        f"""
        SELECT ep.expert_profile_id, ep.user_id, ep.first_name, ep.last_name,
               ep.headline, ep.availability_status, ep.is_verified,
               ep.verification_status, ep.avg_rating, ep.total_completed_engagements,
               ep.created_at, u.email, u.is_active
        FROM expert_profiles ep
        JOIN users u ON u.user_id = ep.user_id
        {where}
        ORDER BY ep.is_verified ASC, ep.created_at DESC
        """,
        *args,
    )
    return [dict(r) for r in rows]


async def list_organization_profiles(is_verified=None) -> list:
    conditions = []
    args = []
    if is_verified is not None:
        args.append(is_verified)
        conditions.append(f"op.is_verified = ${len(args)}")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = await pool.fetch(
        f"""
        SELECT op.org_profile_id, op.user_id, op.org_name, op.sector,
               op.sub_sector, op.employee_count_range, op.country,
               op.is_verified, op.created_at, u.email, u.is_active
        FROM organization_profiles op
        JOIN users u ON u.user_id = op.user_id
        {where}
        ORDER BY op.is_verified ASC, op.created_at DESC
        """,
        *args,
    )
    return [dict(r) for r in rows]


async def set_expert_verified(expert_profile_id: int, is_verified: bool) -> dict:
    verification_status = "verified" if is_verified else "unsubmitted"
    row = await pool.fetchrow(
        """
        UPDATE expert_profiles
        SET is_verified = $1, verification_status = $2, updated_at = NOW()
        WHERE expert_profile_id = $3
        RETURNING expert_profile_id, user_id, first_name, last_name, is_verified, verification_status
        """,
        is_verified,
        verification_status,
        expert_profile_id,
    )
    if row is None:
        raise NotFoundError("expert profile not found")
    return dict(row)


async def verify_organization(org_profile_id: int) -> dict:
    row = await pool.fetchrow(
        """
        UPDATE organization_profiles
        SET is_verified = true, updated_at = NOW()
        WHERE org_profile_id = $1
        RETURNING org_profile_id, user_id, org_name, is_verified
        """,
        org_profile_id,
    )
    if row is None:
        raise NotFoundError("organization profile not found")
    return dict(row)
