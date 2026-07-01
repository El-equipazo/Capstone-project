# Capstone-project

This project proposes the development of a specialized application designed to connect quantum security experts with high-risk organizations, enabling proactive assessment and remediation before a quantum breakthrough renders current protections obsolete.

The Platform
It serves as a specialized marketplace where organizations can discover and connect with the quantum security experts best suited to their needs. Institutions access the platform to search a curated directory of verified quantum security professionals, filtering by specialization, industry experience, and the specific types of cryptographic risk they face. Each expert profile details their areas of expertise, past engagement types, certifications, and familiarity with relevant sector-specific compliance requirements, giving organizations the context they need to make informed decisions about who to engage.

## Schema

### Identity & Auth

users
─────────────────────────────────────────────────────
user_id SERIAL PRIMARY KEY
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
role TEXT NOT NULL 'organization' | 'expert' | 'admin'
is_email_verified BOOLEAN DEFAULT false
is_active BOOLEAN DEFAULT true
last_login_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

organization_profiles
─────────────────────────────────────────────────────
org_profile_id SERIAL PRIMARY KEY
user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
org_name TEXT NOT NULL
sector TEXT NOT NULL 'financial' | 'healthcare' | 'government' | ...
sub_sector TEXT
founded_year INTEGER
employee_count_range TEXT '<50' | '50-250' | '250-1k' | ...
country TEXT
state_province TEXT
website TEXT
org_description TEXT
quantum_knowledge_level TEXT 'none' | 'basic' | 'intermediate' | 'advanced'
budget_range TEXT 'under_10k' | '10k_50k' | '50k_250k' | ...
urgency_level TEXT 'just_exploring' | 'planning_ahead' | 'urgent' | 'critical'
is_verified BOOLEAN DEFAULT false
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

expert_profiles
─────────────────────────────────────────────────────
expert_profile_id SERIAL PRIMARY KEY
user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
first_name TEXT NOT NULL
last_name TEXT NOT NULL
headline TEXT
bio TEXT
profile_photo_url TEXT
years_of_experience INTEGER
linkedin_url TEXT
personal_website TEXT
hourly_rate_min NUMERIC(10,2)
hourly_rate_max NUMERIC(10,2)
availability_status TEXT -- 'available' | 'limited' | 'unavailable' | 'booking_future'
avg_response_time_hours INTEGER
preferred_engagement_length TEXT -- 'short_term' | 'long_term' | 'both'
is_verified BOOLEAN DEFAULT false
verification_status TEXT -- 'unsubmitted' | 'pending' | 'verified' | 'rejected'
avg_rating NUMERIC(3,2) -- computed from reviews
total_completed_engagements INTEGER DEFAULT 0
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

## Diagram

┌───────────────────────┐
│ users │
├───────────────────────┤
│ user_id (PK) │◄──────────────────────────────┐ 1:1
│ email │◄──────────────────┐ │
│ password_hash │ │ │
│ role │ │ │
└───────────────────────┘ │ │
│ │
┌─────────────────────────────┐ │ │
│ organization_profiles │ │ │
├─────────────────────────────┤ │ │
│ org_profile_id (PK) │ │ │
│ user_id (FK) ───┘ │ │
│ org_name │ │ │
│ sector │ │ │
│ urgency_level │ │ │
│ budget_range │ │ │
│ ... │ │ │
└─────────────────────────────┘ │ │
│ │
┌─────────────────────────────┐ │ │
│ expert_profiles │ │ │
├─────────────────────────────┤ │ │
│ expert_profile_id (PK) │ │ │
│ user_id (FK) ───┘ │ │
│ first_name │ │ │
│ headline │ │ │
│ availability_status │ │ │
│ avg_rating │ │ │
│ ... │ │ │
└─────────────────────────────┘ │ │
▲ │ │
│ │ │
(used by Domain 2, 3, 4, 6, 7) (1:1) (1:1)

### Profiles & Discovery

expert_credentials
─────────────────────────────────────────────────────
credential_id SERIAL PRIMARY KEY
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
credential_type TEXT NOT NULL -- 'degree' | 'certification' | 'publication' | 'patent' | 'award'
credential_name TEXT NOT NULL
institution TEXT
year_obtained INTEGER
expiry_date DATE
verification_url TEXT
is_admin_verified BOOLEAN DEFAULT false
created_at TIMESTAMP DEFAULT NOW()

