# QuantumConnect — Database Schema

## 1. Identity & Auth

```
users
─────────────────────────────────────────────────────
user_id                SERIAL PRIMARY KEY
email                  TEXT UNIQUE NOT NULL
password_hash          TEXT NOT NULL
role                   TEXT NOT NULL -- 'organization' | 'expert' | 'admin'
is_email_verified      BOOLEAN DEFAULT false
is_active              BOOLEAN DEFAULT true
last_login_at          TIMESTAMP
created_at             TIMESTAMP DEFAULT NOW()
updated_at             TIMESTAMP DEFAULT NOW()

organization_profiles
─────────────────────────────────────────────────────
org_profile_id                  SERIAL PRIMARY KEY
user_id                         INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
org_name                        TEXT NOT NULL
contact_name                    TEXT -- primary point of contact for this account
contact_title                   TEXT -- e.g. 'Head of Security', 'CISO'
sector                          TEXT NOT NULL -- 'financial' | 'healthcare' | 'government' |
                                 -- 'nonprofit' | 'legal' | 'energy' | 'education' | 'other'
sub_sector                      TEXT
founded_year                    INTEGER
employee_count_range            TEXT -- '<50' | '50-250' | '250-1k' | '1k-10k' | '>10k'
country                         TEXT
state_province                  TEXT
website                         TEXT
org_description                 TEXT
quantum_knowledge_level         TEXT -- 'none' | 'basic' | 'intermediate' | 'advanced'
budget_range                    TEXT -- 'under_10k' | '10k_50k' | '50k_250k' | '250k_plus' | 'undisclosed'
urgency_level                   TEXT -- 'just_exploring' | 'planning_ahead' | 'urgent' | 'critical'
default_connection_expiry_days  INTEGER DEFAULT 30
is_verified                     BOOLEAN DEFAULT false
created_at                      TIMESTAMP DEFAULT NOW()
updated_at                      TIMESTAMP DEFAULT NOW()

expert_profiles
─────────────────────────────────────────────────────
expert_profile_id            SERIAL PRIMARY KEY
user_id                      INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
first_name                   TEXT NOT NULL
last_name                    TEXT NOT NULL
headline                     TEXT
bio                          TEXT
profile_photo_url            TEXT
years_of_experience          INTEGER
linkedin_url                 TEXT
personal_website             TEXT
hourly_rate_min              NUMERIC(10,2)
hourly_rate_max              NUMERIC(10,2)
availability_status          TEXT -- 'available' | 'limited' | 'unavailable' | 'booking_future'
avg_response_time_hours      INTEGER
preferred_engagement_length  TEXT -- 'short_term' | 'long_term' | 'both'
is_verified                  BOOLEAN DEFAULT false
verification_status          TEXT -- 'unsubmitted' | 'pending' | 'verified' | 'rejected'
avg_rating                   NUMERIC(3,2) -- computed from reviews
total_completed_engagements  INTEGER DEFAULT 0
created_at                   TIMESTAMP DEFAULT NOW()
updated_at                   TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌───────────────────────┐
│        users          │
├───────────────────────┤
│ user_id (PK)           │◄────────────────────────────┐ 1:1
│ email                  │◄────────────────┐            │
│ password_hash          │                 │            │
│ role                   │                 │            │
└───────────────────────┘                 │            │
                                            │            │
┌─────────────────────────────┐            │            │
│   organization_profiles     │            │            │
├─────────────────────────────┤            │            │
│ org_profile_id (PK)         │            │            │
│ user_id (FK) ────────────────┘            │            │
│ org_name                    │                          │
│ sector                      │                          │
│ urgency_level                │                          │
│ budget_range                 │                          │
│ ...                          │                          │
└─────────────────────────────┘                          │
                                                            │
┌─────────────────────────────┐                          │
│      expert_profiles        │                          │
├─────────────────────────────┤                          │
│ expert_profile_id (PK)       │                          │
│ user_id (FK) ─────────────────────────────────────────┘
│ first_name                   │
│ headline                     │
│ availability_status          │
│ avg_rating                   │
│ ...                          │
└─────────────────────────────┘
```

---

## 2. Profiles & Discovery

