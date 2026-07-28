"""
QuantumConnect — Database Seed
================================
Run with:  python seed.py
Requires:  pip install asyncpg passlib[bcrypt]

Set DATABASE_URL to your Postgres connection string before running.
Example:   postgresql://postgres:password@localhost/quantumconnect

Uses the shared connection pool from pool.py. All seeding runs inside a
single transaction (via pool.transaction()), so if anything fails partway
through, the database is left untouched. The transaction scope also lets the
DEFERRED weight-sum trigger on match_scoring_factors validate at COMMIT.
"""

import asyncio
from passlib.context import CryptContext
from datetime import date, timedelta

from server.db.connection_pool import transaction, close_pool

# passlib is the Python equivalent of bcrypt npm -- same algorithm, same idea
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def add_years(d: date, years: int) -> date:
    """
    Leap-year-safe year arithmetic. date.replace(year=...) raises on Feb 29,
    so fall back to Feb 28 when the target year isn't a leap year.
    """
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)


# -- SEED ----------------------------------------------------------------------
async def seed():
    # One pooled connection, one transaction -- all-or-nothing seeding.
    async with transaction() as conn:

        # -- DROP TABLES (reverse dependency order) ----------------------------
        print("Dropping existing tables...")
        drop_order = [
            "remediation_recommendations",
            "assessment_findings",
            "risk_assessments",
            "verification_records",
            "reviews",
            "notifications",
            "messages",
            "secure_document_shares",
            "engagement_milestones",
            "engagements",
            "match_scoring_factors",
            "connection_requests",
            "expert_engagement_types",
            "expert_sector_experience",
            "expert_specializations",
            "expert_work_history",
            "expert_credentials",
            "organization_infrastructure",
            "organization_profiles",
            "expert_profiles",
            "users",
        ]
        for table in drop_order:
            await conn.execute(f"DROP TABLE IF EXISTS {table} CASCADE")

        # -- DOMAIN 1: IDENTITY & AUTH -----------------------------------------
        await conn.execute("""
            CREATE TABLE users (
                user_id            SERIAL PRIMARY KEY,
                email              TEXT UNIQUE NOT NULL,
                password_hash      TEXT NOT NULL,
                role               TEXT NOT NULL CHECK (role IN ('organization', 'expert', 'admin')),
                is_email_verified  BOOLEAN DEFAULT false,
                is_active          BOOLEAN DEFAULT true,
                last_login_at      TIMESTAMP,
                created_at         TIMESTAMP DEFAULT NOW(),
                updated_at         TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE organization_profiles (
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
                created_at                     TIMESTAMP DEFAULT NOW(),
                updated_at                     TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE expert_profiles (
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
            )
        """)

        # -- DOMAIN 2: PROFILES & DISCOVERY ------------------------------------
        await conn.execute("""
            CREATE TABLE organization_infrastructure (
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
            )
        """)

        # expert_credentials -- note: is_admin_verified removed in this schema.
        await conn.execute("""
            CREATE TABLE expert_credentials (
                credential_id      SERIAL PRIMARY KEY,
                expert_id          INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
                credential_type    TEXT NOT NULL,
                credential_name    TEXT NOT NULL,
                institution        TEXT,
                year_obtained      INTEGER,
                expiry_date        DATE,
                verification_url   TEXT,
                created_at         TIMESTAMP DEFAULT NOW()
            )
        """)

        # expert_work_history -- new table in this schema.
        await conn.execute("""
            CREATE TABLE expert_work_history (
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
            )
        """)

        await conn.execute("""
            CREATE TABLE expert_specializations (
                specialization_id       SERIAL PRIMARY KEY,
                expert_id               INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
                specialization          TEXT NOT NULL,
                proficiency_level       TEXT NOT NULL,
                years_in_specialization INTEGER,
                created_at              TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE expert_sector_experience (
                sector_exp_id                 SERIAL PRIMARY KEY,
                expert_id                     INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
                sector                        TEXT NOT NULL,
                years_experience_in_sector    INTEGER,
                compliance_standards_known    TEXT[],
                anonymized_client_examples    TEXT,
                created_at                    TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE expert_engagement_types (
                eng_type_id                   SERIAL PRIMARY KEY,
                expert_id                     INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE,
                engagement_type               TEXT NOT NULL,
                typical_duration_weeks_min    INTEGER,
                typical_duration_weeks_max    INTEGER,
                typical_budget_min            NUMERIC(10,2),
                typical_budget_max            NUMERIC(10,2),
                approach_description          TEXT,
                created_at                    TIMESTAMP DEFAULT NOW()
            )
        """)

        # -- DOMAIN 4: MATCHING ------------------------------------------------
        await conn.execute("""
            CREATE TABLE connection_requests (
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
            )
        """)

        # UNIQUE partial index: only one open (pending) request per org/expert pair.
        await conn.execute("""
            CREATE UNIQUE INDEX uq_connection_pending
                ON connection_requests (org_id, expert_id)
                WHERE status = 'pending'
        """)

        await conn.execute("""
            CREATE TABLE match_scoring_factors (
                factor_id               SERIAL PRIMARY KEY,
                connection_id           INTEGER REFERENCES connection_requests(connection_id) ON DELETE CASCADE,
                factor_name             TEXT NOT NULL,
                weight                  NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 1),
                raw_score               NUMERIC(5,2) NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
                weighted_contribution   NUMERIC(5,2),
                created_at              TIMESTAMP DEFAULT NOW()
            )
        """)

        # Deferred constraint trigger: at COMMIT, SUM(weight) per connection_id
        # must be approximately 1.00 (+/- 0.01 rounding tolerance).
        await conn.execute("""
            CREATE OR REPLACE FUNCTION check_match_factors_weight_sum()
            RETURNS TRIGGER AS $$
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
            $$ LANGUAGE plpgsql
        """)

        await conn.execute("""
            CREATE CONSTRAINT TRIGGER trg_match_factors_weight_sum
                AFTER INSERT OR UPDATE OR DELETE ON match_scoring_factors
                DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW
                EXECUTE FUNCTION check_match_factors_weight_sum()
        """)

        # -- DOMAIN 5: ENGAGEMENTS ---------------------------------------------
        await conn.execute("""
            CREATE TABLE engagements (
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
                created_at               TIMESTAMP DEFAULT NOW(),
                updated_at               TIMESTAMP DEFAULT NOW()
            )
        """)

        # engagement_milestones -- reworked: proposal/confirmation workflow,
        # new status set, no payment_amount column.
        await conn.execute("""
            CREATE TABLE engagement_milestones (
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
                created_at                 TIMESTAMP DEFAULT NOW(),
                updated_at                 TIMESTAMP DEFAULT NOW()
            )
        """)

        # -- DOMAIN 6: COMMUNICATION -------------------------------------------
        # secure_document_shares created before messages: messages.document_id
        # FKs into it.
        await conn.execute("""
            CREATE TABLE secure_document_shares (
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
            )
        """)

        await conn.execute("""
            CREATE TABLE chat_threads (
                thread_id      SERIAL PRIMARY KEY,
                org_user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                expert_user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at     TIMESTAMP DEFAULT NOW(),
                UNIQUE (org_user_id, expert_user_id)
            )
        """)

        # messages -- file attachments now reference secure_document_shares
        # via document_id instead of inline file_url/file_name/file_size_bytes.
        # thread_id links pre-connection inquiry messages to chat_threads.
        await conn.execute("""
            CREATE TABLE messages (
                message_id       SERIAL PRIMARY KEY,
                engagement_id    INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
                thread_id        INTEGER REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
                sender_id        INTEGER REFERENCES users(user_id),
                content          TEXT,
                message_type     TEXT NOT NULL DEFAULT 'text',
                document_id      INTEGER REFERENCES secure_document_shares(document_id) ON DELETE SET NULL,
                is_read          BOOLEAN DEFAULT false,
                read_at          TIMESTAMP,
                created_at       TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE notifications (
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
            )
        """)

        # -- DOMAIN 7: TRUST & REVIEWS -----------------------------------------
        await conn.execute("""
            CREATE TABLE reviews (
                review_id              SERIAL PRIMARY KEY,
                engagement_id          INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE,
                reviewer_id            INTEGER REFERENCES users(user_id),
                reviewee_id            INTEGER REFERENCES users(user_id),
                reviewer_role          TEXT NOT NULL,
                overall_rating         SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
                communication_rating   SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
                expertise_rating       SMALLINT CHECK (expertise_rating BETWEEN 1 AND 5),
                timeliness_rating      SMALLINT CHECK (timeliness_rating BETWEEN 1 AND 5),
                value_rating           SMALLINT CHECK (value_rating BETWEEN 1 AND 5),
                review_title           TEXT,
                review_body            TEXT,
                is_public              BOOLEAN DEFAULT true,
                is_flagged             BOOLEAN DEFAULT false,
                flagged_reason         TEXT,
                created_at             TIMESTAMP DEFAULT NOW(),
                UNIQUE (engagement_id, reviewer_role)
            )
        """)

        # verification_records -- adds related_credential_id FK.
        await conn.execute("""
            CREATE TABLE verification_records (
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
                created_at               TIMESTAMP DEFAULT NOW()
            )
        """)

        # -- DOMAIN 8: RISK ASSESSMENT -----------------------------------------
        await conn.execute("""
            CREATE TABLE risk_assessments (
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
            )
        """)

        await conn.execute("""
            CREATE TABLE assessment_findings (
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
            )
        """)

        await conn.execute("""
            CREATE TABLE remediation_recommendations (
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
            )
        """)

        # -- SEED DATA ---------------------------------------------------------
        # -- USERS -------------------------------------------------------------
        admin_hash  = hash_password("password123")
        org_hash    = hash_password("password123")
        expert_hash = hash_password("password123")

        admin = await conn.fetchrow("""
            INSERT INTO users (email, password_hash, role, is_email_verified)
            VALUES ($1, $2, 'admin', true)
            RETURNING user_id, email
        """, "admin@quantumconnect.com", admin_hash)

        org_user = await conn.fetchrow("""
            INSERT INTO users (email, password_hash, role, is_email_verified)
            VALUES ($1, $2, 'organization', true)
            RETURNING user_id, email
        """, "cto@firstcommunitybankny.com", org_hash)

        expert_user = await conn.fetchrow("""
            INSERT INTO users (email, password_hash, role, is_email_verified)
            VALUES ($1, $2, 'expert', true)
            RETURNING user_id, email
        """, "dr.chen@quantumsec.io", expert_hash)

        # -- ORGANIZATION PROFILE ----------------------------------------------
        org_profile = await conn.fetchrow("""
            INSERT INTO organization_profiles (
                user_id, org_name, contact_name, contact_title, sector, sub_sector, founded_year,
                employee_count_range, country, state_province, website,
                org_description, quantum_knowledge_level, budget_range,
                urgency_level, default_connection_expiry_days, is_verified
            ) VALUES (
                $1, 'First Community Bank of New York', 'Jordan Alvarez', 'Chief Technology Officer', 'financial',
                'community bank', 1987, '50-250', 'United States', 'New York',
                'https://www.firstcommunitybankny.com',
                'A regional community bank serving the Hudson Valley since 1987, storing decades of customer financial and mortgage records.',
                'basic', '50k_250k', 'urgent',
                14,
                true
            )
            RETURNING org_profile_id
        """, org_user['user_id'])

        # -- EXPERT PROFILE ----------------------------------------------------
        expert_profile = await conn.fetchrow("""
            INSERT INTO expert_profiles (
                user_id, first_name, last_name, headline, bio,
                years_of_experience, linkedin_url,
                hourly_rate_min, hourly_rate_max,
                availability_status, avg_response_time_hours,
                preferred_engagement_length, is_verified, verification_status,
                avg_rating, total_completed_engagements
            ) VALUES (
                $1, 'Sarah', 'Chen',
                'Post-Quantum Cryptography Specialist | NIST PQC Standards Expert',
                'Dr. Chen is a leading researcher in post-quantum cryptography with 14 years of experience advising financial institutions and government agencies on NIST PQC migration strategies.',
                14, 'https://linkedin.com/in/dr-sarah-chen',
                350.00, 500.00,
                'available', 4, 'both',
                true, 'verified', 4.9, 23
            )
            RETURNING expert_profile_id
        """, expert_user['user_id'])

        # -- ORGANIZATION INFRASTRUCTURE ---------------------------------------
        await conn.execute("""
            INSERT INTO organization_infrastructure (
                org_id, data_categories, storage_type,
                primary_cloud_providers, current_encryption_standards,
                data_retention_years, oldest_system_age_years,
                compliance_requirements, has_dedicated_security_team,
                had_prior_quantum_assessment, known_risks_freetext
            ) VALUES (
                $1,
                ARRAY['customer_financial_records', 'mortgage_data', 'SSNs', 'transaction_history'],
                'hybrid',
                ARRAY['AWS'],
                ARRAY['RSA-2048', 'AES-256', 'TLS-1.2'],
                7, 22,
                ARRAY['PCI-DSS', 'GLBA', 'SOX'],
                false, false,
                'Our core banking system runs on a 22-year-old IBM mainframe using RSA-2048. We are particularly concerned about harvest-now-decrypt-later attacks on our mortgage records.'
            )
        """, org_profile['org_profile_id'])

        # -- EXPERT CREDENTIALS (no is_admin_verified in this schema) ----------
        cred_phd = await conn.fetchrow("""
            INSERT INTO expert_credentials (
                expert_id, credential_type, credential_name, institution, year_obtained
            ) VALUES ($1, 'degree', 'PhD in Cryptography', 'MIT', 2010)
            RETURNING credential_id
        """, expert_profile['expert_profile_id'])

        cred_cissp = await conn.fetchrow("""
            INSERT INTO expert_credentials (
                expert_id, credential_type, credential_name, institution, year_obtained
            ) VALUES ($1, 'certification', 'CISSP', 'ISC2', 2015)
            RETURNING credential_id
        """, expert_profile['expert_profile_id'])

        await conn.execute("""
            INSERT INTO expert_credentials (
                expert_id, credential_type, credential_name, institution, year_obtained
            ) VALUES ($1, 'publication', 'Lattice-Based Cryptography for Financial Systems', 'IEEE Security & Privacy', 2022)
        """, expert_profile['expert_profile_id'])

        # -- EXPERT WORK HISTORY (new table) -----------------------------------
        await conn.execute("""
            INSERT INTO expert_work_history (
                expert_id, organization_name, job_title, employment_type,
                start_date, end_date, is_current, description, order_index
            ) VALUES
                ($1, 'QuantumSec Consulting', 'Principal Cryptography Consultant', 'consulting',
                 $2, NULL, true,
                 'Lead post-quantum migration engagements for financial and government clients.', 1),
                ($1, 'National Institute of Standards & Technology', 'Visiting Researcher', 'government',
                 $3, $4, false,
                 'Participated in the NIST PQC standardization review process.', 2),
                ($1, 'MIT Computer Science & AI Laboratory', 'Postdoctoral Researcher', 'academic',
                 $5, $6, false,
                 'Lattice-based cryptography research; published on financial-sector applications.', 3)
        """,
            expert_profile['expert_profile_id'],
            date(2018, 1, 1),
            date(2015, 6, 1), date(2017, 12, 31),
            date(2010, 9, 1), date(2015, 5, 31)
        )

        # -- EXPERT SPECIALIZATIONS --------------------------------------------
        await conn.execute("""
            INSERT INTO expert_specializations (
                expert_id, specialization, proficiency_level, years_in_specialization
            ) VALUES
                ($1, 'post_quantum_cryptography', 'leading_researcher', 9),
                ($1, 'nist_pqc_standards',        'expert',             6),
                ($1, 'migration_planning',         'expert',             7),
                ($1, 'cryptographic_audit',        'expert',             10),
                ($1, 'lattice_cryptography',       'leading_researcher', 8)
        """, expert_profile['expert_profile_id'])

        # -- EXPERT SECTOR EXPERIENCE ------------------------------------------
        await conn.execute("""
            INSERT INTO expert_sector_experience (
                expert_id, sector, years_experience_in_sector,
                compliance_standards_known, anonymized_client_examples
            ) VALUES
                ($1, 'financial', 8,
                 ARRAY['PCI-DSS', 'SOX', 'GLBA', 'FFIEC'],
                 'Conducted cryptographic audits for two regional banks and one national payment processor. Delivered migration roadmaps covering core banking systems and ATM networks.'),
                ($1, 'government', 5,
                 ARRAY['FISMA', 'FedRAMP', 'NIST SP 800-207'],
                 'Advised a state-level agency on post-quantum migration readiness and participated in the NIST PQC standardization review process.')
        """, expert_profile['expert_profile_id'])

        # -- EXPERT ENGAGEMENT TYPES (canonical engagement_type enum) ----------
        await conn.execute("""
            INSERT INTO expert_engagement_types (
                expert_id, engagement_type,
                typical_duration_weeks_min, typical_duration_weeks_max,
                typical_budget_min, typical_budget_max,
                approach_description
            ) VALUES
                ($1, 'cryptographic_audit', 6, 10, 40000.00, 90000.00,
                 'I begin with a full cryptographic asset inventory -- algorithms, key lengths, certificate lifecycles, and protocol versions -- then map each asset to its quantum vulnerability using Shor''s and Grover''s threat models.'),
                ($1, 'migration_roadmap', 8, 16, 60000.00, 150000.00,
                 'Roadmaps follow a phased approach: assess, prioritize, pilot, and scale. I work closely with engineering teams to ensure NIST FIPS 203/204/205 standards are correctly implemented for your specific infrastructure.'),
                ($1, 'executive_briefing', 1, 2, 5000.00, 15000.00,
                 'A 2-day engagement to bring your board and C-suite up to speed on quantum threats, regulatory timelines, and your specific risk exposure. Includes a one-page risk summary for board presentation.')
        """, expert_profile['expert_profile_id'])

        # -- SECOND EXPERT (unavailable — exercises the 422 guard and 403s) ----
        expert2_user = await conn.fetchrow("""
            INSERT INTO users (email, password_hash, role, is_email_verified)
            VALUES ($1, $2, 'expert', true)
            RETURNING user_id, email
        """, "m.okafor@pqshield.dev", expert_hash)

        await conn.execute("""
            INSERT INTO expert_profiles (
                user_id, first_name, last_name, headline,
                hourly_rate_min, hourly_rate_max, availability_status,
                is_verified, verification_status
            ) VALUES (
                $1, 'Marcus', 'Okafor', 'Quantum-Safe Network Architect',
                200.00, 300.00, 'unavailable',
                true, 'verified'
            )
        """, expert2_user['user_id'])

        # -- CONNECTION REQUEST ------------------------------------------------
        connection = await conn.fetchrow("""
            INSERT INTO connection_requests (
                org_id, expert_id, initiated_by_user_id,
                status, initial_message, org_stated_need, org_stated_timeline,
                match_score, expires_at, responded_at
            ) VALUES (
                $1, $2, $3,
                'accepted',
                'Hello Dr. Chen, we are a community bank with a 22-year-old core banking system relying heavily on RSA-2048. We are concerned about harvest-now-decrypt-later attacks on our mortgage records and would love to discuss a cryptographic audit.',
                'cryptographic_audit', 'within_3mo',
                100.00,
                NOW() + INTERVAL '14 days',
                NOW() - INTERVAL '2 days'
            )
            RETURNING connection_id
        """,
            org_profile['org_profile_id'],
            expert_profile['expert_profile_id'],
            org_user['user_id']
        )

        # -- MATCH SCORING FACTORS (weights sum to 1.00; checked at COMMIT) ----
        # Values are exactly what server/models/match_scoring.py computes for
        # this org/expert pair: financial sector w/ 8 yrs -> 100; PCI-DSS,
        # GLBA, SOX all known -> 100; audit budget 40-90k overlaps 50k-250k
        # -> 100; 'available' -> 100. match_score = sum of contributions.
        await conn.execute("""
            INSERT INTO match_scoring_factors (
                connection_id, factor_name, weight, raw_score, weighted_contribution
            ) VALUES
                ($1, 'sector_match',       0.40, 100.00, 40.00),
                ($1, 'compliance_overlap', 0.25, 100.00, 25.00),
                ($1, 'budget_fit',         0.15, 100.00, 15.00),
                ($1, 'availability_fit',   0.20, 100.00, 20.00)
        """, connection['connection_id'])

        # -- ENGAGEMENT --------------------------------------------------------
        today = date.today()

        engagement = await conn.fetchrow("""
            INSERT INTO engagements (
                connection_id, org_id, expert_id, engagement_type,
                title, description, status,
                agreed_budget, payment_structure, start_date, estimated_end_date
            ) VALUES (
                $1, $2, $3, 'cryptographic_audit',
                'Cryptographic Audit -- First Community Bank of NY',
                'Full cryptographic asset audit covering core banking, ATM network, and customer-facing web infrastructure. Focus on RSA-2048 exposure and HNDL risk for long-lived mortgage records.',
                'active',
                75000.00, 'milestone_based',
                $4, $5
            )
            RETURNING engagement_id
        """,
            connection['connection_id'],
            org_profile['org_profile_id'],
            expert_profile['expert_profile_id'],
            today,
            today + timedelta(weeks=8)
        )

        # -- ENGAGEMENT MILESTONES (proposal/confirmation workflow) ------------
        # These were proposed by the expert and confirmed by the same expert.
        await conn.execute("""
            INSERT INTO engagement_milestones (
                engagement_id, proposed_by_user_id, proposed_by_role,
                title, description, order_index, due_date,
                deliverable_description, status,
                confirmed_by_expert_id, confirmed_at,
                requires_client_approval, completed_at
            ) VALUES
                ($1, $2, 'expert',
                 'Kickoff & Scoping',
                 'Scope alignment, documentation gathering, secure channel setup.',
                 1, $3, 'Signed scope-of-work document', 'completed',
                 $4, NOW() - INTERVAL '9 days',
                 true, NOW() - INTERVAL '5 days'),

                ($1, $2, 'expert',
                 'Cryptographic Asset Inventory',
                 'Full enumeration of all cryptographic assets across all systems.',
                 2, $5, 'Cryptographic asset register', 'in_progress',
                 $4, NOW() - INTERVAL '9 days',
                 true, NULL),

                ($1, $2, 'expert',
                 'Vulnerability Mapping',
                 'Map each asset to Shor/Grover threat models. Identify HNDL exposure.',
                 3, $6, 'Vulnerability mapping report', 'confirmed',
                 $4, NOW() - INTERVAL '9 days',
                 false, NULL),

                ($1, $2, 'expert',
                 'Compliance Gap Analysis',
                 'Gap analysis against FFIEC and NIST post-quantum guidance.',
                 4, $7, 'Compliance gap matrix', 'confirmed',
                 $4, NOW() - INTERVAL '9 days',
                 false, NULL),

                ($1, $2, 'expert',
                 'Final Report & Presentation',
                 'Delivery of full assessment report and executive presentation.',
                 5, $8, 'Full assessment report PDF, executive deck', 'confirmed',
                 $4, NOW() - INTERVAL '9 days',
                 true, NULL)
        """,
            engagement['engagement_id'],
            expert_user['user_id'],
            today - timedelta(days=5),
            expert_profile['expert_profile_id'],
            today + timedelta(weeks=2),
            today + timedelta(weeks=4),
            today + timedelta(weeks=6),
            today + timedelta(weeks=8)
        )

        # -- SECURE DOCUMENT SHARE (created first so a message can reference it)
        document = await conn.fetchrow("""
            INSERT INTO secure_document_shares (
                engagement_id, uploaded_by_id, document_name, document_type,
                storage_url, file_size_bytes, checksum_sha256
            ) VALUES (
                $1, $2,
                'network_topology_2024.pdf', 'network_diagram',
                's3://qc-secure-docs/engagements/1/network_topology_encrypted.pdf',
                2457600,
                'a3f8d9c2e1b4f5a67890abcdef1234567890abcdef1234567890abcdef12345678'
            )
            RETURNING document_id
        """, engagement['engagement_id'], org_user['user_id'])

        # -- MESSAGES (file message links secure_document_shares via document_id)
        await conn.execute("""
            INSERT INTO messages (
                engagement_id, sender_id, content, message_type, document_id, is_read, read_at
            ) VALUES
                ($1, $2,
                 'Hi Dr. Chen, glad to be working with you. I have attached our network diagram. Let me know if you need anything before the kickoff call.',
                 'file', $4, true, NOW() - INTERVAL '4 days'),

                ($1, $3,
                 'Thank you! I have reviewed the documents. Preliminary observation: your core banking system is using RSA-2048 for TLS termination -- that will be the highest priority item. See you Thursday!',
                 'text', NULL, true, NOW() - INTERVAL '3 days'),

                ($1, $2,
                 'Quick question -- does the audit cover our ATM network? Our ATMs are managed by a third-party vendor.',
                 'text', NULL, true, NOW() - INTERVAL '1 day'),

                ($1, $3,
                 'Yes, third-party ATM vendors are in scope. I will assess their cryptographic guarantees and whether their contracts require quantum-safe upgrades. This is a common gap for community banks.',
                 'text', NULL, false, NULL)
        """,
            engagement['engagement_id'],
            org_user['user_id'],
            expert_user['user_id'],
            document['document_id']
        )

        # -- NOTIFICATIONS -----------------------------------------------------
        await conn.execute("""
            INSERT INTO notifications (
                user_id, type, title, body,
                related_entity_type, related_entity_id, action_url, is_read
            ) VALUES
                ($1, 'connection_accepted',
                 'Dr. Sarah Chen accepted your connection request',
                 'Dr. Chen has accepted your request and is ready to begin scoping your cryptographic audit.',
                 'connection_request', $2, '/connections/1', true),

                ($1, 'milestone_completed',
                 'Milestone completed: Kickoff & Scoping',
                 'The kickoff milestone has been marked complete. Next up: Cryptographic Asset Inventory.',
                 'engagement', $3, '/engagements/1/milestones', false)
        """,
            org_user['user_id'],
            connection['connection_id'],
            engagement['engagement_id']
        )

        # -- VERIFICATION RECORDS (identity + credential-linked) ---------------
        await conn.execute("""
            INSERT INTO verification_records (
                user_id, verification_type, related_credential_id, status,
                reviewed_by_admin_id, admin_notes, reviewed_at, expires_at
            ) VALUES
                ($1, 'identity', NULL, 'approved', $2,
                 'Government ID verified against submitted documents.',
                 NOW() - INTERVAL '30 days', $3),

                ($1, 'professional_credential', $4, 'approved', $2,
                 'PhD confirmed via institution registry.',
                 NOW() - INTERVAL '28 days', $5),

                ($1, 'professional_credential', $6, 'approved', $2,
                 'CISSP confirmed via ISC2 registry.',
                 NOW() - INTERVAL '28 days', $5)
        """,
            expert_user['user_id'],
            admin['user_id'],
            add_years(today, 2),
            cred_phd['credential_id'],
            add_years(today, 3),
            cred_cissp['credential_id']
        )

        # -- REVIEW (UNIQUE per engagement/reviewer_role) ----------------------
        await conn.execute("""
            INSERT INTO reviews (
                engagement_id, reviewer_id, reviewee_id, reviewer_role,
                overall_rating, communication_rating, expertise_rating,
                timeliness_rating, value_rating,
                review_title, review_body, is_public
            ) VALUES (
                $1, $2, $3, 'organization',
                5, 5, 5, 5, 5,
                'Exceptional expertise -- transformed how we think about our security posture',
                'Dr. Chen identified vulnerabilities we had no idea existed. Her explanation of harvest-now-decrypt-later attacks was clear enough that we could present the risk to our board and get immediate budget approval for remediation. The final report was thorough and directly actionable.',
                true
            )
        """, engagement['engagement_id'], org_user['user_id'], expert_user['user_id'])

        # -- RISK ASSESSMENT ---------------------------------------------------
        assessment = await conn.fetchrow("""
            INSERT INTO risk_assessments (
                engagement_id, created_by_expert_id,
                overall_risk_level, quantum_readiness_score, hndl_exposure,
                executive_summary, methodology,
                estimated_migration_cost_min, estimated_migration_cost_max,
                estimated_migration_months, status, delivered_at
            ) VALUES (
                $1, $2,
                'high', 28.5, 'high',
                'First Community Bank of NY operates a cryptographic infrastructure substantially vulnerable to quantum computing threats. The core banking system''s reliance on RSA-2048 and its 22-year-old architecture present significant harvest-now-decrypt-later exposure for long-lived mortgage records. Immediate prioritization of hybrid PQC migration is recommended.',
                'Assessment conducted via documentation review, system interviews, automated cryptographic scanning of network-accessible services, and manual review of vendor contracts. Findings mapped against NIST IR 8547 and FFIEC post-quantum guidance.',
                850000.00, 2200000.00,
                36,
                'delivered', NOW() - INTERVAL '1 day'
            )
            RETURNING assessment_id
        """, engagement['engagement_id'], expert_profile['expert_profile_id'])

        # -- ASSESSMENT FINDINGS -----------------------------------------------
        finding_1 = await conn.fetchrow("""
            INSERT INTO assessment_findings (
                assessment_id, category, severity, title, description,
                affected_systems, vulnerability_type, order_index
            ) VALUES (
                $1, 'cryptographic_algorithm', 'critical',
                'RSA-2048 Used for Core Banking TLS Termination',
                'The core banking system terminates TLS using RSA-2048 key exchange. Shor''s algorithm can factor the RSA modulus and recover private keys, breaking the confidentiality of all banking communications.',
                'IBM mainframe core banking, internal API gateway, customer web portal TLS',
                'shor_algorithm_vulnerable', 1
            )
            RETURNING finding_id
        """, assessment['assessment_id'])

        finding_2 = await conn.fetchrow("""
            INSERT INTO assessment_findings (
                assessment_id, category, severity, title, description,
                affected_systems, vulnerability_type, order_index
            ) VALUES (
                $1, 'data_at_rest', 'high',
                'Long-Lived Mortgage Records at HNDL Risk',
                'Mortgage records with 30-year retention requirements are encrypted with RSA-2048 at rest. Adversaries may be harvesting this encrypted data today with intent to decrypt it once quantum hardware becomes available -- well within the retention window.',
                'Document management system, mortgage origination archive, regulatory reporting store',
                'harvest_now_decrypt_later', 2
            )
            RETURNING finding_id
        """, assessment['assessment_id'])

        # -- REMEDIATION RECOMMENDATIONS ---------------------------------------
        await conn.execute("""
            INSERT INTO remediation_recommendations (
                finding_id, assessment_id, priority,
                action_title, action_description,
                recommended_pqc_algorithm, nist_standard_reference,
                estimated_effort_weeks, estimated_cost_range, dependencies
            ) VALUES
                ($1, $2, 'immediate',
                 'Deploy Hybrid TLS with CRYSTALS-Kyber',
                 'Replace RSA-2048 key exchange with a hybrid scheme combining ECDH (X25519) and CRYSTALS-Kyber (ML-KEM). Hybrid schemes provide backward compatibility while adding quantum resistance. Update load balancers and API gateway first, then the mainframe TLS stack.',
                 'CRYSTALS-Kyber (ML-KEM)', 'NIST FIPS 203',
                 12, '$120,000 - $200,000',
                 'Vendor support confirmation for Kyber on IBM mainframe TLS; staff PQC training'),

                ($3, $2, 'short_term_0_6mo',
                 'Re-encrypt Mortgage Archive with AES-256 + Kyber Hybrid',
                 'Initiate phased re-encryption of the mortgage records archive using AES-256 for data at rest with key encapsulation migrated to CRYSTALS-Kyber. Protects the key exchange layer against future quantum decryption.',
                 'CRYSTALS-Kyber (ML-KEM) for key encapsulation, AES-256 for data', 'NIST FIPS 203',
                 24, '$350,000 - $700,000',
                 'Completion of TLS migration; legal review of re-encryption process against GLBA; storage capacity planning for re-encryption staging')
        """,
            finding_1['finding_id'],
            assessment['assessment_id'],
            finding_2['finding_id']
        )

        return {
            "admin":        admin,
            "org_user":     org_user,
            "expert_user":  expert_user,
            "expert2_user": expert2_user,
        }


# -- ENTRY POINT ---------------------------------------------------------------
if __name__ == "__main__":
    async def main():
        try:
            users = await seed()
            print("\nDatabase seeded successfully.")
            print(f"  Admin:    {users['admin']['email']}")
            print(f"  Org:      {users['org_user']['email']}")
            print(f"  Expert:   {users['expert_user']['email']}")
            print(f"  Expert 2: {users['expert2_user']['email']} (unavailable)")
        except Exception as e:
            print(f"\nError seeding database: {e}")
            raise
        finally:
            await close_pool()

    asyncio.run(main())