expert_specializations
─────────────────────────────────────────────────────
specialization_id SERIAL PRIMARY KEY
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
specialization TEXT NOT NULL -- 'post_quantum_cryptography' | 'cryptographic_audit' | ...
proficiency_level TEXT NOT NULL -- 'familiar' | 'proficient' | 'expert' | 'leading_researcher'
years_in_specialization INTEGER
created_at TIMESTAMP DEFAULT NOW()

expert_sector_experience
─────────────────────────────────────────────────────
sector_exp_id SERIAL PRIMARY KEY
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
sector TEXT NOT NULL
years_experience_in_sector INTEGER
compliance_standards_known TEXT[] -- e.g. ARRAY['HIPAA','HITECH']
anonymized_client_examples TEXT
created_at TIMESTAMP DEFAULT NOW()

expert_engagement_types
─────────────────────────────────────────────────────
eng_type_id SERIAL PRIMARY KEY
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
engagement_type TEXT NOT NULL -- 'cryptographic_audit' | 'risk_assessment' | 'migration_roadmap' | ...
typical_duration_weeks_min INTEGER
typical_duration_weeks_max INTEGER
typical_budget_min NUMERIC(10,2)
typical_budget_max NUMERIC(10,2)
approach_description TEXT
created_at TIMESTAMP DEFAULT NOW()

organization_infrastructure
─────────────────────────────────────────────────────
infra_id SERIAL PRIMARY KEY
org_id INTEGER UNIQUE REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE
data_categories TEXT[] -- e.g. ARRAY['patient_records','billing_data']
storage_type TEXT -- 'on_premise' | 'cloud' | 'hybrid' | 'legacy_mainframe' | 'mixed'
primary_cloud_providers TEXT[]
current_encryption_standards TEXT[] -- e.g. ARRAY['RSA-2048','AES-256']
data_retention_years INTEGER
oldest_system_age_years INTEGER
compliance_requirements TEXT[] -- e.g. ARRAY['HIPAA','PCI-DSS','FISMA']
has_dedicated_security_team BOOLEAN
had_prior_quantum_assessment BOOLEAN
known_risks_freetext TEXT
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

## Diagram

┌─────────────────────────────┐
│ expert*profiles │
├─────────────────────────────┤
│ expert_profile_id (PK) │◄─────────────────────────┐
│ ... │◄──────────────────┐ │
└─────────────────────────────┘◄─────────┐ │ │
▲ │ │ │
│◄──────────────────┐ │ │ │
│ │ │ │ │
┌─────────────────────┐ ┌───────────────────┐ │ │
│ expert_credentials │ │expert_specializ.. │ │ │
├─────────────────────┤ ├───────────────────┤ │ │
│ credential_id (PK) │ │ specialization_id │ │ │
│ expert_id (FK)─┘ │ expert_id (FK)─┘ │ │
│ credential_type │ │ specialization │ │ │
│ credential_name │ │ proficiency_level │ │ │
│ is_admin_verified │ └───────────────────┘ │ │
└─────────────────────┘ │ │
│ │
┌───────────────────────────┐ ┌───────────────────────────┐
│ expert_sector_experience │ │ expert_engagement_types │
├───────────────────────────┤ ├───────────────────────────┤
│ sector_exp_id (PK) │ │ eng_type_id (PK) │
│ expert_id (FK)──┘ │ expert_id (FK)──┘
│ sector │ │ engagement_type │
│ compliance_standards_known│ │ typical_duration_weeks*.. │
└───────────────────────────┘ │ typical*budget*.. │
└───────────────────────────┘

┌─────────────────────────────────┐
│ organization_profiles │
├─────────────────────────────────┤
│ org_profile_id (PK) │◄─────────────────────┐ 1:1
│ ... │ │
└─────────────────────────────────┘ │
│
┌─────────────────────────────────┐ │
│ organization_infrastructure │ │
├─────────────────────────────────┤ │
│ infra_id (PK) │ │
│ org_id (FK) ───┘ │
│ data_categories │
│ storage_type │
│ current_encryption_standards │
│ compliance_requirements │
└─────────────────────────────────┘