```
expert_credentials
─────────────────────────────────────────────────────
credential_id       SERIAL PRIMARY KEY
expert_id           INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
credential_type     TEXT NOT NULL -- 'degree' | 'certification' | 'publication' | 'patent' | 'award'
credential_name     TEXT NOT NULL
institution          TEXT
year_obtained        INTEGER
expiry_date          DATE
verification_url     TEXT
created_at            TIMESTAMP DEFAULT NOW()

expert_work_history
─────────────────────────────────────────────────────
work_history_id      SERIAL PRIMARY KEY
expert_id            INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
organization_name    TEXT NOT NULL
job_title            TEXT NOT NULL
employment_type      TEXT -- 'full_time' | 'part_time' | 'contract' | 'consulting' | 'academic' | 'government'
start_date           DATE NOT NULL
end_date             DATE -- NULL = current position
is_current           BOOLEAN DEFAULT false
description          TEXT -- responsibilities, notable projects
order_index           INTEGER -- optional manual sort override; default sort is start_date DESC
created_at            TIMESTAMP DEFAULT NOW()

expert_specializations
─────────────────────────────────────────────────────
specialization_id        SERIAL PRIMARY KEY
expert_id                INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
specialization            TEXT NOT NULL -- 'post_quantum_cryptography' | 'cryptographic_audit' | ...
proficiency_level         TEXT NOT NULL -- 'familiar' | 'proficient' | 'expert' | 'leading_researcher'
years_in_specialization    INTEGER
created_at                 TIMESTAMP DEFAULT NOW()

expert_sector_experience
─────────────────────────────────────────────────────
sector_exp_id                 SERIAL PRIMARY KEY
expert_id                     INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
sector                        TEXT NOT NULL -- 'financial' | 'healthcare' | 'government' |
                              -- 'nonprofit' | 'legal' | 'energy' | 'education' | 'other'
years_experience_in_sector    INTEGER
compliance_standards_known    TEXT[] -- e.g. ARRAY['HIPAA','HITECH']
anonymized_client_examples    TEXT
created_at                    TIMESTAMP DEFAULT NOW()

expert_engagement_types
─────────────────────────────────────────────────────
eng_type_id                  SERIAL PRIMARY KEY
expert_id                    INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
engagement_type              TEXT NOT NULL -- canonical engagement_type enum (see §3)
typical_duration_weeks_min   INTEGER
typical_duration_weeks_max   INTEGER
typical_budget_min           NUMERIC(10,2)
typical_budget_max           NUMERIC(10,2)
approach_description         TEXT
created_at                   TIMESTAMP DEFAULT NOW()

organization_infrastructure
─────────────────────────────────────────────────────
infra_id                          SERIAL PRIMARY KEY
org_id                            INTEGER UNIQUE REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE
data_categories                   TEXT[] -- e.g. ARRAY['patient_records','billing_data']
storage_type                      TEXT -- 'on_premise' | 'cloud' | 'hybrid' | 'legacy_mainframe' | 'mixed'
primary_cloud_providers           TEXT[]
current_encryption_standards      TEXT[] -- e.g. ARRAY['RSA-2048','AES-256']
data_retention_years              INTEGER
oldest_system_age_years           INTEGER
compliance_requirements           TEXT[] -- e.g. ARRAY['HIPAA','PCI-DSS','FISMA']
has_dedicated_security_team       BOOLEAN
had_prior_quantum_assessment      BOOLEAN
known_risks_freetext              TEXT
created_at                        TIMESTAMP DEFAULT NOW()
updated_at                        TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌──────────────────────────────┐
│       expert_profiles         │
├──────────────────────────────┤
│ expert_profile_id (PK)         │◄─────────────┬──────────────┬───────────────┐
│ ...                            │              │              │               │
└──────────────────────────────┘              │              │               │
        ▲            ▲                          │              │               │
        │            │                          │              │               │
┌───────────────┐ ┌──────────────────────┐ ┌───────────────────┐ ┌────────────────────────┐
│expert_         │ │expert_work_history    │ │expert_specializ.. │ │expert_sector_experience │
│credentials     │ │                       │ │                   │ │                         │
├───────────────┤ ├──────────────────────┤ ├───────────────────┤ ├────────────────────────┤
│credential_id   │ │work_history_id (PK)   │ │specialization_id │ │sector_exp_id (PK)       │
│expert_id (FK)──┘ │expert_id (FK)──┘      │ │expert_id (FK)──┘  │ │expert_id (FK)──┘        │
│credential_type │ │organization_name       │ │specialization     │ │sector (enum, matches   │
│credential_name │ │job_title                │ │proficiency_level  │ │  organization sector)  │
│verification_url│ │start_date / end_date    │ └───────────────────┘ │compliance_standards..  │
└───────────────┘ └──────────────────────┘                          └────────────────────────┘

┌────────────────────────────┐
│  expert_engagement_types    │
├────────────────────────────┤
│ eng_type_id (PK)            │
│ expert_id (FK)──┘ (to expert_profiles)
│ engagement_type (canonical enum, shared w/ engagements & connection_requests)
│ typical_duration_weeks_..   │
│ typical_budget_..           │
└────────────────────────────┘

┌─────────────────────────────────┐
│      organization_profiles      │
├─────────────────────────────────┤
│ org_profile_id (PK)              │◄───────────────────┐ 1:1
└─────────────────────────────────┘                      │
┌─────────────────────────────────┐                      │
│   organization_infrastructure    │                      │
├─────────────────────────────────┤                      │
│ infra_id (PK)                    │                      │
│ org_id (FK) ──────────────────────┘                      │
│ data_categories                  │
│ storage_type                     │
│ current_encryption_standards     │
│ compliance_requirements          │
└─────────────────────────────────┘
```

