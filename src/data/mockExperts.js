// Shaped to match GET /experts and GET /experts/:expertId in api-contract.md.
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

export const SECTORS = ['financial', 'healthcare', 'government', 'critical_infrastructure']

export const ENGAGEMENT_TYPES = [
  'cryptographic_audit',
  'full_pq_migration',
  'risk_assessment',
  'compliance_review',
]

export const mockExperts = [
  {
    expert_profile_id: 7,
    first_name: 'Sarah',
    last_name: 'Chen',
    headline: 'Post-Quantum Cryptography Specialist | NIST PQC Standards Expert',
    bio: 'Dr. Chen is a leading researcher in post-quantum cryptography with 14 years of experience advising financial institutions and government agencies on NIST PQC migration strategies. Her work focuses on translating FIPS 203/204/205 into infrastructure-specific remediation plans.',
    years_of_experience: 14,
    linkedin_url: 'https://linkedin.com/in/dr-sarah-chen',
    hourly_rate_min: 350.0,
    hourly_rate_max: 500.0,
    availability_status: 'available',
    avg_response_time_hours: 4,
    preferred_engagement_length: 'both',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.9,
    total_completed_engagements: 23,
    credentials: [
      { credential_id: 1, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2015, is_admin_verified: true },
      { credential_id: 2, credential_type: 'certification', credential_name: 'ETSI QSC Contributor', institution: 'ETSI', year_obtained: 2021, is_admin_verified: true },
      { credential_id: 3, credential_type: 'phd', credential_name: 'PhD, Applied Cryptography', institution: 'MIT', year_obtained: 2010, is_admin_verified: true },
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
      { eng_type_id: 2, engagement_type: 'full_pq_migration', typical_duration_weeks_min: 26, typical_duration_weeks_max: 52, typical_budget_min: 250000, typical_budget_max: 900000, approach_description: 'Phased migration roadmap covering key management, HSM firmware, and payment-rail signing.' },
    ],
  },
  {
    expert_profile_id: 12,
    first_name: 'Marcus',
    last_name: 'Webb',
    headline: 'PQC Migration Lead, ex-National Laboratory',
    bio: 'Marcus spent 11 years at a US national laboratory building post-quantum migration playbooks for critical infrastructure operators before moving to independent consulting.',
    years_of_experience: 16,
    linkedin_url: 'https://linkedin.com/in/marcus-webb-pqc',
    hourly_rate_min: 275.0,
    hourly_rate_max: 400.0,
    availability_status: 'limited',
    avg_response_time_hours: 8,
    preferred_engagement_length: 'long_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.7,
    total_completed_engagements: 15,
    credentials: [
      { credential_id: 4, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2012, is_admin_verified: true },
      { credential_id: 5, credential_type: 'certification', credential_name: 'GIAC GSEC', institution: 'SANS', year_obtained: 2014, is_admin_verified: true },
    ],
    specializations: [
      { specialization_id: 3, specialization: 'pqc_migration_planning', proficiency_level: 'expert', years_in_specialization: 9 },
      { specialization_id: 4, specialization: 'hsm_architecture', proficiency_level: 'expert', years_in_specialization: 7 },
    ],
    sector_experience: [
      { sector_exp_id: 2, sector: 'critical_infrastructure', years_experience_in_sector: 11, compliance_standards_known: ['NERC CIP', 'IEC 62443'], anonymized_client_examples: 'Regional energy grid operator PQC migration roadmap (2022–2024).' },
      { sector_exp_id: 3, sector: 'government', years_experience_in_sector: 6, compliance_standards_known: ['FIPS 140-3', 'NIST 800-53'], anonymized_client_examples: 'Federal agency legacy PKI migration assessment.' },
    ],
    engagement_types: [
      { eng_type_id: 3, engagement_type: 'full_pq_migration', typical_duration_weeks_min: 30, typical_duration_weeks_max: 60, typical_budget_min: 300000, typical_budget_max: 1200000, approach_description: 'Long-asset-lifecycle migration planning for OT/IT hybrid environments.' },
    ],
  },
  {
    expert_profile_id: 19,
    first_name: 'Priya',
    last_name: 'Raman',
    headline: 'Healthcare Data Security & PQC Compliance Advisor',
    bio: 'Priya helps hospital systems and health insurers protect long-lived patient records against harvest-now-decrypt-later risk while staying HIPAA-compliant throughout migration.',
    years_of_experience: 9,
    linkedin_url: 'https://linkedin.com/in/priya-raman-security',
    hourly_rate_min: 220.0,
    hourly_rate_max: 320.0,
    availability_status: 'available',
    avg_response_time_hours: 6,
    preferred_engagement_length: 'short_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.8,
    total_completed_engagements: 11,
    credentials: [
      { credential_id: 6, credential_type: 'certification', credential_name: 'HCISPP', institution: 'ISC2', year_obtained: 2018, is_admin_verified: true },
      { credential_id: 7, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2019, is_admin_verified: false },
    ],
    specializations: [
      { specialization_id: 5, specialization: 'quantum_risk_assessment', proficiency_level: 'expert', years_in_specialization: 6 },
      { specialization_id: 6, specialization: 'cryptographic_audit', proficiency_level: 'proficient', years_in_specialization: 5 },
    ],
    sector_experience: [
      { sector_exp_id: 4, sector: 'healthcare', years_experience_in_sector: 9, compliance_standards_known: ['HIPAA', 'HITRUST'], anonymized_client_examples: 'Regional hospital system long-lived-record exposure assessment (2024).' },
    ],
    engagement_types: [
      { eng_type_id: 4, engagement_type: 'risk_assessment', typical_duration_weeks_min: 3, typical_duration_weeks_max: 6, typical_budget_min: 25000, typical_budget_max: 60000, approach_description: 'HNDL exposure scoring for long-lived patient records with HIPAA-aligned remediation.' },
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
    avg_response_time_hours: 12,
    preferred_engagement_length: 'both',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 4.6,
    total_completed_engagements: 18,
    credentials: [
      { credential_id: 8, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2013, is_admin_verified: true },
    ],
    specializations: [
      { specialization_id: 7, specialization: 'key_management', proficiency_level: 'leading_researcher', years_in_specialization: 10 },
      { specialization_id: 8, specialization: 'hsm_architecture', proficiency_level: 'expert', years_in_specialization: 9 },
    ],
    sector_experience: [
      { sector_exp_id: 5, sector: 'financial', years_experience_in_sector: 12, compliance_standards_known: ['SWIFT CSP', 'PCI-DSS'], anonymized_client_examples: 'Global payments network HSM firmware migration (2021–2023).' },
    ],
    engagement_types: [
      { eng_type_id: 5, engagement_type: 'full_pq_migration', typical_duration_weeks_min: 20, typical_duration_weeks_max: 40, typical_budget_min: 200000, typical_budget_max: 600000, approach_description: 'Hybrid classical/PQC key management rollout with zero-downtime HSM cutover.' },
    ],
  },
  {
    expert_profile_id: 31,
    first_name: 'Elena',
    last_name: 'Vasquez',
    headline: 'Government & Defense Cryptographic Compliance Lead',
    bio: 'Elena advises government agencies on migrating classified communications infrastructure to NIST-approved post-quantum algorithms.',
    years_of_experience: 20,
    linkedin_url: 'https://linkedin.com/in/elena-vasquez-crypto',
    hourly_rate_min: 400.0,
    hourly_rate_max: 600.0,
    availability_status: 'limited',
    avg_response_time_hours: 24,
    preferred_engagement_length: 'long_term',
    is_verified: true,
    verification_status: 'verified',
    avg_rating: 5.0,
    total_completed_engagements: 9,
    credentials: [
      { credential_id: 9, credential_type: 'clearance', credential_name: 'Top Secret/SCI (inactive)', institution: 'US Government', year_obtained: 2016, is_admin_verified: true },
      { credential_id: 10, credential_type: 'certification', credential_name: 'CISSP', institution: 'ISC2', year_obtained: 2008, is_admin_verified: true },
    ],
    specializations: [
      { specialization_id: 9, specialization: 'post_quantum_cryptography', proficiency_level: 'leading_researcher', years_in_specialization: 12 },
      { specialization_id: 10, specialization: 'pqc_migration_planning', proficiency_level: 'expert', years_in_specialization: 8 },
    ],
    sector_experience: [
      { sector_exp_id: 6, sector: 'government', years_experience_in_sector: 20, compliance_standards_known: ['FIPS 140-3', 'CNSA 2.0'], anonymized_client_examples: 'Federal agency classified-comms PQC migration roadmap (2023–ongoing).' },
    ],
    engagement_types: [
      { eng_type_id: 6, engagement_type: 'full_pq_migration', typical_duration_weeks_min: 40, typical_duration_weeks_max: 80, typical_budget_min: 500000, typical_budget_max: 2000000, approach_description: 'CNSA 2.0-aligned migration roadmap for classified communications infrastructure.' },
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
    avg_response_time_hours: 3,
    preferred_engagement_length: 'short_term',
    is_verified: false,
    verification_status: 'pending',
    avg_rating: null,
    total_completed_engagements: 2,
    credentials: [
      { credential_id: 11, credential_type: 'certification', credential_name: 'CISA', institution: 'ISACA', year_obtained: 2020, is_admin_verified: false },
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

// Only verified experts are ever returned to non-admins per api-contract.md §5.
export const verifiedMockExperts = mockExperts.filter((e) => e.is_verified)