### Matching

connection_requests
─────────────────────────────────────────────────────
connection_id SERIAL PRIMARY KEY
org_id INTEGER REFERENCES organization_profiles(org_profile_id) ON DELETE CASCADE
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id) ON DELETE CASCADE
initiated_by_role TEXT NOT NULL -- 'organization' | 'expert' | 'system_recommendation'
initiated_by_user_id INTEGER REFERENCES users(user_id)
status TEXT NOT NULL -- 'pending' | 'accepted' | 'declined' | 'expired' | 'withdrawn'
initial_message TEXT
org_stated_need TEXT -- 'cryptographic_audit' | 'risk_assessment' | 'not_sure' | ...
org_stated_timeline TEXT -- 'asap' | 'within_3mo' | 'within_6mo' | ...
match_score NUMERIC(5,2) -- system-computed 0–100
expires_at TIMESTAMP
responded_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

## Diagram

match_scoring_factors
─────────────────────────────────────────────────────
factor_id SERIAL PRIMARY KEY
connection_id INTEGER REFERENCES connection_requests(connection_id) ON DELETE CASCADE
factor_name TEXT NOT NULL -- 'sector_match' | 'compliance_overlap' | 'budget_fit' | ...
weight NUMERIC(5,2) -- importance of this factor (0–1, all weights sum to 1)
raw_score NUMERIC(5,2) -- score for this factor alone (0–100)
weighted_contribution NUMERIC(5,2) -- weight × raw_score
created_at TIMESTAMP DEFAULT NOW()

┌─────────────────────────────┐ ┌────────────────────────────┐
│ organization_profiles │ │ expert_profiles │
├─────────────────────────────┤ ├────────────────────────────┤
│ org_profile_id (PK) │ │ expert_profile_id (PK) │
│ ... │ │ ... │
└─────────────────────────────┘ └────────────────────────────┘
│ 1:M │ 1:M
│ │
▼ ▼
┌─────────────────────────────────────────────────────────────────────┐
│ connection_requests │
├─────────────────────────────────────────────────────────────────────┤
│ connection_id (PK) │
│ org_id (FK) ──────────────────────────────────────► org_profile_id
│ expert_id (FK) ──────────────────────────────────────► expert_profile_id
│ status │
│ match_score │
│ initiated_by_role │
│ org_stated_need │
└─────────────────────────────────────────────────────────────────────┘
│ 1:M
▼
┌──────────────────────────────┐
│ match_scoring_factors │
├──────────────────────────────┤
│ factor_id (PK) │
│ connection_id (FK) ─────┘
│ factor_name │
│ weight │
│ raw_score │
│ weighted_contribution │
└──────────────────────────────┘

### Engagements

engagement_templates
─────────────────────────────────────────────────────
template_id SERIAL PRIMARY KEY
engagement_type TEXT NOT NULL -- 'cryptographic_audit' | 'risk_assessment' | ...
name TEXT NOT NULL
description TEXT
target_sector TEXT -- 'all' | 'financial' | 'healthcare' | ...
typical_duration_weeks INTEGER
is_active BOOLEAN DEFAULT true
created_by_admin_id INTEGER REFERENCES users(user_id)
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

milestone_templates
─────────────────────────────────────────────────────
milestone_template_id SERIAL PRIMARY KEY
template_id INTEGER REFERENCES engagement_templates(template_id) ON DELETE CASCADE
title TEXT NOT NULL
description TEXT
order_index INTEGER NOT NULL
typical_duration_days INTEGER
deliverable_description TEXT
created_at TIMESTAMP DEFAULT NOW()

engagements
─────────────────────────────────────────────────────
engagement_id SERIAL PRIMARY KEY
connection_id INTEGER UNIQUE REFERENCES connection_requests(connection_id) ON DELETE RESTRICT
org_id INTEGER REFERENCES organization_profiles(org_profile_id)
expert_id INTEGER REFERENCES expert_profiles(expert_profile_id)
engagement_type TEXT NOT NULL
title TEXT
description TEXT
status TEXT NOT NULL -- 'scoping' | 'proposal_sent' | 'proposal_accepted' | 'active' | 'on_hold' | 'completed' | 'cancelled'
template_id INTEGER REFERENCES engagement_templates(template_id) -- nullable
agreed_budget NUMERIC(12,2)
payment_structure TEXT -- 'hourly' | 'fixed_price' | 'milestone_based' | 'retainer'
start_date DATE
estimated_end_date DATE
actual_end_date DATE
cancellation_reason TEXT
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