---

## 3. Canonical Enums

```
engagement_type (shared by: engagements.engagement_type,
                 expert_engagement_types.engagement_type,
                 connection_requests.org_stated_need)
─────────────────────────────────────────────────────
'cryptographic_audit' | 'risk_assessment' | 'migration_roadmap' |
'executive_briefing' | 'staff_training' | 'ongoing_advisory' |
'compliance_review' | 'full_migration_support'

sector (shared by: organization_profiles.sector,
        expert_sector_experience.sector)
─────────────────────────────────────────────────────
'financial' | 'healthcare' | 'government' | 'nonprofit' |
'legal' | 'energy' | 'education' | 'other'
```

---

## 4. Matching

```
connection_requests
─────────────────────────────────────────────────────
connection_id          SERIAL PRIMARY KEY
org_id                 INTEGER REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE
expert_id              INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
initiated_by_user_id   INTEGER REFERENCES users(user_id)
status                 TEXT NOT NULL DEFAULT 'pending' -- 'pending' | 'accepted' | 'declined' | 'expired'
initial_message        TEXT
org_stated_need        TEXT -- canonical engagement_type enum; NULL = "not sure"
org_stated_timeline    TEXT -- 'asap' | 'within_3mo' | 'within_6mo' | 'within_year' | 'just_exploring'
match_score            NUMERIC(5,2) -- system-computed 0–100
ai_fit_score           INTEGER -- Gemini's advisory 0–100, computed once at creation; NULL if AI unconfigured/unavailable
ai_reasoning           TEXT -- 1–3 sentence explanation for ai_fit_score; NULL alongside it
expires_at             TIMESTAMP -- computed from org's default_connection_expiry_days
responded_at           TIMESTAMP
created_at             TIMESTAMP DEFAULT NOW()

UNIQUE partial index on (org_id, expert_id) WHERE status = 'pending'

match_scoring_factors
─────────────────────────────────────────────────────
factor_id               SERIAL PRIMARY KEY
connection_id            INTEGER REFERENCES connection_requests(connection_id) ON DELETE CASCADE
factor_name              TEXT NOT NULL -- 'sector_match' | 'compliance_overlap' | 'budget_fit' | ...
weight                   NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 1)
raw_score                NUMERIC(5,2) NOT NULL CHECK (raw_score BETWEEN 0 AND 100)
weighted_contribution     NUMERIC(5,2) -- weight × raw_score
created_at                TIMESTAMP DEFAULT NOW()

CONSTRAINT TRIGGER trg_match_factors_weight_sum, DEFERRABLE INITIALLY DEFERRED
-- fires at transaction commit; verifies SUM(weight) for a given connection_id
-- ≈ 1.00 (± 0.01 rounding tolerance)
```

