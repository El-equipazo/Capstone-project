// Shaped to match GET /experts and GET /experts/:expertId in api-contract.md,
// and the table/column/enum definitions in schema.md (development branch).
// Swap `src/api/client.js` for real fetch calls against the FastAPI backend later —
// every page consumes data through that module, never this file directly.

export const SPECIALIZATIONS = [
  'post_quantum_cryptography',
  'cryptographic_audit',
  'key_management',
  'pqc_migration_planning',
  'hsm_architecture',
  'quantum_risk_assessment',
]

// expert_specializations.proficiency_level enum (schema.md §2).
export const PROFICIENCY_LEVELS = ['familiar', 'proficient', 'expert', 'leading_researcher']

// expert_profiles.preferred_engagement_length enum (schema.md §1).
export const ENGAGEMENT_LENGTHS = ['short_term', 'long_term', 'both']

// Canonical `sector` enum (schema.md §3) — shared by organization_profiles.sector
// and expert_sector_experience.sector. Lattice currently only serves financial
// institutions, so this is a single-value enum rather than the full schema list.
export const SECTORS = ['financial']

// Canonical `engagement_type` enum (schema.md §3) — shared by engagements,
// expert_engagement_types, and connection_requests.org_stated_need.
export const ENGAGEMENT_TYPES = [
  'cryptographic_audit',
  'risk_assessment',
  'migration_roadmap',
  'executive_briefing',
  'staff_training',
  'ongoing_advisory',
  'compliance_review',
  'full_migration_support',
]

// Credential verification is no longer a flat boolean on expert_credentials —
// schema.md moved it to verification_records.related_credential_id. A credential
// reads as verified when an `approved` verification_records row points at it.
function isCredentialVerified(expert, credentialId) {
  return expert.verification_records.some(
    (v) => v.related_credential_id === credentialId && v.status === 'approved'
  )
}