engagement_milestones
─────────────────────────────────────────────────────
milestone_id SERIAL PRIMARY KEY
engagement_id INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
title TEXT NOT NULL
description TEXT
order_index INTEGER NOT NULL
due_date DATE
completed_at TIMESTAMP
status TEXT NOT NULL -- 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked'
deliverable_description TEXT
payment_amount NUMERIC(12,2) -- for milestone-based payment structure
requires_client_approval BOOLEAN DEFAULT false
client_approved_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

┌────────────────────────────┐
│ engagement_templates │
├────────────────────────────┤
│ template_id (PK) │◄────────────────────────────────┐ 1:M
│ engagement_type │◄────────────────┐ │
│ name │ │ │
│ target_sector │ │ │
└────────────────────────────┘ │ │
│ 1:M │ │
▼ │ │
┌────────────────────────────┐ │ │
│ milestone_templates │ │ │
├────────────────────────────┤ │ │
│ milestone_template_id (PK) │ │ │
│ template_id (FK)─┘ │ │
│ title │ │ │
│ order_index │ │ │
│ typical_duration_days │ │ │
└────────────────────────────┘ │ │
│ │
┌──────────────────────────────────────────────┼───────────────┼────────────────┐
│ engagements │ │ │
├──────────────────────────────────────────────┼───────────────┼────────────────┤
│ engagement_id (PK) │ │ │
│ connection_id (FK, UNIQUE) ─────────────────────────────────────► connection_requests
│ org_id (FK) ─────────────────────────────────────────────► organization_profiles
│ expert_id (FK) ─────────────────────────────────────────────► expert_profiles
│ template_id (FK) ─────────────────┘ │ │
│ status │ │
│ agreed_budget │ │
│ payment_structure │ │
└───────────────────────────────────────────────────────────────────────────────┘
│ 1:M │
▼ │
┌────────────────────────────────┐ │
│ engagement_milestones │ │
├────────────────────────────────┤ │
│ milestone_id (PK) │ │
│ engagement_id (FK) ───┘ │
│ title │ (cloned from milestone_templates when template is chosen)
│ order_index │
│ status │
│ requires_client_approval │
└────────────────────────────────┘

### Communication

messages
─────────────────────────────────────────────────────
message_id SERIAL PRIMARY KEY
engagement_id INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
sender_id INTEGER REFERENCES users(user_id)
content TEXT -- encrypted at rest
message_type TEXT NOT NULL -- 'text' | 'file' | 'milestone_update' | 'system_event'
file_url TEXT
file_name TEXT
file_size_bytes BIGINT
is_read BOOLEAN DEFAULT false
read_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

secure_document_shares
─────────────────────────────────────────────────────
document_id SERIAL PRIMARY KEY
engagement_id INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
uploaded_by_id INTEGER REFERENCES users(user_id)
document_name TEXT NOT NULL
document_type TEXT -- 'network_diagram' | 'encryption_inventory' | 'compliance_report' | ...
storage_url TEXT NOT NULL -- encrypted storage path, not publicly accessible
file_size_bytes BIGINT
checksum_sha256 TEXT -- integrity verification
access_expires_at TIMESTAMP
is_revoked BOOLEAN DEFAULT false
revoked_at TIMESTAMP
first_accessed_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

notifications
─────────────────────────────────────────────────────
notification_id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE
type TEXT NOT NULL -- 'connection_request_received' | 'message_received' | 'milestone_completed' | ...
title TEXT NOT NULL
body TEXT
related_entity_type TEXT -- 'engagement' | 'message' | 'review' (polymorphic)
related_entity_id INTEGER
action_url TEXT
is_read BOOLEAN DEFAULT false
read_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

## Diagram