### Diagram

```
┌─────────────────────────────┐      ┌────────────────────────────┐
│    organization_profiles     │      │       expert_profiles       │
├─────────────────────────────┤      ├────────────────────────────┤
│ org_profile_id (PK)          │      │ expert_profile_id (PK)      │
└─────────────────────────────┘      └────────────────────────────┘
        │ 1:M (initiator)                     │ 1:M (receiver only)
        ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      connection_requests                        │
├─────────────────────────────────────────────────────────────────┤
│ connection_id (PK)                                                │
│ org_id (FK) ─────────────────────────────► organization_profiles │
│ expert_id (FK) ─────────────────────────────► expert_profiles    │
│ initiated_by_user_id (FK) ─────────────────────────────► users   │
│ status  'pending' | 'accepted' | 'declined' | 'expired'          │
│ match_score                                                       │
│ org_stated_need (canonical engagement_type enum, nullable)        │
│ UNIQUE (org_id, expert_id) WHERE status='pending'                 │
└─────────────────────────────────────────────────────────────────┘
        │ 1:M
        ▼
┌─────────────────────────────────────────┐
│           match_scoring_factors           │
├─────────────────────────────────────────┤
│ factor_id (PK)                            │
│ connection_id (FK) ──┘                    │
│ factor_name / weight / raw_score           │
│ CHECK constraints + deferred weight-sum=1  │
│ trigger                                    │
└─────────────────────────────────────────┘
```

---

## 5. Engagements

```
engagements
─────────────────────────────────────────────────────
engagement_id           SERIAL PRIMARY KEY
connection_id           INTEGER UNIQUE REFERENCES connection_requests(connection_id) ON DELETE RESTRICT
org_id                  INTEGER REFERENCES organization_profiles(org_profile_id)
expert_id               INTEGER REFERENCES expert_profiles(expert_profile_id)
engagement_type         TEXT NOT NULL -- canonical engagement_type enum (see §3)
title                   TEXT
description             TEXT
status                  TEXT NOT NULL DEFAULT 'scoping'
                        -- 'scoping' | 'proposal_sent' | 'proposal_accepted' |
                        -- 'active' | 'on_hold' | 'completed' | 'cancelled'
agreed_budget           NUMERIC(12,2)
payment_structure       TEXT -- 'hourly' | 'fixed_price' | 'milestone_based' | 'retainer'
start_date              DATE
estimated_end_date      DATE
actual_end_date         DATE
cancellation_reason     TEXT
proposal_feedback       TEXT -- org's "request changes" note when bouncing proposal_sent back to scoping
proposal_expires_at     TIMESTAMP -- deadline for the org to respond to a sent proposal, set by the expert;
                        -- lazily swept back to 'scoping' if it lapses (mirrors connection_requests.expires_at)
created_at              TIMESTAMP DEFAULT NOW()
updated_at              TIMESTAMP DEFAULT NOW()

engagement_milestones
─────────────────────────────────────────────────────
milestone_id              SERIAL PRIMARY KEY
engagement_id             INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
proposed_by_user_id       INTEGER REFERENCES users(user_id)
proposed_by_role          TEXT NOT NULL -- 'organization' | 'expert'
title                     TEXT NOT NULL
description               TEXT
order_index               INTEGER NOT NULL
due_date                  DATE
deliverable_description   TEXT
status                    TEXT NOT NULL DEFAULT 'proposed'
                          -- 'proposed' | 'confirmed' | 'in_progress' |
                          -- 'completed' | 'skipped' | 'blocked'
confirmed_by_expert_id    INTEGER REFERENCES expert_profiles(expert_profile_id)
confirmed_at              TIMESTAMP
completed_at              TIMESTAMP
requires_client_approval  BOOLEAN DEFAULT false
client_approved_at        TIMESTAMP
pending_action                    TEXT -- NULL | 'change' | 'cancel' -- an org-proposed change
                                  -- awaiting the expert's accept/decline; at most one at a time
pending_due_date                  DATE -- proposed new due_date, when pending_action = 'change'
pending_deliverable_description   TEXT -- proposed new deliverable_description, when pending_action = 'change'
pending_requested_by_user_id      INTEGER REFERENCES users(user_id)
pending_requested_at              TIMESTAMP
created_at                TIMESTAMP DEFAULT NOW()
updated_at                TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌─────────────────────────────┐        ┌────────────────────────────┐
│    connection_requests       │        │      organization_profiles  │
├─────────────────────────────┤        ├────────────────────────────┤
│ connection_id (PK, UNIQUE FK)│        └────────────────────────────┘
└─────────────────────────────┘                     ▲
        │ 1:1                                        │
        ▼                                             │
┌───────────────────────────────────────────────────────────────────┐
│                            engagements                              │
├───────────────────────────────────────────────────────────────────┤
│ engagement_id (PK)                                                    │
│ connection_id (FK, UNIQUE) ────────────────────► connection_requests │
│ org_id (FK) ────────────────────────────────────► organization_profiles│
│ expert_id (FK) ────────────────────────────────────► expert_profiles │
│ engagement_type (canonical enum)                                      │
│ status / agreed_budget / payment_structure                            │
└───────────────────────────────────────────────────────────────────┘
        │ 1:M
        ▼
┌────────────────────────────────────────────┐
│            engagement_milestones             │
├────────────────────────────────────────────┤
│ milestone_id (PK)                             │
│ engagement_id (FK) ──┘                        │
│ proposed_by_user_id / proposed_by_role        │
│ status ('proposed'→'confirmed'→'in_progress'  │
│         →'completed' | 'skipped' | 'blocked') │
│ confirmed_by_expert_id / confirmed_at         │
│ requires_client_approval / client_approved_at │
└────────────────────────────────────────────┘
```

