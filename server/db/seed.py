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
from datetime import date, datetime, timedelta

from server.db.connection_pool import transaction, close_pool

# passlib is the Python equivalent of bcrypt npm -- same algorithm, same idea
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


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
            "chat_threads",
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

        # All messages belong to a chat_thread. Engagements share the thread
        # for their org/expert pair — no separate engagement-scoped message store.
        await conn.execute("""
            CREATE TABLE messages (
                message_id   SERIAL PRIMARY KEY,
                thread_id    INTEGER NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
                sender_id    INTEGER REFERENCES users(user_id),
                content      TEXT,
                message_type TEXT NOT NULL DEFAULT 'text',
                is_read      BOOLEAN DEFAULT false,
                read_at      TIMESTAMP,
                created_at   TIMESTAMP DEFAULT NOW()
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
                ai_recommendation        TEXT,
                ai_confidence            TEXT,
                ai_reasoning             TEXT,
                ai_red_flags             TEXT[],
                ai_reviewed_at           TIMESTAMP,
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
        # All accounts share password: password123 (admin included).
        pw = hash_password("password123")

        # -- ADMIN -------------------------------------------------------------
        admin = await conn.fetchrow("""
            INSERT INTO users (email, password_hash, role, is_email_verified)
            VALUES ($1, $2, 'admin', true) RETURNING user_id, email
        """, "admin@quantumconnect.com", pw)

        # -- ORGANIZATIONS -------------------------------------------------------
        ORGS = [
            dict(
                email="cto@firstcommunitybankny.com",
                org_name="First Community Bank of New York",
                contact_name="Jordan Alvarez", contact_title="Chief Technology Officer",
                sector="financial", sub_sector="community bank", founded_year=1987,
                employee_count_range="50-250", country="United States", state_province="New York",
                website="https://www.firstcommunitybankny.com",
                org_description="A regional community bank serving the Hudson Valley since 1987, storing decades of customer financial and mortgage records.",
                quantum_knowledge_level="basic", budget_range="50k_250k", urgency_level="urgent",
                default_connection_expiry_days=14, is_verified=True,
                infrastructure=dict(
                    data_categories=["customer_financial_records", "mortgage_data", "SSNs", "transaction_history"],
                    storage_type="hybrid",
                    primary_cloud_providers=["AWS"],
                    current_encryption_standards=["RSA-2048", "AES-256", "TLS-1.2"],
                    data_retention_years=7, oldest_system_age_years=22,
                    compliance_requirements=["PCI-DSS", "GLBA", "SOX"],
                    has_dedicated_security_team=False, had_prior_quantum_assessment=False,
                    known_risks_freetext="Our core banking system runs on a 22-year-old IBM mainframe using RSA-2048. We are particularly concerned about harvest-now-decrypt-later attacks on our mortgage records.",
                ),
            ),
            dict(
                email="ciso@medicore-health.com",
                org_name="MediCore Health Systems",
                contact_name="Dr. Michelle Kim", contact_title="Chief Information Security Officer",
                sector="healthcare", sub_sector="hospital network", founded_year=2005,
                employee_count_range="1000-5000", country="United States", state_province="California",
                website="https://www.medicore-health.com",
                org_description="MediCore Health Systems operates a network of 12 hospitals and 45 outpatient clinics across California, handling electronic health records, medical imaging, and insurance billing systems.",
                quantum_knowledge_level="intermediate", budget_range="250k_1m", urgency_level="high",
                default_connection_expiry_days=30, is_verified=True,
                infrastructure=dict(
                    data_categories=["electronic_health_records", "medical_imaging", "insurance_billing", "patient_pii"],
                    storage_type="cloud",
                    primary_cloud_providers=["Azure", "GCP"],
                    current_encryption_standards=["RSA-3072", "AES-256", "TLS-1.3"],
                    data_retention_years=10, oldest_system_age_years=9,
                    compliance_requirements=["HIPAA", "HITECH", "HITRUST"],
                    has_dedicated_security_team=True, had_prior_quantum_assessment=False,
                    known_risks_freetext="Patient health records must be retained for 10+ years under state law, well within the window for harvest-now-decrypt-later exposure on RSA-encrypted archives.",
                ),
            ),
        ]

        org_users = []
        org_profiles_by_email = {}
        for org in ORGS:
            org_user = await conn.fetchrow("""
                INSERT INTO users (email, password_hash, role, is_email_verified)
                VALUES ($1, $2, 'organization', true) RETURNING user_id, email
            """, org["email"], pw)

            org_profile = await conn.fetchrow("""
                INSERT INTO organization_profiles (
                    user_id, org_name, contact_name, contact_title, sector, sub_sector, founded_year,
                    employee_count_range, country, state_province, website,
                    org_description, quantum_knowledge_level, budget_range,
                    urgency_level, default_connection_expiry_days, is_verified
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                RETURNING org_profile_id
            """,
                org_user["user_id"], org["org_name"], org["contact_name"], org["contact_title"],
                org["sector"], org["sub_sector"], org["founded_year"], org["employee_count_range"],
                org["country"], org["state_province"], org["website"], org["org_description"],
                org["quantum_knowledge_level"], org["budget_range"], org["urgency_level"],
                org["default_connection_expiry_days"], org["is_verified"],
            )

            infra = org["infrastructure"]
            await conn.execute("""
                INSERT INTO organization_infrastructure (
                    org_id, data_categories, storage_type,
                    primary_cloud_providers, current_encryption_standards,
                    data_retention_years, oldest_system_age_years,
                    compliance_requirements, has_dedicated_security_team,
                    had_prior_quantum_assessment, known_risks_freetext
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            """,
                org_profile["org_profile_id"], infra["data_categories"], infra["storage_type"],
                infra["primary_cloud_providers"], infra["current_encryption_standards"],
                infra["data_retention_years"], infra["oldest_system_age_years"],
                infra["compliance_requirements"], infra["has_dedicated_security_team"],
                infra["had_prior_quantum_assessment"], infra["known_risks_freetext"],
            )

            org_users.append(org_user)
            org_profiles_by_email[org["email"]] = org_profile["org_profile_id"]

        # -- EXPERTS -------------------------------------------------------------
        EXPERTS = [
            dict(
                email="dr.chen@quantumsec.io", first_name="Sarah", last_name="Chen",
                headline="Post-Quantum Cryptography Specialist | NIST PQC Standards Expert",
                bio="Dr. Chen is a leading researcher in post-quantum cryptography with 14 years of experience advising financial institutions and government agencies on NIST PQC migration strategies.",
                years_of_experience=14, linkedin_url="https://linkedin.com/in/dr-sarah-chen",
                hourly_rate_min=350.00, hourly_rate_max=500.00,
                availability_status="available", avg_response_time_hours=4,
                preferred_engagement_length="both", is_verified=True, verification_status="verified",
                avg_rating=4.9, total_completed_engagements=23,
                credentials=[
                    dict(credential_type="degree", credential_name="PhD in Cryptography", institution="MIT", year_obtained=2010),
                    dict(credential_type="certification", credential_name="CISSP", institution="ISC2", year_obtained=2015),
                    dict(credential_type="publication", credential_name="Lattice-Based Cryptography for Financial Systems", institution="IEEE Security & Privacy", year_obtained=2022),
                ],
                work_history=[
                    dict(organization_name="QuantumSec Consulting", job_title="Principal Cryptography Consultant", employment_type="consulting",
                         start_date=date(2018, 1, 1), end_date=None, is_current=True,
                         description="Lead post-quantum migration engagements for financial and government clients.", order_index=1),
                    dict(organization_name="National Institute of Standards & Technology", job_title="Visiting Researcher", employment_type="government",
                         start_date=date(2015, 6, 1), end_date=date(2017, 12, 31), is_current=False,
                         description="Participated in the NIST PQC standardization review process.", order_index=2),
                    dict(organization_name="MIT Computer Science & AI Laboratory", job_title="Postdoctoral Researcher", employment_type="academic",
                         start_date=date(2010, 9, 1), end_date=date(2015, 5, 31), is_current=False,
                         description="Lattice-based cryptography research; published on financial-sector applications.", order_index=3),
                ],
                specializations=[
                    dict(specialization="post_quantum_cryptography", proficiency_level="leading_researcher", years_in_specialization=9),
                    dict(specialization="nist_pqc_standards", proficiency_level="expert", years_in_specialization=6),
                    dict(specialization="migration_planning", proficiency_level="expert", years_in_specialization=7),
                    dict(specialization="cryptographic_audit", proficiency_level="expert", years_in_specialization=10),
                    dict(specialization="lattice_cryptography", proficiency_level="leading_researcher", years_in_specialization=8),
                ],
                sector_experience=[
                    dict(sector="financial", years_experience_in_sector=8,
                         compliance_standards_known=["PCI-DSS", "SOX", "GLBA", "FFIEC"],
                         anonymized_client_examples="Conducted cryptographic audits for two regional banks and one national payment processor. Delivered migration roadmaps covering core banking systems and ATM networks."),
                    dict(sector="government", years_experience_in_sector=5,
                         compliance_standards_known=["FISMA", "FedRAMP", "NIST SP 800-207"],
                         anonymized_client_examples="Advised a state-level agency on post-quantum migration readiness and participated in the NIST PQC standardization review process."),
                ],
                engagement_types=[
                    dict(engagement_type="cryptographic_audit", typical_duration_weeks_min=6, typical_duration_weeks_max=10,
                         typical_budget_min=40000.00, typical_budget_max=90000.00,
                         approach_description="I begin with a full cryptographic asset inventory -- algorithms, key lengths, certificate lifecycles, and protocol versions -- then map each asset to its quantum vulnerability using Shor's and Grover's threat models."),
                    dict(engagement_type="migration_roadmap", typical_duration_weeks_min=8, typical_duration_weeks_max=16,
                         typical_budget_min=60000.00, typical_budget_max=150000.00,
                         approach_description="Roadmaps follow a phased approach: assess, prioritize, pilot, and scale. I work closely with engineering teams to ensure NIST FIPS 203/204/205 standards are correctly implemented for your specific infrastructure."),
                    dict(engagement_type="executive_briefing", typical_duration_weeks_min=1, typical_duration_weeks_max=2,
                         typical_budget_min=5000.00, typical_budget_max=15000.00,
                         approach_description="A 2-day engagement to bring your board and C-suite up to speed on quantum threats, regulatory timelines, and your specific risk exposure. Includes a one-page risk summary for board presentation."),
                ],
            ),
            dict(
                email="m.okafor@pqshield.dev", first_name="Marcus", last_name="Okafor",
                headline="Quantum-Safe Network Architect",
                bio="Marcus designs quantum-safe network architectures for enterprises migrating away from classical key exchange, with a focus on VPN, TLS termination, and site-to-site tunnels.",
                years_of_experience=10, linkedin_url="https://linkedin.com/in/marcus-okafor-pqc",
                hourly_rate_min=200.00, hourly_rate_max=300.00,
                availability_status="unavailable", avg_response_time_hours=12,
                preferred_engagement_length="long_term", is_verified=True, verification_status="verified",
                avg_rating=4.6, total_completed_engagements=9,
                credentials=[
                    dict(credential_type="certification", credential_name="CCSP", institution="ISC2", year_obtained=2016),
                ],
                specializations=[
                    dict(specialization="quantum_key_distribution", proficiency_level="expert", years_in_specialization=6),
                    dict(specialization="network_security", proficiency_level="leading_researcher", years_in_specialization=12),
                ],
                sector_experience=[
                    dict(sector="financial", years_experience_in_sector=6, compliance_standards_known=["PCI-DSS"],
                         anonymized_client_examples="Redesigned site-to-site VPN architecture for a multi-branch credit union around hybrid key exchange."),
                    dict(sector="energy", years_experience_in_sector=4, compliance_standards_known=["NERC CIP"],
                         anonymized_client_examples="Assessed SCADA network segmentation and remote-access tunnels for a regional utility."),
                ],
                engagement_types=[
                    dict(engagement_type="migration_roadmap", typical_duration_weeks_min=10, typical_duration_weeks_max=20,
                         typical_budget_min=50000.00, typical_budget_max=120000.00,
                         approach_description="Network-first migration planning: inventory every TLS/VPN endpoint, then sequence hybrid key-exchange rollout by exposure."),
                    dict(engagement_type="staff_training", typical_duration_weeks_min=1, typical_duration_weeks_max=2,
                         typical_budget_min=8000.00, typical_budget_max=20000.00,
                         approach_description="Hands-on workshops for network engineering teams on configuring hybrid PQC key exchange on existing appliances."),
                ],
            ),
            dict(
                email="e.vasquez@quantumrisk.io", first_name="Elena", last_name="Vasquez",
                headline="Quantum Risk Assessment Lead | Healthcare & Life Sciences",
                bio="Dr. Vasquez leads quantum-readiness risk assessments for healthcare systems, translating cryptographic exposure into board-level risk language and HIPAA-aligned remediation plans.",
                years_of_experience=12, linkedin_url="https://linkedin.com/in/elena-vasquez-risk",
                hourly_rate_min=300.00, hourly_rate_max=450.00,
                availability_status="limited", avg_response_time_hours=8,
                preferred_engagement_length="short_term", is_verified=True, verification_status="verified",
                avg_rating=4.8, total_completed_engagements=17,
                credentials=[
                    dict(credential_type="degree", credential_name="PhD in Computer Science", institution="Stanford University", year_obtained=2013),
                    dict(credential_type="certification", credential_name="HCISPP", institution="ISC2", year_obtained=2018),
                ],
                specializations=[
                    dict(specialization="quantum_risk_assessment", proficiency_level="leading_researcher", years_in_specialization=8),
                    dict(specialization="hsm_architecture", proficiency_level="expert", years_in_specialization=5),
                ],
                sector_experience=[
                    dict(sector="healthcare", years_experience_in_sector=9,
                         compliance_standards_known=["HIPAA", "HITECH", "HITRUST"],
                         anonymized_client_examples="Delivered quantum-readiness risk assessments for a multi-state hospital network and a clinical-trials data platform."),
                    dict(sector="financial", years_experience_in_sector=3, compliance_standards_known=["GLBA"],
                         anonymized_client_examples="Assessed cryptographic risk for a health-insurance claims processor."),
                ],
                engagement_types=[
                    dict(engagement_type="risk_assessment", typical_duration_weeks_min=4, typical_duration_weeks_max=8,
                         typical_budget_min=35000.00, typical_budget_max=80000.00,
                         approach_description="Structured HNDL exposure scoring across EHR, imaging, and billing systems, delivered as a board-ready risk register."),
                    dict(engagement_type="compliance_review", typical_duration_weeks_min=3, typical_duration_weeks_max=6,
                         typical_budget_min=25000.00, typical_budget_max=60000.00,
                         approach_description="Gap analysis against HIPAA Security Rule expectations for cryptographic controls, with a remediation timeline."),
                ],
            ),
            dict(
                email="j.whitfield@govcrypto.us", first_name="James", last_name="Whitfield",
                headline="PQC Migration Engineer | Federal Systems",
                bio="James supports federal agencies through FIPS 203/204/205 migration planning, with deep experience navigating FedRAMP and FISMA constraints on legacy systems.",
                years_of_experience=7, linkedin_url="https://linkedin.com/in/james-whitfield-gov",
                hourly_rate_min=180.00, hourly_rate_max=260.00,
                availability_status="booking_future", avg_response_time_hours=24,
                preferred_engagement_length="long_term", is_verified=True, verification_status="verified",
                avg_rating=4.5, total_completed_engagements=6,
                credentials=[
                    dict(credential_type="certification", credential_name="Security+", institution="CompTIA", year_obtained=2018),
                ],
                specializations=[
                    dict(specialization="pqc_migration_planning", proficiency_level="expert", years_in_specialization=5),
                    dict(specialization="key_management", proficiency_level="proficient", years_in_specialization=4),
                ],
                sector_experience=[
                    dict(sector="government", years_experience_in_sector=7,
                         compliance_standards_known=["FedRAMP", "FISMA"],
                         anonymized_client_examples="Built a phased PQC migration plan for a federal agency's identity-management platform."),
                ],
                engagement_types=[
                    dict(engagement_type="migration_roadmap", typical_duration_weeks_min=12, typical_duration_weeks_max=24,
                         typical_budget_min=70000.00, typical_budget_max=180000.00,
                         approach_description="Aligns migration sequencing with FedRAMP authorization boundaries to avoid re-authorization delays."),
                    dict(engagement_type="full_migration_support", typical_duration_weeks_min=20, typical_duration_weeks_max=40,
                         typical_budget_min=150000.00, typical_budget_max=400000.00,
                         approach_description="End-to-end migration execution support, from pilot to agency-wide rollout."),
                ],
            ),
            dict(
                email="a.bello@auditpqc.com", first_name="Aisha", last_name="Bello",
                headline="Cryptographic Auditor | Financial & Legal Sectors",
                bio="Aisha performs cryptographic audits and compliance reviews for financial firms and law firms managing long-lived, sensitive client records.",
                years_of_experience=5, linkedin_url="https://linkedin.com/in/aisha-bello-audit",
                hourly_rate_min=150.00, hourly_rate_max=220.00,
                availability_status="available", avg_response_time_hours=6,
                preferred_engagement_length="short_term", is_verified=True, verification_status="verified",
                avg_rating=4.7, total_completed_engagements=8,
                credentials=[
                    dict(credential_type="certification", credential_name="CISA", institution="ISACA", year_obtained=2020),
                ],
                specializations=[
                    dict(specialization="cryptographic_audit", proficiency_level="proficient", years_in_specialization=4),
                    dict(specialization="compliance_review", proficiency_level="expert", years_in_specialization=5),
                ],
                sector_experience=[
                    dict(sector="financial", years_experience_in_sector=5, compliance_standards_known=["PCI-DSS", "SOX"],
                         anonymized_client_examples="Audited cryptographic controls for a mid-size regional lender."),
                    dict(sector="legal", years_experience_in_sector=2, compliance_standards_known=[],
                         anonymized_client_examples="Reviewed document-encryption practices for a corporate law firm's client archive."),
                ],
                engagement_types=[
                    dict(engagement_type="cryptographic_audit", typical_duration_weeks_min=3, typical_duration_weeks_max=6,
                         typical_budget_min=20000.00, typical_budget_max=45000.00,
                         approach_description="Fast-turnaround audits focused on client-facing systems and third-party vendor cryptographic guarantees."),
                    dict(engagement_type="compliance_review", typical_duration_weeks_min=2, typical_duration_weeks_max=4,
                         typical_budget_min=15000.00, typical_budget_max=30000.00,
                         approach_description="Maps existing controls against relevant compliance frameworks and flags cryptographic gaps."),
                ],
            ),
            dict(
                email="t.novak@keyarch.eu", first_name="Tomas", last_name="Novak",
                headline="HSM & Key Management Architect",
                bio="Tomas architects hardware security module and key-management solutions for critical infrastructure operators preparing for post-quantum key encapsulation.",
                years_of_experience=11, linkedin_url="https://linkedin.com/in/tomas-novak-hsm",
                hourly_rate_min=240.00, hourly_rate_max=340.00,
                availability_status="available", avg_response_time_hours=6,
                preferred_engagement_length="both", is_verified=True, verification_status="verified",
                avg_rating=4.85, total_completed_engagements=14,
                credentials=[
                    dict(credential_type="certification", credential_name="CISSP", institution="ISC2", year_obtained=2014),
                    dict(credential_type="degree", credential_name="MS in Electrical Engineering", institution="ETH Zurich", year_obtained=2011),
                ],
                specializations=[
                    dict(specialization="hsm_architecture", proficiency_level="leading_researcher", years_in_specialization=9),
                    dict(specialization="key_management", proficiency_level="expert", years_in_specialization=9),
                ],
                sector_experience=[
                    dict(sector="energy", years_experience_in_sector=8, compliance_standards_known=["NERC CIP"],
                         anonymized_client_examples="Replaced legacy HSM firmware for a regional grid operator's key-signing infrastructure."),
                    dict(sector="government", years_experience_in_sector=3, compliance_standards_known=["FIPS 140-3"],
                         anonymized_client_examples="Advised on FIPS 140-3 validated HSM procurement for a national lab."),
                ],
                engagement_types=[
                    dict(engagement_type="migration_roadmap", typical_duration_weeks_min=10, typical_duration_weeks_max=18,
                         typical_budget_min=80000.00, typical_budget_max=200000.00,
                         approach_description="Key-management-first migration: re-architects HSM firmware and key hierarchies before touching application-layer crypto."),
                    dict(engagement_type="ongoing_advisory", typical_duration_weeks_min=4, typical_duration_weeks_max=52,
                         typical_budget_min=10000.00, typical_budget_max=120000.00,
                         approach_description="Retainer-based advisory for teams rolling out PQC key encapsulation incrementally."),
                ],
            ),
            dict(
                email="g.lindqvist@quantumtrain.org", first_name="Grace", last_name="Lindqvist",
                headline="Quantum Security Trainer & Awareness Educator",
                bio="Grace builds and delivers quantum-security awareness training for nonprofits and educational institutions with limited security budgets.",
                years_of_experience=3, linkedin_url="https://linkedin.com/in/grace-lindqvist",
                hourly_rate_min=90.00, hourly_rate_max=150.00,
                availability_status="available", avg_response_time_hours=10,
                preferred_engagement_length="short_term", is_verified=False, verification_status="pending",
                avg_rating=None, total_completed_engagements=0,
                specializations=[
                    dict(specialization="staff_training", proficiency_level="proficient", years_in_specialization=3),
                    dict(specialization="post_quantum_cryptography", proficiency_level="familiar", years_in_specialization=2),
                ],
                sector_experience=[
                    dict(sector="education", years_experience_in_sector=3, compliance_standards_known=[],
                         anonymized_client_examples="Delivered quantum-threat awareness sessions for a university IT department."),
                    dict(sector="nonprofit", years_experience_in_sector=2, compliance_standards_known=[],
                         anonymized_client_examples="Ran staff training for a nonprofit's small IT team on encryption fundamentals."),
                ],
                engagement_types=[
                    dict(engagement_type="staff_training", typical_duration_weeks_min=1, typical_duration_weeks_max=2,
                         typical_budget_min=3000.00, typical_budget_max=8000.00,
                         approach_description="Plain-language workshops covering quantum threat timelines and what staff should watch for."),
                    dict(engagement_type="executive_briefing", typical_duration_weeks_min=1, typical_duration_weeks_max=1,
                         typical_budget_min=2000.00, typical_budget_max=5000.00,
                         approach_description="Short leadership briefing on quantum risk framed for non-technical boards."),
                ],
            ),
            dict(
                email="r.patel@latticeresearch.ac", first_name="Raj", last_name="Patel",
                headline="Lattice Cryptography Researcher | Financial Market Infrastructure",
                bio="Dr. Patel is a mathematician specializing in lattice-based cryptography, with two decades of combined academic and applied research advising exchanges and clearinghouses on post-quantum migration.",
                years_of_experience=18, linkedin_url="https://linkedin.com/in/raj-patel-lattice",
                hourly_rate_min=400.00, hourly_rate_max=600.00,
                availability_status="limited", avg_response_time_hours=8,
                preferred_engagement_length="long_term", is_verified=True, verification_status="verified",
                avg_rating=4.95, total_completed_engagements=19,
                credentials=[
                    dict(credential_type="degree", credential_name="PhD in Mathematics", institution="University of Cambridge", year_obtained=2008),
                    dict(credential_type="publication", credential_name="Practical Lattice Reduction for Post-Quantum Key Exchange", institution="ACM CCS", year_obtained=2020),
                    dict(credential_type="publication", credential_name="Hybrid Key Establishment in Market Infrastructure", institution="IEEE S&P", year_obtained=2023),
                ],
                specializations=[
                    dict(specialization="lattice_cryptography", proficiency_level="leading_researcher", years_in_specialization=14),
                    dict(specialization="post_quantum_cryptography", proficiency_level="leading_researcher", years_in_specialization=12),
                ],
                sector_experience=[
                    dict(sector="financial", years_experience_in_sector=10,
                         compliance_standards_known=["SWIFT CSP", "PCI-DSS"],
                         anonymized_client_examples="Advised a national stock exchange on hybrid key-establishment for settlement systems."),
                ],
                engagement_types=[
                    dict(engagement_type="cryptographic_audit", typical_duration_weeks_min=8, typical_duration_weeks_max=14,
                         typical_budget_min=100000.00, typical_budget_max=220000.00,
                         approach_description="Deep cryptanalysis-informed audits of key-exchange and signing protocols in trading infrastructure."),
                    dict(engagement_type="ongoing_advisory", typical_duration_weeks_min=4, typical_duration_weeks_max=52,
                         typical_budget_min=20000.00, typical_budget_max=250000.00,
                         approach_description="Standing research-informed advisory relationship for institutions tracking evolving lattice-cryptanalysis results."),
                ],
            ),
            dict(
                email="n.kowalski@readycompliance.health", first_name="Nadia", last_name="Kowalski",
                headline="Compliance & PQC Readiness Advisor | Healthcare",
                bio="Nadia advises hospital systems and health plans on aligning post-quantum readiness programs with HIPAA and HITRUST compliance timelines.",
                years_of_experience=8, linkedin_url="https://linkedin.com/in/nadia-kowalski",
                hourly_rate_min=200.00, hourly_rate_max=280.00,
                availability_status="available", avg_response_time_hours=6,
                preferred_engagement_length="both", is_verified=True, verification_status="verified",
                avg_rating=4.6, total_completed_engagements=10,
                credentials=[
                    dict(credential_type="certification", credential_name="CHPS", institution="AHIMA", year_obtained=2019),
                    dict(credential_type="certification", credential_name="CRISC", institution="ISACA", year_obtained=2021),
                ],
                specializations=[
                    dict(specialization="compliance_review", proficiency_level="expert", years_in_specialization=6),
                    dict(specialization="quantum_risk_assessment", proficiency_level="proficient", years_in_specialization=4),
                ],
                sector_experience=[
                    dict(sector="healthcare", years_experience_in_sector=8,
                         compliance_standards_known=["HIPAA", "HITRUST"],
                         anonymized_client_examples="Ran compliance-aligned readiness reviews for a regional health-plan operator."),
                ],
                engagement_types=[
                    dict(engagement_type="risk_assessment", typical_duration_weeks_min=4, typical_duration_weeks_max=8,
                         typical_budget_min=30000.00, typical_budget_max=70000.00,
                         approach_description="Combines technical exposure scoring with a HIPAA/HITRUST-aligned compliance gap matrix."),
                    dict(engagement_type="compliance_review", typical_duration_weeks_min=3, typical_duration_weeks_max=5,
                         typical_budget_min=20000.00, typical_budget_max=45000.00,
                         approach_description="Focused review of cryptographic controls against HITRUST CSF requirements."),
                    dict(engagement_type="executive_briefing", typical_duration_weeks_min=1, typical_duration_weeks_max=1,
                         typical_budget_min=4000.00, typical_budget_max=10000.00,
                         approach_description="Board-level briefing connecting quantum risk to existing compliance obligations."),
                ],
            ),
            dict(
                email="d.osei@earlycareerpqc.dev", first_name="Derek", last_name="Osei",
                headline="Junior Post-Quantum Cryptography Consultant",
                bio="Derek is an early-career consultant building a practice in post-quantum readiness for small and mid-size financial firms.",
                years_of_experience=2, linkedin_url="https://linkedin.com/in/derek-osei",
                hourly_rate_min=90.00, hourly_rate_max=130.00,
                availability_status="available", avg_response_time_hours=12,
                preferred_engagement_length="short_term", is_verified=False, verification_status="unsubmitted",
                avg_rating=None, total_completed_engagements=0,
                specializations=[
                    dict(specialization="post_quantum_cryptography", proficiency_level="familiar", years_in_specialization=2),
                ],
                sector_experience=[
                    dict(sector="financial", years_experience_in_sector=2, compliance_standards_known=["PCI-DSS"],
                         anonymized_client_examples="Supported a senior consultant on a small credit union's cryptographic inventory project."),
                ],
                engagement_types=[
                    dict(engagement_type="staff_training", typical_duration_weeks_min=1, typical_duration_weeks_max=1,
                         typical_budget_min=2000.00, typical_budget_max=5000.00,
                         approach_description="Entry-level training sessions on quantum threat basics for small IT teams."),
                ],
            ),
            dict(
                email="s.osman@resilientinfra.io", first_name="Samira", last_name="Osman",
                headline="Critical Infrastructure Migration Strategist",
                bio="Samira helps energy and utility operators sequence post-quantum migrations across SCADA, billing, and grid-control systems without disrupting operations.",
                years_of_experience=13, linkedin_url="https://linkedin.com/in/samira-osman",
                hourly_rate_min=260.00, hourly_rate_max=380.00,
                availability_status="limited", avg_response_time_hours=10,
                preferred_engagement_length="long_term", is_verified=True, verification_status="verified",
                avg_rating=4.75, total_completed_engagements=12,
                credentials=[
                    dict(credential_type="certification", credential_name="GICSP", institution="GIAC", year_obtained=2017),
                ],
                specializations=[
                    dict(specialization="migration_planning", proficiency_level="expert", years_in_specialization=7),
                    dict(specialization="hsm_architecture", proficiency_level="proficient", years_in_specialization=5),
                ],
                sector_experience=[
                    dict(sector="energy", years_experience_in_sector=10,
                         compliance_standards_known=["NERC CIP"],
                         anonymized_client_examples="Sequenced a multi-year PQC migration for a regional grid operator's control-system network."),
                ],
                engagement_types=[
                    dict(engagement_type="migration_roadmap", typical_duration_weeks_min=16, typical_duration_weeks_max=30,
                         typical_budget_min=90000.00, typical_budget_max=250000.00,
                         approach_description="Operations-safe migration sequencing that avoids touching live SCADA control loops during rollout windows."),
                    dict(engagement_type="full_migration_support", typical_duration_weeks_min=30, typical_duration_weeks_max=60,
                         typical_budget_min=200000.00, typical_budget_max=600000.00,
                         approach_description="Long-horizon execution partner across the full migration lifecycle for critical infrastructure operators."),
                ],
            ),
        ]

        expert_users = []
        expert_profiles_by_email = {}
        for expert in EXPERTS:
            expert_user = await conn.fetchrow("""
                INSERT INTO users (email, password_hash, role, is_email_verified)
                VALUES ($1, $2, 'expert', true) RETURNING user_id, email
            """, expert["email"], pw)

            expert_profile = await conn.fetchrow("""
                INSERT INTO expert_profiles (
                    user_id, first_name, last_name, headline, bio,
                    years_of_experience, linkedin_url,
                    hourly_rate_min, hourly_rate_max,
                    availability_status, avg_response_time_hours,
                    preferred_engagement_length, is_verified, verification_status,
                    avg_rating, total_completed_engagements
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                RETURNING expert_profile_id
            """,
                expert_user["user_id"], expert["first_name"], expert["last_name"],
                expert["headline"], expert["bio"], expert["years_of_experience"],
                expert["linkedin_url"], expert["hourly_rate_min"], expert["hourly_rate_max"],
                expert["availability_status"], expert["avg_response_time_hours"],
                expert["preferred_engagement_length"], expert["is_verified"],
                expert["verification_status"], expert["avg_rating"],
                expert["total_completed_engagements"],
            )
            expert_id = expert_profile["expert_profile_id"]

            for cred in expert.get("credentials", []):
                await conn.execute("""
                    INSERT INTO expert_credentials (
                        expert_id, credential_type, credential_name, institution, year_obtained
                    ) VALUES ($1, $2, $3, $4, $5)
                """, expert_id, cred["credential_type"], cred["credential_name"],
                    cred.get("institution"), cred.get("year_obtained"))

            for job in expert.get("work_history", []):
                await conn.execute("""
                    INSERT INTO expert_work_history (
                        expert_id, organization_name, job_title, employment_type,
                        start_date, end_date, is_current, description, order_index
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, expert_id, job["organization_name"], job["job_title"],
                    job.get("employment_type"), job["start_date"], job.get("end_date"),
                    job.get("is_current", False), job.get("description"), job.get("order_index"))

            for spec in expert.get("specializations", []):
                await conn.execute("""
                    INSERT INTO expert_specializations (
                        expert_id, specialization, proficiency_level, years_in_specialization
                    ) VALUES ($1, $2, $3, $4)
                """, expert_id, spec["specialization"], spec["proficiency_level"],
                    spec.get("years_in_specialization"))

            for sector_exp in expert.get("sector_experience", []):
                await conn.execute("""
                    INSERT INTO expert_sector_experience (
                        expert_id, sector, years_experience_in_sector,
                        compliance_standards_known, anonymized_client_examples
                    ) VALUES ($1, $2, $3, $4, $5)
                """, expert_id, sector_exp["sector"], sector_exp.get("years_experience_in_sector"),
                    sector_exp.get("compliance_standards_known"), sector_exp.get("anonymized_client_examples"))

            for eng_type in expert.get("engagement_types", []):
                await conn.execute("""
                    INSERT INTO expert_engagement_types (
                        expert_id, engagement_type,
                        typical_duration_weeks_min, typical_duration_weeks_max,
                        typical_budget_min, typical_budget_max, approach_description
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                """, expert_id, eng_type["engagement_type"],
                    eng_type.get("typical_duration_weeks_min"), eng_type.get("typical_duration_weeks_max"),
                    eng_type.get("typical_budget_min"), eng_type.get("typical_budget_max"),
                    eng_type.get("approach_description"))

            expert_users.append(expert_user)
            expert_profiles_by_email[expert["email"]] = expert_id

        # -- ENGAGEMENTS (no more than 5; no chat/messages) --------------------
        # Looked up by email against the org/expert records created above, so
        # each engagement is wired to a real user_id + profile_id pair.
        org_users_by_email = {u["email"]: u["user_id"] for u in org_users}
        expert_users_by_email = {u["email"]: u["user_id"] for u in expert_users}

        today = date.today()
        now = datetime.now()

        ENGAGEMENTS = [
            dict(
                org_email="cto@firstcommunitybankny.com", expert_email="dr.chen@quantumsec.io",
                engagement_type="cryptographic_audit",
                initial_message="Hello Dr. Chen, we are a community bank with a 22-year-old core banking system relying heavily on RSA-2048. We are concerned about harvest-now-decrypt-later attacks on our mortgage records and would love to discuss a cryptographic audit.",
                org_stated_timeline="within_3mo", match_score=95.00,
                responded_at_days_ago=14,
                title="Cryptographic Audit -- First Community Bank of NY",
                description="Full cryptographic asset audit covering core banking, ATM network, and customer-facing web infrastructure. Focus on RSA-2048 exposure and HNDL risk for long-lived mortgage records.",
                status="active", agreed_budget=75000.00, payment_structure="milestone_based",
                start_date_days_ago=10, estimated_end_weeks=8,
                milestones=[
                    dict(role="expert", title="Kickoff & Scoping",
                         description="Scope alignment, documentation gathering, secure channel setup.",
                         order_index=1, due_in_weeks=2, deliverable_description="Signed scope-of-work document",
                         status="completed", confirmed_days_ago=9, completed_days_ago=5, requires_client_approval=True),
                    dict(role="expert", title="Cryptographic Asset Inventory",
                         description="Full enumeration of all cryptographic assets across all systems.",
                         order_index=2, due_in_weeks=4, deliverable_description="Cryptographic asset register",
                         status="in_progress", confirmed_days_ago=9, requires_client_approval=True),
                    dict(role="expert", title="Vulnerability Mapping",
                         description="Map each asset to Shor/Grover threat models. Identify HNDL exposure.",
                         order_index=3, due_in_weeks=6, deliverable_description="Vulnerability mapping report",
                         status="confirmed", confirmed_days_ago=9),
                    dict(role="expert", title="Compliance Gap Analysis",
                         description="Gap analysis against FFIEC and NIST post-quantum guidance.",
                         order_index=4, due_in_weeks=7, deliverable_description="Compliance gap matrix",
                         status="confirmed", confirmed_days_ago=9),
                    dict(role="expert", title="Final Report & Presentation",
                         description="Delivery of full assessment report and executive presentation.",
                         order_index=5, due_in_weeks=8, deliverable_description="Full assessment report PDF, executive deck",
                         status="confirmed", confirmed_days_ago=9, requires_client_approval=True),
                ],
            ),
            dict(
                org_email="cto@firstcommunitybankny.com", expert_email="r.patel@latticeresearch.ac",
                engagement_type="migration_roadmap",
                initial_message="Dr. Patel, following our cryptographic audit we would like to engage you to build out a phased migration roadmap for our core banking and mortgage archive systems.",
                org_stated_timeline="within_year", match_score=91.00,
                responded_at_days_ago=120,
                title="Post-Quantum Migration Roadmap -- First Community Bank of NY",
                description="Phased migration roadmap covering hybrid key exchange for core banking TLS and re-encryption planning for the mortgage archive.",
                status="completed", agreed_budget=140000.00, payment_structure="milestone_based",
                start_date_days_ago=110, estimated_end_weeks=16, actual_end_days_ago=5,
                milestones=[
                    dict(role="expert", title="Current-State Cryptographic Inventory",
                         description="Catalog all cryptographic assets and dependencies in scope for migration.",
                         order_index=1, due_in_weeks=3, deliverable_description="Inventory spreadsheet",
                         status="completed", confirmed_days_ago=108, completed_days_ago=95),
                    dict(role="expert", title="Phased Migration Plan Draft",
                         description="Draft phased plan sequencing hybrid key exchange rollout.",
                         order_index=2, due_in_weeks=8, deliverable_description="Draft migration plan",
                         status="completed", confirmed_days_ago=108, completed_days_ago=60, requires_client_approval=True),
                    dict(role="expert", title="Stakeholder Review & Sign-off",
                         description="Present plan to leadership and incorporate feedback.",
                         order_index=3, due_in_weeks=12, deliverable_description="Signed-off migration plan",
                         status="completed", confirmed_days_ago=108, completed_days_ago=30, requires_client_approval=True),
                    dict(role="expert", title="Final Roadmap Delivery",
                         description="Deliver final roadmap document and implementation timeline.",
                         order_index=4, due_in_weeks=16, deliverable_description="Final roadmap PDF",
                         status="completed", confirmed_days_ago=108, completed_days_ago=5),
                ],
            ),
            dict(
                org_email="cto@firstcommunitybankny.com", expert_email="a.bello@auditpqc.com",
                engagement_type="executive_briefing",
                initial_message="Aisha, our board would like a briefing on quantum risk before approving next year's security budget. Are you available to help us prepare?",
                org_stated_timeline="asap", match_score=82.00,
                responded_at_days_ago=1,
                title="Board Briefing on Quantum Risk -- First Community Bank of NY",
                description="Prepare and deliver a board-level briefing on quantum threat timelines and the bank's specific risk exposure.",
                status="scoping", agreed_budget=None, payment_structure=None,
                start_date_days_ago=None, estimated_end_weeks=None,
                milestones=[
                    dict(role="organization", title="Board Briefing Prep",
                         description="Gather board's existing knowledge level and prior audit findings to tailor the briefing.",
                         order_index=1, due_in_weeks=1, deliverable_description="Briefing outline",
                         status="proposed"),
                    dict(role="organization", title="Board Presentation",
                         description="Deliver the briefing to the board.",
                         order_index=2, due_in_weeks=2, deliverable_description="Presentation deck",
                         status="proposed", requires_client_approval=True),
                ],
            ),
            dict(
                org_email="ciso@medicore-health.com", expert_email="e.vasquez@quantumrisk.io",
                engagement_type="risk_assessment",
                initial_message="Dr. Vasquez, we operate 12 hospitals and need a quantum-readiness risk assessment across our EHR and imaging systems. Can we discuss scope and timeline?",
                org_stated_timeline="within_6mo", match_score=93.00,
                responded_at_days_ago=45,
                title="Quantum Readiness Risk Assessment -- MediCore Health Systems",
                description="Risk assessment of EHR, medical imaging, and insurance billing systems for quantum exposure, aligned to HIPAA and HITRUST expectations.",
                status="on_hold", agreed_budget=60000.00, payment_structure="fixed_price",
                start_date_days_ago=40, estimated_end_weeks=10,
                milestones=[
                    dict(role="expert", title="Documentation & Interviews",
                         description="Review system documentation and interview infrastructure owners.",
                         order_index=1, due_in_weeks=3, deliverable_description="Interview notes and system list",
                         status="completed", confirmed_days_ago=38, completed_days_ago=20),
                    dict(role="expert", title="Preliminary Risk Scoring",
                         description="Score cryptographic exposure per system against HNDL risk.",
                         order_index=2, due_in_weeks=6, deliverable_description="Preliminary risk scorecard",
                         status="in_progress", confirmed_days_ago=38),
                    dict(role="expert", title="Final Risk Register",
                         description="Deliver final risk register, on hold pending budget approval for continued work.",
                         order_index=3, due_in_weeks=10, deliverable_description="Final risk register",
                         status="blocked", requires_client_approval=True),
                ],
            ),
            dict(
                org_email="ciso@medicore-health.com", expert_email="n.kowalski@readycompliance.health",
                engagement_type="compliance_review",
                initial_message="Nadia, we'd like a focused compliance review of our cryptographic controls against HITRUST before our next audit cycle.",
                org_stated_timeline="within_3mo", match_score=88.00,
                responded_at_days_ago=60,
                title="HITRUST Compliance Review -- MediCore Health Systems",
                description="Review cryptographic controls against HITRUST CSF requirements and flag gaps ahead of the upcoming audit cycle.",
                status="cancelled", agreed_budget=None, payment_structure="fixed_price",
                start_date_days_ago=55, estimated_end_weeks=5,
                cancellation_reason="Engagement paused after internal reorg shifted the compliance audit timeline by two quarters.",
                milestones=[
                    dict(role="expert", title="Compliance Gap Scoping",
                         description="Initial scoping of cryptographic controls against HITRUST CSF domains.",
                         order_index=1, due_in_weeks=2, deliverable_description="Scoping memo",
                         status="completed", confirmed_days_ago=53, completed_days_ago=48),
                    dict(role="expert", title="Full HITRUST Mapping",
                         description="Full mapping of controls to HITRUST CSF requirements.",
                         order_index=2, due_in_weeks=5, deliverable_description="Compliance gap matrix",
                         status="skipped", confirmed_days_ago=53),
                ],
            ),
        ]

        for eng in ENGAGEMENTS:
            org_id = org_profiles_by_email[eng["org_email"]]
            expert_id = expert_profiles_by_email[eng["expert_email"]]
            org_user_id = org_users_by_email[eng["org_email"]]
            expert_user_id = expert_users_by_email[eng["expert_email"]]

            responded_at = now - timedelta(days=eng["responded_at_days_ago"])
            expires_at = now + timedelta(days=30)

            connection = await conn.fetchrow("""
                INSERT INTO connection_requests (
                    org_id, expert_id, initiated_by_user_id,
                    status, initial_message, org_stated_need, org_stated_timeline,
                    match_score, expires_at, responded_at
                ) VALUES ($1, $2, $3, 'accepted', $4, $5, $6, $7, $8, $9)
                RETURNING connection_id
            """,
                org_id, expert_id, org_user_id, eng["initial_message"], eng["engagement_type"],
                eng["org_stated_timeline"], eng["match_score"], expires_at, responded_at,
            )

            start_date = today - timedelta(days=eng["start_date_days_ago"]) if eng.get("start_date_days_ago") is not None else None
            estimated_end_date = start_date + timedelta(weeks=eng["estimated_end_weeks"]) if start_date and eng.get("estimated_end_weeks") else None
            actual_end_date = today - timedelta(days=eng["actual_end_days_ago"]) if eng.get("actual_end_days_ago") is not None else None

            engagement = await conn.fetchrow("""
                INSERT INTO engagements (
                    connection_id, org_id, expert_id, engagement_type,
                    title, description, status,
                    agreed_budget, payment_structure, start_date, estimated_end_date,
                    actual_end_date, cancellation_reason
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                RETURNING engagement_id
            """,
                connection["connection_id"], org_id, expert_id, eng["engagement_type"],
                eng["title"], eng["description"], eng["status"],
                eng["agreed_budget"], eng["payment_structure"], start_date, estimated_end_date,
                actual_end_date, eng.get("cancellation_reason"),
            )

            for m in eng["milestones"]:
                proposed_by_user_id = org_user_id if m["role"] == "organization" else expert_user_id
                due_date = today + timedelta(weeks=m["due_in_weeks"]) if m.get("due_in_weeks") is not None else None
                confirmed_at = now - timedelta(days=m["confirmed_days_ago"]) if m.get("confirmed_days_ago") is not None else None
                completed_at = now - timedelta(days=m["completed_days_ago"]) if m.get("completed_days_ago") is not None else None
                confirmed_by_expert_id = expert_id if confirmed_at is not None else None

                await conn.execute("""
                    INSERT INTO engagement_milestones (
                        engagement_id, proposed_by_user_id, proposed_by_role,
                        title, description, order_index, due_date,
                        deliverable_description, status,
                        confirmed_by_expert_id, confirmed_at,
                        requires_client_approval, completed_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                """,
                    engagement["engagement_id"], proposed_by_user_id, m["role"],
                    m["title"], m.get("description"), m["order_index"], due_date,
                    m.get("deliverable_description"), m["status"],
                    confirmed_by_expert_id, confirmed_at,
                    m.get("requires_client_approval", False), completed_at,
                )

        return {
            "admin": admin,
            "org_users": org_users,
            "engagement_count": len(ENGAGEMENTS),
            "expert_users": expert_users,
        }


# -- ENTRY POINT ---------------------------------------------------------------
if __name__ == "__main__":
    async def main():
        try:
            result = await seed()
            print("\nDatabase seeded successfully.")
            print(f"  Admin:   {result['admin']['email']}  (password: password123)")
            print(f"  Orgs ({len(result['org_users'])}):")
            for u in result["org_users"]:
                print(f"    - {u['email']}")
            print(f"  Experts ({len(result['expert_users'])}):")
            for u in result["expert_users"]:
                print(f"    - {u['email']}")
            print(f"  Engagements seeded: {result['engagement_count']} (no messages/chat threads)")
            print("\n  All non-admin accounts share password: password123")
        except Exception as e:
            print(f"\nError seeding database: {e}")
            raise
        finally:
            await close_pool()

    asyncio.run(main())