┌───────────────────────────────────┐
│ engagements │
├───────────────────────────────────┤
│ engagement_id (PK) │◄──────────────────────┐
│ ... │◄──────────────┐ │
└───────────────────────────────────┘ │ │
│ │ │ │
1:M │ 1:M │ │ │
▼ ▼ │ │
┌────────────────┐ ┌────────────────────────┐ │ │
│ messages │ │ secure_document_shares│ │ │
├────────────────┤ ├────────────────────────┤ │ │
│ message_id (PK)│ │ document_id (PK) │ │ │
│ engagement_id │ │ engagement_id (FK) ─┘ │ │
│ (FK) ──────────┘ │ uploaded_by_id (FK) ────────────────────► users
│ sender_id (FK)────────────────────────────────────────────► users
│ content │ │ storage_url │ │ │
│ message_type │ │ checksum_sha256 │ │ │
└────────────────┘ └────────────────────────┘ │ │
│ │
┌───────────────────┐ │ │
│ users │ │ │
├───────────────────┤ │ │
│ user_id (PK) │◄──────────────────────────────┘ 1:M │
│ ... │ │
└───────────────────┘ │
│ 1:M │
▼ │
┌───────────────────────────┐ │
│ notifications │ │
├───────────────────────────┤ │
│ notification_id (PK) │ │
│ user_id (FK) ──┘ │
│ type │ │
│ related_entity_type │ (polymorphic ref) │
│ related_entity_id │──────────────────────────────►│ any entity
└───────────────────────────┘

### Trust & Reviews

reviews
─────────────────────────────────────────────────────
review_id SERIAL PRIMARY KEY
engagement_id INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
reviewer_id INTEGER REFERENCES users(user_id)
reviewee_id INTEGER REFERENCES users(user_id)
reviewer_role TEXT NOT NULL -- 'organization' | 'expert'
overall_rating SMALLINT NOT NULL -- 1–5
communication_rating SMALLINT -- 1–5
expertise_rating SMALLINT -- 1–5 (expert reviews only)
timeliness_rating SMALLINT -- 1–5
value_rating SMALLINT -- 1–5: was it worth the cost?
review_title TEXT
review_body TEXT
is_public BOOLEAN DEFAULT true
is_flagged BOOLEAN DEFAULT false
flagged_reason TEXT
created_at TIMESTAMP DEFAULT NOW()

verification_records
─────────────────────────────────────────────────────
verification_id SERIAL PRIMARY KEY
user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE
verification_type TEXT NOT NULL -- 'identity' | 'professional_credential' | 'organization_legitimacy' | 'background_check'
status TEXT NOT NULL -- 'pending' | 'under_review' | 'approved' | 'rejected' | 'expired'
reviewed_by_admin_id INTEGER REFERENCES users(user_id)
submitted_document_urls TEXT[]
admin_notes TEXT
rejection_reason TEXT
reviewed_at TIMESTAMP
expires_at DATE
created_at TIMESTAMP DEFAULT NOW()

## Diagram

┌────────────────────────────────┐
│ engagements │
├────────────────────────────────┤
│ engagement_id (PK) │◄──────────┐ 1:M (up to 2 per engagement:
│ org_id │ │ one from org, one from expert)
│ expert_id │ │
└────────────────────────────────┘ │
│
┌─────────────────────────────────────┐ │
│ reviews │ │
├─────────────────────────────────────┤ │
│ review_id (PK) │ │
│ engagement_id (FK) ────┘ │
│ reviewer_id (FK) ───────────────────► users
│ reviewee_id (FK) ───────────────────► users
│ reviewer_role │ (who wrote it: org or expert?)
│ overall_rating │
│ expertise_rating │
│ is_flagged │
└─────────────────────────────────────┘

┌───────────────────────────────┐
│ users │
├───────────────────────────────┤
│ user_id (PK) │◄──────────────────────────────────┐
│ ... │◄──────────────────────┐ │
└───────────────────────────────┘ │ │
│ 1:M │ │
▼ │ │
┌──────────────────────────────────┐ │ │
│ verification_records │ │ │
├──────────────────────────────────┤ │ │
│ verification_id (PK) │ │ │
│ user_id (FK) ────┘ │ │
│ reviewed_by_admin_id (FK) ─────────────────────────┘ (admin) │
│ verification_type │ │
│ status │ │
└──────────────────────────────────┘