---

## 6. Communication

```
messages
─────────────────────────────────────────────────────
message_id       SERIAL PRIMARY KEY
engagement_id    INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
sender_id        INTEGER REFERENCES users(user_id)
content          TEXT -- encrypted at rest
message_type     TEXT NOT NULL -- 'text' | 'file' | 'milestone_update' | 'system_event'
document_id      INTEGER REFERENCES secure_document_shares(document_id) ON DELETE SET NULL
                 -- set when message_type = 'file'
is_read          BOOLEAN DEFAULT false
read_at          TIMESTAMP
created_at       TIMESTAMP DEFAULT NOW()

secure_document_shares
─────────────────────────────────────────────────────
document_id          SERIAL PRIMARY KEY
engagement_id        INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
uploaded_by_id       INTEGER REFERENCES users(user_id)
document_name        TEXT NOT NULL
document_type        TEXT -- 'network_diagram' | 'encryption_inventory' | 'compliance_report' | ...
storage_url          TEXT NOT NULL -- encrypted storage path, not publicly accessible
file_size_bytes      BIGINT
checksum_sha256      TEXT -- integrity verification
access_expires_at    TIMESTAMP
is_revoked           BOOLEAN DEFAULT false
revoked_at           TIMESTAMP
first_accessed_at    TIMESTAMP
created_at           TIMESTAMP DEFAULT NOW()

notifications
─────────────────────────────────────────────────────
notification_id       SERIAL PRIMARY KEY
user_id                INTEGER REFERENCES users(user_id) ON DELETE CASCADE
type                    TEXT NOT NULL -- 'connection_request_received' | 'message_received' | 'milestone_completed' | ...
title                   TEXT NOT NULL
body                    TEXT
related_entity_type     TEXT -- 'engagement' | 'message' | 'review' (polymorphic)
related_entity_id       INTEGER
action_url              TEXT
is_read                 BOOLEAN DEFAULT false
read_at                 TIMESTAMP
created_at              TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌───────────────────────────────────┐
│             engagements             │
├───────────────────────────────────┤
│ engagement_id (PK)                    │◄──────────────────────┐
└───────────────────────────────────┘                          │
        │ 1:M                    │ 1:M                          │
        ▼                        ▼                              │
┌────────────────┐      ┌────────────────────────┐              │
│    messages      │      │  secure_document_shares │              │
├────────────────┤      ├────────────────────────┤              │
│ message_id (PK)  │      │ document_id (PK)         │◄─┐          │
│ engagement_id(FK)│      │ engagement_id (FK)──┘    │  │          │
│ sender_id (FK)───┼──────────────────────────────────────► users │
│ document_id (FK)─┼──────┘ (link, when message_type='file')      │
│ message_type      │      │ uploaded_by_id (FK) ───────────────► users
└────────────────┘      │ storage_url / checksum   │
                          └────────────────────────┘
┌───────────────────┐
│       users          │
├───────────────────┤
│ user_id (PK)         │◄─────────────────────────────────┘ 1:M
└───────────────────┘
        │ 1:M
        ▼
┌───────────────────────────┐
│      notifications          │
├───────────────────────────┤
│ notification_id (PK)        │
│ user_id (FK) ──┘             │
│ related_entity_type/_id      │ (polymorphic ref → any entity)
└───────────────────────────┘
```

