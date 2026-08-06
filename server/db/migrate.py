"""
Schema migrations — idempotent, safe to run against any existing database.

Run with:  python -m server.db.migrate
Requires:  DATABASE_URL set in the environment (or .env file).

This is the single source of truth for schema: 001_base_schema creates every
table (and the one index/function/trigger) from nothing, so this file alone
can build a fresh database -- no separate schema-creation step lives in
server/db/seed.py anymore. seed.py now only resets and populates sample data;
it calls run() from within its own transaction to (re)build the schema first.

Each migration is a standalone SQL block guarded by IF NOT EXISTS / IF EXISTS
so re-running is always a no-op. Add new migrations at the bottom of the list.
"""

import asyncio
import logging

from server.db.connection_pool import get_pool, close_pool

logger = logging.getLogger(__name__)

MIGRATIONS: list[tuple[str, str]] = [
    # (name, sql)
    (
        "001_base_schema",
        """
        -- DOMAIN 1: IDENTITY & AUTH ------------------------------------------
        CREATE TABLE IF NOT EXISTS users (
            user_id            SERIAL PRIMARY KEY,
            email              TEXT UNIQUE NOT NULL,
            password_hash      TEXT NOT NULL,
            role               TEXT NOT NULL CHECK (role IN ('organization', 'expert', 'admin')),
            is_email_verified  BOOLEAN DEFAULT false,
            is_active          BOOLEAN DEFAULT true,
            last_login_at      TIMESTAMP,
            created_at         TIMESTAMP DEFAULT NOW(),
            updated_at         TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS organization_profiles (
            org_profile_id                 SERIAL PRIMARY KEY,
            user_id                        INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
            org_name                       TEXT NOT NULL,
            contact_name                   TEXT,
            contact_title                  TEXT,
            sector                         TEXT NOT NULL,
            sub_sector                     TEXT,
            founded_year                   INTEGER,
            employee_count_range           TEXT,
            country                        TEXT,
            state_province                 TEXT,
            website                        TEXT,
            org_description                TEXT,
            quantum_knowledge_level        TEXT,
            budget_range                   TEXT,
            urgency_level                  TEXT,
            default_connection_expiry_days INTEGER DEFAULT 30,
            is_verified                    BOOLEAN DEFAULT false,
            avg_rating                     NUMERIC(3,2),
            created_at                     TIMESTAMP DEFAULT NOW(),
            updated_at                     TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS expert_profiles (
            expert_profile_id             SERIAL PRIMARY KEY,
            user_id                       INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
            first_name                    TEXT NOT NULL,
            last_name                     TEXT NOT NULL,
            headline                      TEXT,
            bio                           TEXT,
            profile_photo_url             TEXT,
            years_of_experience           INTEGER,
            linkedin_url                  TEXT,
            personal_website              TEXT,
            hourly_rate_min               NUMERIC(10,2),
            hourly_rate_max               NUMERIC(10,2),
            availability_status           TEXT DEFAULT 'available',
            avg_response_time_hours       INTEGER,
            preferred_engagement_length   TEXT,
            is_verified                   BOOLEAN DEFAULT false,
            verification_status           TEXT DEFAULT 'unsubmitted',
            avg_rating                    NUMERIC(3,2),
            total_completed_engagements   INTEGER DEFAULT 0,
            created_at                    TIMESTAMP DEFAULT NOW(),
            updated_at                    TIMESTAMP DEFAULT NOW()
        );

        -- DOMAIN 2: PROFILES & DISCOVERY ----------------------------------------
        CREATE TABLE IF NOT EXISTS organization_infrastructure (
            infra_id                         SERIAL PRIMARY KEY,
            org_id                           INTEGER UNIQUE REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE,
            data_categories                  TEXT[],
            storage_type                     TEXT,
            primary_cloud_providers          TEXT[],
            current_encryption_standards     TEXT[],
            data_retention_years             INTEGER,
            oldest_system_age_years          INTEGER,
            compliance_requirements          TEXT[],
            has_dedicated_security_team      BOOLEAN,
            had_prior_quantum_assessment     BOOLEAN,
            known_risks_freetext             TEXT,
            created_at                       TIMESTAMP DEFAULT NOW(),
            updated_at                       TIMESTAMP DEFAULT NOW()
        );

        -- expert_credentials -- note: is_admin_verified removed in this schema.
        CREATE TABLE IF NOT EXISTS expert_credentials (
            credential_id      SERIAL PRIMARY KEY,
            expert_id          INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            credential_type    TEXT NOT NULL,
            credential_name    TEXT NOT NULL,
            institution        TEXT,
            year_obtained      INTEGER,
            expiry_date        DATE,
            verification_url   TEXT,
            created_at         TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS expert_work_history (
            work_history_id    SERIAL PRIMARY KEY,
            expert_id          INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            organization_name  TEXT NOT NULL,
            job_title          TEXT NOT NULL,
            employment_type    TEXT,
            start_date         DATE NOT NULL,
            end_date           DATE,
            is_current         BOOLEAN DEFAULT false,
            description        TEXT,
            order_index        INTEGER,
            created_at         TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS expert_specializations (
            specialization_id       SERIAL PRIMARY KEY,
            expert_id               INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            specialization          TEXT NOT NULL,
            proficiency_level       TEXT NOT NULL,
            years_in_specialization INTEGER,
            created_at              TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS expert_sector_experience (
            sector_exp_id                 SERIAL PRIMARY KEY,
            expert_id                     INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            sector                        TEXT NOT NULL,
            years_experience_in_sector    INTEGER,
            compliance_standards_known    TEXT[],
            anonymized_client_examples    TEXT,
            created_at                    TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS expert_engagement_types (
            eng_type_id                   SERIAL PRIMARY KEY,
            expert_id                     INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            engagement_type               TEXT NOT NULL,
            typical_duration_weeks_min    INTEGER,
            typical_duration_weeks_max    INTEGER,
            typical_budget_min            NUMERIC(10,2),
            typical_budget_max            NUMERIC(10,2),
            approach_description          TEXT,
            created_at                    TIMESTAMP DEFAULT NOW()
        );

        -- DOMAIN 4: MATCHING -----------------------------------------------------
        CREATE TABLE IF NOT EXISTS connection_requests (
            connection_id           SERIAL PRIMARY KEY,
            org_id                  INTEGER REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE,
            expert_id               INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
            initiated_by_user_id    INTEGER REFERENCES users(user_id),
            status                  TEXT NOT NULL DEFAULT 'pending',
            initial_message         TEXT,
            org_stated_need         TEXT,
            org_stated_timeline     TEXT,
            match_score             NUMERIC(5,2),
            ai_fit_score            INTEGER,
            ai_reasoning            TEXT,
            expires_at              TIMESTAMP,
            responded_at            TIMESTAMP,
            created_at              TIMESTAMP DEFAULT NOW()
        );

        -- UNIQUE partial index: only one open (pending) request per org/expert pair.
        CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_pending
            ON connection_requests (org_id, expert_id)
            WHERE status = 'pending';

        CREATE TABLE IF NOT EXISTS match_scoring_factors (
            factor_id               SERIAL PRIMARY KEY,
            connection_id           INTEGER REFERENCES connection_requests(connection_id) ON DELETE CASCADE,
            factor_name             TEXT NOT NULL,
            weight                  NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 1),
            raw_score               NUMERIC(5,2) NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
            weighted_contribution   NUMERIC(5,2),
            created_at              TIMESTAMP DEFAULT NOW()
        );

        -- Deferred constraint trigger: at COMMIT, SUM(weight) per connection_id
        -- must be approximately 1.00 (+/- 0.01 rounding tolerance).
        CREATE OR REPLACE FUNCTION check_match_factors_weight_sum()
        RETURNS TRIGGER AS $body$
        DECLARE
            bad_connection INTEGER;
        BEGIN
            SELECT connection_id INTO bad_connection
            FROM match_scoring_factors
            GROUP BY connection_id
            HAVING ABS(SUM(weight) - 1.00) > 0.01
            LIMIT 1;

            IF bad_connection IS NOT NULL THEN
                RAISE EXCEPTION
                    'match_scoring_factors weights for connection_id % do not sum to 1.00',
                    bad_connection;
            END IF;
            RETURN NULL;
        END;
        $body$ LANGUAGE plpgsql;

        -- CREATE CONSTRAINT TRIGGER has no IF NOT EXISTS form -- the table it's
        -- attached to is dropped and recreated by seed.py on every reset, so
        -- pg_trigger never has a stale entry to conflict with there; this guard
        -- only matters for re-running against an already-migrated database.
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_trigger WHERE tgname = 'trg_match_factors_weight_sum'
            ) THEN
                CREATE CONSTRAINT TRIGGER trg_match_factors_weight_sum
                    AFTER INSERT OR UPDATE OR DELETE ON match_scoring_factors
                    DEFERRABLE INITIALLY DEFERRED
                    FOR EACH ROW
                    EXECUTE FUNCTION check_match_factors_weight_sum();
            END IF;
        END $$;

        -- DOMAIN 5: ENGAGEMENTS ---------------------------------------------------
        CREATE TABLE IF NOT EXISTS engagements (
            engagement_id            SERIAL PRIMARY KEY,
            connection_id            INTEGER UNIQUE REFERENCES connection_requests(connection_id) ON DELETE RESTRICT,
            org_id                   INTEGER REFERENCES organization_profiles(org_profile_id),
            expert_id                INTEGER REFERENCES expert_profiles(expert_profile_id),
            engagement_type          TEXT NOT NULL,
            title                    TEXT,
            description              TEXT,
            status                   TEXT NOT NULL DEFAULT 'scoping',
            agreed_budget            NUMERIC(12,2),
            payment_structure        TEXT,
            start_date               DATE,
            estimated_end_date       DATE,
            actual_end_date          DATE,
            cancellation_reason      TEXT,
            proposal_feedback        TEXT,
            proposal_expires_at      TIMESTAMP,
            pending_start_date               DATE,
            pending_estimated_end_date       DATE,
            pending_agreed_budget            NUMERIC(12,2),
            pending_payment_structure        TEXT,
            pending_requested_by_user_id     INTEGER REFERENCES users(user_id),
            pending_requested_at             TIMESTAMP,
            created_at               TIMESTAMP DEFAULT NOW(),
            updated_at               TIMESTAMP DEFAULT NOW()
        );

        -- engagement_milestones -- proposal/confirmation workflow, no payment_amount column.
        CREATE TABLE IF NOT EXISTS engagement_milestones (
            milestone_id               SERIAL PRIMARY KEY,
            engagement_id              INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            proposed_by_user_id        INTEGER REFERENCES users(user_id),
            proposed_by_role           TEXT NOT NULL CHECK (proposed_by_role IN ('organization', 'expert')),
            title                      TEXT NOT NULL,
            description                TEXT,
            order_index                INTEGER NOT NULL,
            due_date                   DATE,
            deliverable_description    TEXT,
            status                     TEXT NOT NULL DEFAULT 'proposed',
            confirmed_by_expert_id     INTEGER REFERENCES expert_profiles(expert_profile_id),
            confirmed_at               TIMESTAMP,
            completed_at               TIMESTAMP,
            requires_client_approval   BOOLEAN DEFAULT false,
            client_approved_at         TIMESTAMP,
            pending_action                     TEXT CHECK (pending_action IN ('change', 'cancel')),
            pending_due_date                   DATE,
            pending_deliverable_description    TEXT,
            pending_requested_by_user_id       INTEGER REFERENCES users(user_id),
            pending_requested_at               TIMESTAMP,
            created_at                 TIMESTAMP DEFAULT NOW(),
            updated_at                 TIMESTAMP DEFAULT NOW()
        );

        -- engagement_notes -- private per-engagement scratchpad for the expert
        -- only; the organization side never reads these.
        CREATE TABLE IF NOT EXISTS engagement_notes (
            note_id        SERIAL PRIMARY KEY,
            engagement_id  INTEGER NOT NULL REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            expert_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            content        TEXT,
            created_at     TIMESTAMP DEFAULT NOW(),
            updated_at     TIMESTAMP DEFAULT NOW(),
            UNIQUE (engagement_id, expert_user_id)
        );

        -- DOMAIN 6: COMMUNICATION -------------------------------------------------
        -- secure_document_shares created before messages: messages.document_id
        -- (if ever added) would FK into it.
        CREATE TABLE IF NOT EXISTS secure_document_shares (
            document_id        SERIAL PRIMARY KEY,
            engagement_id      INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            uploaded_by_id     INTEGER REFERENCES users(user_id),
            document_name      TEXT NOT NULL,
            document_type      TEXT,
            storage_url        TEXT NOT NULL,
            file_size_bytes    BIGINT,
            checksum_sha256    TEXT,
            access_expires_at  TIMESTAMP,
            is_revoked         BOOLEAN DEFAULT false,
            revoked_at         TIMESTAMP,
            first_accessed_at  TIMESTAMP,
            created_at         TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS chat_threads (
            thread_id      SERIAL PRIMARY KEY,
            org_user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            expert_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            created_at     TIMESTAMP DEFAULT NOW(),
            UNIQUE (org_user_id, expert_user_id)
        );

        -- All messages belong to a chat_thread. Engagements share the thread
        -- for their org/expert pair -- no separate engagement-scoped message store.
        CREATE TABLE IF NOT EXISTS messages (
            message_id   SERIAL PRIMARY KEY,
            thread_id    INTEGER NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
            sender_id    INTEGER REFERENCES users(user_id),
            content      TEXT,
            message_type TEXT NOT NULL DEFAULT 'text',
            is_read      BOOLEAN DEFAULT false,
            read_at      TIMESTAMP,
            created_at   TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notifications (
            notification_id       SERIAL PRIMARY KEY,
            user_id               INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            type                  TEXT NOT NULL,
            title                 TEXT NOT NULL,
            body                  TEXT,
            related_entity_type   TEXT,
            related_entity_id     INTEGER,
            action_url            TEXT,
            is_read               BOOLEAN DEFAULT false,
            read_at               TIMESTAMP,
            created_at            TIMESTAMP DEFAULT NOW()
        );

        -- DOMAIN 7: TRUST & REVIEWS ------------------------------------------------
        CREATE TABLE IF NOT EXISTS reviews (
            review_id              SERIAL PRIMARY KEY,
            engagement_id          INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            reviewer_id            INTEGER REFERENCES users(user_id),
            reviewee_id            INTEGER REFERENCES users(user_id),
            reviewer_role          TEXT NOT NULL,
            overall_rating         SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
            review_title           TEXT,
            review_body            TEXT,
            is_public              BOOLEAN DEFAULT true,
            is_flagged             BOOLEAN DEFAULT false,
            flagged_reason         TEXT,
            created_at             TIMESTAMP DEFAULT NOW(),
            UNIQUE (engagement_id, reviewer_role)
        );

        -- verification_records -- adds related_credential_id FK.
        CREATE TABLE IF NOT EXISTS verification_records (
            verification_id          SERIAL PRIMARY KEY,
            user_id                  INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
            verification_type        TEXT NOT NULL,
            related_credential_id    INTEGER REFERENCES expert_credentials(credential_id) ON DELETE CASCADE,
            status                   TEXT NOT NULL DEFAULT 'pending',
            reviewed_by_admin_id     INTEGER REFERENCES users(user_id),
            submitted_document_urls  TEXT[],
            admin_notes              TEXT,
            rejection_reason         TEXT,
            reviewed_at              TIMESTAMP,
            expires_at               DATE,
            ai_recommendation        TEXT,
            ai_confidence            TEXT,
            ai_reasoning             TEXT,
            ai_red_flags             TEXT[],
            ai_reviewed_at           TIMESTAMP,
            created_at               TIMESTAMP DEFAULT NOW()
        );

        -- DOMAIN 8: RISK ASSESSMENT -------------------------------------------------
        CREATE TABLE IF NOT EXISTS risk_assessments (
            assessment_id                   SERIAL PRIMARY KEY,
            engagement_id                   INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
            created_by_expert_id            INTEGER REFERENCES expert_profiles(expert_profile_id),
            overall_risk_level              TEXT NOT NULL,
            quantum_readiness_score         NUMERIC(5,2),
            hndl_exposure                   TEXT,
            executive_summary               TEXT,
            methodology                     TEXT,
            estimated_migration_cost_min    NUMERIC(12,2),
            estimated_migration_cost_max    NUMERIC(12,2),
            estimated_migration_months      INTEGER,
            status                          TEXT NOT NULL DEFAULT 'draft',
            delivered_at                    TIMESTAMP,
            created_at                      TIMESTAMP DEFAULT NOW(),
            updated_at                      TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS assessment_findings (
            finding_id          SERIAL PRIMARY KEY,
            assessment_id       INTEGER REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE,
            category            TEXT NOT NULL,
            severity            TEXT NOT NULL,
            title               TEXT NOT NULL,
            description         TEXT,
            affected_systems    TEXT,
            vulnerability_type  TEXT,
            order_index         INTEGER,
            created_at          TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS remediation_recommendations (
            recommendation_id            SERIAL PRIMARY KEY,
            finding_id                   INTEGER REFERENCES assessment_findings(finding_id) ON DELETE CASCADE,
            assessment_id                INTEGER REFERENCES risk_assessments(assessment_id),
            priority                     TEXT NOT NULL,
            action_title                 TEXT NOT NULL,
            action_description           TEXT,
            recommended_pqc_algorithm    TEXT,
            nist_standard_reference      TEXT,
            estimated_effort_weeks       INTEGER,
            estimated_cost_range         TEXT,
            dependencies                 TEXT,
            is_completed                 BOOLEAN DEFAULT false,
            completed_at                 TIMESTAMP,
            created_at                   TIMESTAMP DEFAULT NOW()
        );
        """,
    ),
    (
        "002_email_verification",
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP;
        """,
    ),
    (
        "003_password_reset",
        """
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMP;
        """,
    ),
]


async def run(conn=None) -> None:
    """
    Apply every migration in order. Pass an existing connection (e.g. from
    within server/db/seed.py's transaction) to run as part of that
    transaction; otherwise a pooled connection is used directly.
    """
    db = conn if conn is not None else await get_pool()
    for name, sql in MIGRATIONS:
        logger.info("applying migration: %s", name)
        await db.execute(sql)
        logger.info("done: %s", name)


async def main():
    logging.basicConfig(level=logging.INFO)
    try:
        await run()
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