### Risk Assessment

risk_assessments
─────────────────────────────────────────────────────
assessment_id SERIAL PRIMARY KEY
engagement_id INTEGER REFERENCES engagements(engagement_id) ON DELETE CASCADE
created_by_expert_id INTEGER REFERENCES expert_profiles(expert_profile_id)
overall_risk_level TEXT NOT NULL -- 'critical' | 'high' | 'medium' | 'low'
quantum_readiness_score NUMERIC(5,2) -- 0–100 standardized metric
hndl_exposure TEXT -- 'high' | 'medium' | 'low' | 'none' ("Harvest Now, Decrypt Later")
executive_summary TEXT
methodology TEXT
estimated_migration_cost_min NUMERIC(12,2)
estimated_migration_cost_max NUMERIC(12,2)
estimated_migration_months INTEGER
status TEXT NOT NULL -- 'draft' | 'under_org_review' | 'finalized' | 'delivered'
delivered_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()

assessment_findings
─────────────────────────────────────────────────────
finding_id SERIAL PRIMARY KEY
assessment_id INTEGER REFERENCES risk_assessments(assessment_id) ON DELETE CASCADE
category TEXT NOT NULL -- 'cryptographic_algorithm' | 'key_management' | 'legacy_system' | ...
severity TEXT NOT NULL -- 'critical' | 'high' | 'medium' | 'low' | 'informational'
title TEXT NOT NULL
description TEXT
affected_systems TEXT
vulnerability_type TEXT -- 'shor_algorithm_vulnerable' | 'grover_algorithm_weakened' | 'harvest_now_decrypt_later' | ...
order_index INTEGER
created_at TIMESTAMP DEFAULT NOW()

remediation_recommendations
─────────────────────────────────────────────────────
recommendation_id SERIAL PRIMARY KEY
finding_id INTEGER REFERENCES assessment_findings(finding_id) ON DELETE CASCADE
assessment_id INTEGER REFERENCES risk_assessments(assessment_id)
priority TEXT NOT NULL -- 'immediate' | 'short_term_0_6mo' | 'medium_term_6_18mo' | 'long_term_18mo_plus'
action_title TEXT NOT NULL
action_description TEXT
recommended_pqc_algorithm TEXT -- e.g. 'CRYSTALS-Kyber (FIPS 203)'
nist_standard_reference TEXT -- e.g. 'NIST FIPS 204'
estimated_effort_weeks INTEGER
estimated_cost_range TEXT
dependencies TEXT
is_completed BOOLEAN DEFAULT false -- org marks progress after engagement ends
completed_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()

## Diagram

┌─────────────────────────────────────────┐
│ engagements │
├─────────────────────────────────────────┤
│ engagement_id (PK) │◄────────────────────────────────────┐
│ ... │ │
└─────────────────────────────────────────┘ │
│ 1:M │
▼ │
┌─────────────────────────────────────────────────────────┐ │
│ risk_assessments │ │
├─────────────────────────────────────────────────────────┤ │
│ assessment_id (PK) │ │
│ engagement_id (FK) ──────────┘ │
│ created_by_expert_id (FK) ─────────────────────────────► expert_profiles
│ overall_risk_level │
│ quantum_readiness_score │
│ hndl_exposure │
│ estimated_migration_months │
│ status │
└─────────────────────────────────────────────────────────┘
│ 1:M
▼
┌──────────────────────────────────────────┐
│ assessment_findings │
├──────────────────────────────────────────┤
│ finding_id (PK) │◄───────────────────────────────┐
│ assessment_id (FK) ───┘ │
│ category │ │
│ severity │ │
│ vulnerability_type │ │
└──────────────────────────────────────────┘ │
│ 1:M │
▼ │
┌──────────────────────────────────────────────┐ │
│ remediation_recommendations │ │
├──────────────────────────────────────────────┤ │
│ recommendation_id (PK) │ │
│ finding_id (FK) ───┘ │
│ assessment_id (FK) ───────────────────────────────►│ (shortcut ref)
│ priority │
│ recommended_pqc_algorithm │
│ nist_standard_reference │
│ is_completed │
└──────────────────────────────────────────────┘