---

## 7. Trust & Reviews

```
reviews
─────────────────────────────────────────────────────
review_id                SERIAL PRIMARY KEY
engagement_id            INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
reviewer_id               INTEGER REFERENCES users(user_id)
reviewee_id                INTEGER REFERENCES users(user_id)
reviewer_role              TEXT NOT NULL -- 'organization' | 'expert'
overall_rating              SMALLINT NOT NULL -- 1–5
communication_rating        SMALLINT -- 1–5
expertise_rating            SMALLINT -- 1–5 (expert reviews only)
timeliness_rating           SMALLINT -- 1–5
value_rating                 SMALLINT -- 1–5: was it worth the cost?
review_title                 TEXT
review_body                  TEXT
is_public                    BOOLEAN DEFAULT true
is_flagged                   BOOLEAN DEFAULT false
flagged_reason               TEXT
created_at                    TIMESTAMP DEFAULT NOW()

UNIQUE(engagement_id, reviewer_role)

verification_records
─────────────────────────────────────────────────────
verification_id          SERIAL PRIMARY KEY
user_id                   INTEGER REFERENCES users(user_id) ON DELETE CASCADE
verification_type         TEXT NOT NULL -- 'identity' | 'professional_credential' |
                          -- 'organization_legitimacy' | 'background_check'
related_credential_id     INTEGER REFERENCES expert_credentials(credential_id) ON DELETE CASCADE
                          -- set when verification_type = 'professional_credential' and this
                          -- record verifies one specific credential; NULL otherwise
status                     TEXT NOT NULL -- 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired'
reviewed_by_admin_id        INTEGER REFERENCES users(user_id)
submitted_document_urls     TEXT[]
admin_notes                  TEXT
rejection_reason             TEXT
reviewed_at                  TIMESTAMP
expires_at                   DATE
created_at                    TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌────────────────────────────────┐
│           engagements            │
├────────────────────────────────┤
│ engagement_id (PK)                 │◄──────────┐ 1:M (max 2: one per reviewer_role)
└────────────────────────────────┘              │
                                                    │
┌─────────────────────────────────────┐          │
│                reviews                 │          │
├─────────────────────────────────────┤          │
│ review_id (PK)                          │          │
│ engagement_id (FK) ────┘                │
│ reviewer_id (FK) ───────────────────► users
│ reviewee_id (FK) ───────────────────► users
│ reviewer_role                           │
│ UNIQUE(engagement_id, reviewer_role)    │
└─────────────────────────────────────┘

┌───────────────────────────────┐        ┌───────────────────────────┐
│              users               │        │      expert_credentials     │
├───────────────────────────────┤        ├───────────────────────────┤
│ user_id (PK)                      │◄──┐    │ credential_id (PK)          │◄──┐
└───────────────────────────────┘    │    └───────────────────────────┘    │
                                        │                                       │
┌──────────────────────────────────┐  │                                       │
│         verification_records        │  │                                       │
├──────────────────────────────────┤  │                                       │
│ verification_id (PK)                 │  │                                       │
│ user_id (FK) ────────────────────────┘                                       │
│ reviewed_by_admin_id (FK) ──────────────────────────► users (admin)          │
│ related_credential_id (FK) ────────────────────────────────────────────────┘
│ verification_type / status           │
└──────────────────────────────────┘
```

---

## 8. Risk Assessment