export const mockExperts = [
  {
    expert_profile_id: 7,
    first_name: 'Sarah',
    last_name: 'Chen',
    headline: 'Post-Quantum Cryptography Specialist | NIST PQC Standards Expert',
    bio: 'Dr. Chen is a leading researcher in post-quantum cryptography with 14 years of experience advising financial institutions on NIST PQC migration strategies. Her work focuses on translating FIPS 203/204/205 into infrastructure-specific remediation plans.',
    years_of_experience: 14,
    linkedin_url: 'https://linkedin.com/in/dr-sarah-chen',
    hourly_rate_min: 350.0,
    hourly_rate_max: 500.0,
    availability_status: 'available',
    preferred_engagement_length: 'both',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.9,
    total_completed_engagements: 23,
    credentials: [
      { credential_id: 1, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2015 },
      { credential_id: 2, credential_type: 'certification', credential_name: 'ETSI QSC Contributor', institution: 'ETSI', year_obtained: 2021 },
      { credential_id: 3, credential_type: 'degree', credential_name: 'PhD, Applied Cryptography', institution: 'MIT', year_obtained: 2010 },
    ],
    verification_records: [
      { verification_id: 101, verification_type: 'professional_credential', related_credential_id: 1, status: 'approved' },
      { verification_id: 102, verification_type: 'professional_credential', related_credential_id: 2, status: 'approved' },
      { verification_id: 103, verification_type: 'professional_credential', related_credential_id: 3, status: 'approved' },
    ],
    work_history: [
      { work_history_id: 1, organization_name: 'NIST', job_title: 'Guest Researcher, Post-Quantum Cryptography Project', employment_type: 'consulting', start_date: '2019-01-01', end_date: null, is_current: true, description: 'Advises on standards-to-industry translation for FIPS 203/204/205 adoption.', order_index: 1 },
      { work_history_id: 2, organization_name: 'MIT Lincoln Laboratory', job_title: 'Senior Cryptography Researcher', employment_type: 'full_time', start_date: '2012-06-01', end_date: '2018-12-31', is_current: false, description: 'Led applied research on lattice-based cryptographic schemes.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 1, specialization: 'post_quantum_cryptography', proficiency_level: 'leading_researcher', years_in_specialization: 10 },
      { specialization_id: 2, specialization: 'cryptographic_audit', proficiency_level: 'expert', years_in_specialization: 8 },
    ],
    sector_experience: [
      { sector_exp_id: 1, sector: 'financial', years_experience_in_sector: 9, compliance_standards_known: ['PCI-DSS', 'GLBA', 'SOX', 'SWIFT CSP'], anonymized_client_examples: 'Tier-1 US bank cryptographic audit (2024); regional payment processor PQC roadmap (2023).' },
    ],
    engagement_types: [
      { eng_type_id: 1, engagement_type: 'cryptographic_audit', typical_duration_weeks_min: 4, typical_duration_weeks_max: 8, typical_budget_min: 40000, typical_budget_max: 120000, approach_description: 'Inventory-first audit against FIPS 203/204/205, prioritized by harvest-now-decrypt-later exposure.' },
      { eng_type_id: 2, engagement_type: 'migration_roadmap', typical_duration_weeks_min: 26, typical_duration_weeks_max: 52, typical_budget_min: 250000, typical_budget_max: 900000, approach_description: 'Phased migration roadmap covering key management, HSM firmware, and payment-rail signing.' },
    ],
  },
  {
    expert_profile_id: 12,
    first_name: 'Marcus',
    last_name: 'Webb',
    headline: 'PQC Migration Lead for Market Infrastructure & Clearing Systems',
    bio: 'Marcus spent 11 years at a US national laboratory building post-quantum migration playbooks before moving to independent consulting, where he now focuses on exchanges, clearinghouses, and market-infrastructure operators migrating settlement systems to post-quantum cryptography.',
    years_of_experience: 16,
    linkedin_url: 'https://linkedin.com/in/marcus-webb-pqc',
    hourly_rate_min: 275.0,
    hourly_rate_max: 400.0,
    availability_status: 'limited',
    preferred_engagement_length: 'long_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.7,
    total_completed_engagements: 15,
    credentials: [
      { credential_id: 4, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2012 },
      { credential_id: 5, credential_type: 'certification', credential_name: 'GIAC GSEC', institution: 'SANS', year_obtained: 2014 },
    ],
    verification_records: [
      { verification_id: 104, verification_type: 'professional_credential', related_credential_id: 4, status: 'approved' },
      { verification_id: 105, verification_type: 'professional_credential', related_credential_id: 5, status: 'approved' },
    ],
    work_history: [
      { work_history_id: 3, organization_name: 'Independent Consulting', job_title: 'PQC Migration Consultant', employment_type: 'consulting', start_date: '2020-01-01', end_date: null, is_current: true, description: 'Advises exchanges and clearinghouses on post-quantum migration roadmaps.', order_index: 1 },
      { work_history_id: 4, organization_name: 'Oak Ridge National Laboratory', job_title: 'Senior Research Scientist', employment_type: 'government', start_date: '2009-03-01', end_date: '2019-12-31', is_current: false, description: 'Built post-quantum migration playbooks later applied to financial market infrastructure.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 3, specialization: 'pqc_migration_planning', proficiency_level: 'expert', years_in_specialization: 9 },
      { specialization_id: 4, specialization: 'hsm_architecture', proficiency_level: 'expert', years_in_specialization: 7 },
    ],
    sector_experience: [
      { sector_exp_id: 2, sector: 'financial', years_experience_in_sector: 11, compliance_standards_known: ['SEC Reg SCI', 'CPMI-IOSCO PFMI'], anonymized_client_examples: 'Regional stock exchange PQC migration roadmap (2022–2024); clearinghouse settlement-system cryptographic audit (2023).' },
    ],
    engagement_types: [
      { eng_type_id: 3, engagement_type: 'migration_roadmap', typical_duration_weeks_min: 30, typical_duration_weeks_max: 60, typical_budget_min: 300000, typical_budget_max: 1200000, approach_description: 'Long-asset-lifecycle migration planning for legacy trading and settlement systems.' },
    ],
  },
  {
    expert_profile_id: 19,
    first_name: 'Priya',
    last_name: 'Raman',
    headline: 'Insurance & Long-Lived Records Security Advisor',
    bio: 'Priya helps insurers and retail banks protect long-lived customer financial records against harvest-now-decrypt-later risk while staying GLBA and PCI-DSS-compliant throughout migration.',
    years_of_experience: 9,
    linkedin_url: 'https://linkedin.com/in/priya-raman-security',
    hourly_rate_min: 220.0,
    hourly_rate_max: 320.0,
    availability_status: 'available',
    preferred_engagement_length: 'short_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.8,
    total_completed_engagements: 11,
    credentials: [
      { credential_id: 6, credential_type: 'certification', credential_name: 'CRISC', institution: 'ISACA', year_obtained: 2018 },
      { credential_id: 7, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2019 },
    ],
    verification_records: [
      { verification_id: 106, verification_type: 'professional_credential', related_credential_id: 6, status: 'approved' },
      { verification_id: 107, verification_type: 'professional_credential', related_credential_id: 7, status: 'pending' },
    ],
    work_history: [
      { work_history_id: 5, organization_name: 'Independent Consulting', job_title: 'Insurance Security & PQC Advisor', employment_type: 'consulting', start_date: '2021-01-01', end_date: null, is_current: true, description: 'Advises insurers and retail banks on GLBA-aligned quantum risk assessments.', order_index: 1 },
      { work_history_id: 6, organization_name: 'MetLife', job_title: 'Security Analyst', employment_type: 'full_time', start_date: '2016-06-01', end_date: '2020-12-31', is_current: false, description: 'Managed encryption inventory and compliance for policyholder data systems.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 5, specialization: 'quantum_risk_assessment', proficiency_level: 'expert', years_in_specialization: 6 },
      { specialization_id: 6, specialization: 'cryptographic_audit', proficiency_level: 'proficient', years_in_specialization: 5 },
    ],
    sector_experience: [
      { sector_exp_id: 4, sector: 'financial', years_experience_in_sector: 9, compliance_standards_known: ['GLBA', 'PCI-DSS'], anonymized_client_examples: 'Regional insurer long-lived-policyholder-record exposure assessment (2024).' },
    ],
    engagement_types: [
      { eng_type_id: 4, engagement_type: 'risk_assessment', typical_duration_weeks_min: 3, typical_duration_weeks_max: 6, typical_budget_min: 25000, typical_budget_max: 60000, approach_description: 'HNDL exposure scoring for long-lived policyholder and account records with GLBA-aligned remediation.' },
    ],
  },
  {
    expert_profile_id: 24,
    first_name: 'David',
    last_name: 'Okafor',
    headline: 'Key Management & HSM Architecture Consultant',
    bio: 'David designs hybrid classical/PQC key management architectures for payment processors and exchanges, with a focus on HSM firmware upgrade paths.',
    years_of_experience: 12,
    linkedin_url: 'https://linkedin.com/in/david-okafor',
    hourly_rate_min: 300.0,
    hourly_rate_max: 450.0,
    availability_status: 'unavailable',
    preferred_engagement_length: 'both',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.6,
    total_completed_engagements: 18,
    credentials: [
      { credential_id: 8, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2013 },
    ],
    verification_records: [
      { verification_id: 108, verification_type: 'professional_credential', related_credential_id: 8, status: 'approved' },
    ],
    work_history: [
      { work_history_id: 7, organization_name: 'Independent Consulting', job_title: 'Key Management Architect', employment_type: 'consulting', start_date: '2018-01-01', end_date: null, is_current: true, description: 'Designs hybrid classical/PQC key management systems for payment networks.', order_index: 1 },
      { work_history_id: 8, organization_name: 'Visa Inc.', job_title: 'Principal Security Engineer', employment_type: 'full_time', start_date: '2011-04-01', end_date: '2017-12-31', is_current: false, description: 'Led HSM architecture for global payment authorization systems.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 7, specialization: 'key_management', proficiency_level: 'leading_researcher', years_in_specialization: 10 },
      { specialization_id: 8, specialization: 'hsm_architecture', proficiency_level: 'expert', years_in_specialization: 9 },
    ],
    sector_experience: [
      { sector_exp_id: 5, sector: 'financial', years_experience_in_sector: 12, compliance_standards_known: ['SWIFT CSP', 'PCI-DSS'], anonymized_client_examples: 'Global payments network HSM firmware migration (2021–2023).' },
    ],
    engagement_types: [
      { eng_type_id: 5, engagement_type: 'migration_roadmap', typical_duration_weeks_min: 20, typical_duration_weeks_max: 40, typical_budget_min: 200000, typical_budget_max: 600000, approach_description: 'Hybrid classical/PQC key management rollout with zero-downtime HSM cutover.' },
    ],
  },
  {
    expert_profile_id: 31,
    first_name: 'Elena',
    last_name: 'Vasquez',
    headline: 'Central Bank & SIFI Cryptographic Compliance Lead',
    bio: 'Elena advises central banks and systemically important financial institutions on migrating classified settlement and payment infrastructure to NIST-approved post-quantum algorithms.',
    years_of_experience: 20,
    linkedin_url: 'https://linkedin.com/in/elena-vasquez-crypto',
    hourly_rate_min: 400.0,
    hourly_rate_max: 600.0,
    availability_status: 'booking_future',
    preferred_engagement_length: 'long_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 5.0,
    total_completed_engagements: 9,
    credentials: [
      { credential_id: 9, credential_type: 'certification', credential_name: 'Top Secret/SCI (inactive)', institution: 'US Government', year_obtained: 2016 },
      { credential_id: 10, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2008 },
    ],
    verification_records: [
      { verification_id: 109, verification_type: 'professional_credential', related_credential_id: 9, status: 'approved' },
      { verification_id: 110, verification_type: 'professional_credential', related_credential_id: 10, status: 'approved' },
    ],
    work_history: [
      { work_history_id: 9, organization_name: 'Independent Consulting', job_title: 'Cryptographic Compliance Advisor', employment_type: 'consulting', start_date: '2022-01-01', end_date: null, is_current: true, description: 'Advises central banks and systemically important financial institutions on CNSA 2.0-aligned migration roadmaps.', order_index: 1 },
      { work_history_id: 10, organization_name: 'National Security Agency', job_title: 'Senior Cryptographer', employment_type: 'government', start_date: '2004-01-01', end_date: '2021-12-31', is_current: false, description: '20-year career in classified communications cryptography, later applied to financial-sector settlement infrastructure.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 9, specialization: 'post_quantum_cryptography', proficiency_level: 'leading_researcher', years_in_specialization: 12 },
      { specialization_id: 10, specialization: 'pqc_migration_planning', proficiency_level: 'expert', years_in_specialization: 8 },
    ],
    sector_experience: [
      { sector_exp_id: 6, sector: 'financial', years_experience_in_sector: 20, compliance_standards_known: ['FIPS 140-3', 'CNSA 2.0'], anonymized_client_examples: 'Central bank real-time gross settlement system PQC migration roadmap (2023–ongoing).' },
    ],
    engagement_types: [
      { eng_type_id: 6, engagement_type: 'migration_roadmap', typical_duration_weeks_min: 40, typical_duration_weeks_max: 80, typical_budget_min: 500000, typical_budget_max: 2000000, approach_description: 'CNSA 2.0-aligned migration roadmap for classified settlement and payment infrastructure.' },
    ],
  },
  {
    expert_profile_id: 38,
    first_name: 'James',
    last_name: 'Park',
    headline: 'Compliance-Focused PQC Auditor for Insurers',
    bio: 'James specializes in translating post-quantum cryptographic risk into language regulators and auditors understand, for insurers holding decades of policyholder data.',
    years_of_experience: 7,
    linkedin_url: 'https://linkedin.com/in/james-park-audit',
    hourly_rate_min: 200.0,
    hourly_rate_max: 300.0,
    availability_status: 'available',
    preferred_engagement_length: 'short_term',
    is_verified: false,
    verification_status: 'pending',
    avg_rating: null,
    total_completed_engagements: 2,
    credentials: [
      { credential_id: 11, credential_type: 'certification', credential_name: 'CISA', institution: 'ISACA', year_obtained: 2020 },
    ],
    verification_records: [
      { verification_id: 111, verification_type: 'professional_credential', related_credential_id: 11, status: 'pending' },
    ],
    work_history: [
      { work_history_id: 11, organization_name: 'Independent Consulting', job_title: 'PQC Compliance Auditor', employment_type: 'consulting', start_date: '2023-01-01', end_date: null, is_current: true, description: 'Translates cryptographic risk into regulator-facing compliance language for insurers.', order_index: 1 },
      { work_history_id: 12, organization_name: 'Deloitte', job_title: 'Cybersecurity Consultant', employment_type: 'full_time', start_date: '2019-06-01', end_date: '2022-12-31', is_current: false, description: 'Performed encryption and compliance audits for mid-size financial clients.', order_index: 2 },
    ],
    specializations: [
      { specialization_id: 11, specialization: 'cryptographic_audit', proficiency_level: 'proficient', years_in_specialization: 4 },
    ],
    sector_experience: [
      { sector_exp_id: 7, sector: 'financial', years_experience_in_sector: 5, compliance_standards_known: ['NAIC', 'GLBA'], anonymized_client_examples: 'Mid-size insurer encryption inventory review (2024).' },
    ],
    engagement_types: [
      { eng_type_id: 7, engagement_type: 'compliance_review', typical_duration_weeks_min: 2, typical_duration_weeks_max: 4, typical_budget_min: 15000, typical_budget_max: 35000, approach_description: 'Encryption-inventory-to-compliance-framework gap analysis.' },
    ],
  },
]

// Precompute each credential's verified status from verification_records now
// that expert_credentials no longer carries its own is_admin_verified flag.
for (const expert of mockExperts) {
  for (const credential of expert.credentials) {
    credential.is_verified = isCredentialVerified(expert, credential.credential_id)
  }
}