```
risk_assessments
─────────────────────────────────────────────────────
assessment_id                    SERIAL PRIMARY KEY
engagement_id                     INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
created_by_expert_id               INTEGER REFERENCES expert_profiles(expert_profile_id)
overall_risk_level                  TEXT NOT NULL -- 'critical' | 'high' | 'medium' | 'low'
quantum_readiness_score             NUMERIC(5,2) -- 0–100 standardized metric
hndl_exposure                        TEXT -- 'high' | 'medium' | 'low' | 'none' ("Harvest Now, Decrypt Later")
executive_summary                    TEXT
methodology                          TEXT
estimated_migration_cost_min          NUMERIC(12,2)
estimated_migration_cost_max          NUMERIC(12,2)
estimated_migration_months            INTEGER
status                                TEXT NOT NULL -- 'draft' | 'under_org_review' | 'finalized' | 'delivered'
delivered_at                          TIMESTAMP
created_at                             TIMESTAMP DEFAULT NOW()
updated_at                             TIMESTAMP DEFAULT NOW()

assessment_findings
─────────────────────────────────────────────────────
finding_id            SERIAL PRIMARY KEY
assessment_id          INTEGER REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE
category                TEXT NOT NULL -- 'cryptographic_algorithm' | 'key_management' | 'legacy_system' | ...
severity                 TEXT NOT NULL -- 'critical' | 'high' | 'medium' | 'low' | 'informational'
title                     TEXT NOT NULL
description               TEXT
affected_systems          TEXT
vulnerability_type         TEXT -- 'shor_algorithm_vulnerable' | 'grover_algorithm_weakened' |
                          -- 'harvest_now_decrypt_later' | ...
order_index                INTEGER
created_at                  TIMESTAMP DEFAULT NOW()

remediation_recommendations
─────────────────────────────────────────────────────
recommendation_id           SERIAL PRIMARY KEY
finding_id                    INTEGER REFERENCES assessment_findings(finding_id) ON DELETE CASCADE
assessment_id                  INTEGER REFERENCES risk_assessments(assessment_id) -- denormalized shortcut ref
priority                        TEXT NOT NULL -- 'immediate' | 'short_term_0_6mo' |
                                -- 'medium_term_6_18mo' | 'long_term_18mo_plus'
action_title                     TEXT NOT NULL
action_description                TEXT
recommended_pqc_algorithm          TEXT -- e.g. 'CRYSTALS-Kyber (FIPS 203)'
nist_standard_reference             TEXT -- e.g. 'NIST FIPS 204'
estimated_effort_weeks               INTEGER
estimated_cost_range                  TEXT
dependencies                           TEXT
is_completed                            BOOLEAN DEFAULT false -- org marks progress after engagement ends
completed_at                             TIMESTAMP
created_at                                TIMESTAMP DEFAULT NOW()
```

### Diagram

```
┌─────────────────────────────────────────┐
│               engagements                  │
├─────────────────────────────────────────┤
│ engagement_id (PK)                          │◄─────────────────────┐
└─────────────────────────────────────────┘                        │
        │ 1:M                                                       │
        ▼                                                            │
┌─────────────────────────────────────────────────────────┐        │
│                    risk_assessments                         │        │
├─────────────────────────────────────────────────────────┤        │
│ assessment_id (PK)                                            │        │
│ engagement_id (FK) ──────────┘                                │
│ created_by_expert_id (FK) ─────────────────────────────► expert_profiles
│ overall_risk_level / quantum_readiness_score / hndl_exposure   │
│ status                                                          │
└─────────────────────────────────────────────────────────┘
        │ 1:M
        ▼
┌──────────────────────────────────────────┐
│            assessment_findings              │
├──────────────────────────────────────────┤
│ finding_id (PK)                              │◄───────────────────┐
│ assessment_id (FK) ──┘                       │
│ category / severity / vulnerability_type      │
└──────────────────────────────────────────┘
        │ 1:M                                                       │
        ▼                                                            │
┌──────────────────────────────────────────────┐                   │
│         remediation_recommendations              │                   │
├──────────────────────────────────────────────┤                   │
│ recommendation_id (PK)                            │                   │
│ finding_id (FK) ──┘                               │
│ assessment_id (FK) ────────────────────────────────────────────────┘ (shortcut ref)
│ priority / recommended_pqc_algorithm / nist_standard_reference        │
│ is_completed                                                          │
└──────────────────────────────────────────────┘
```
