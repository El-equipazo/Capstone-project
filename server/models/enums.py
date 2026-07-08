"""
Canonical enums for QuantumConnect (API contract §1.4 + per-column enums).

Single source of truth: models validate against these sets rather than
hardcoding value lists in each module. Where the DB also has a CHECK
constraint (role, ratings, milestone status), these mirror it so bad input is
caught in the app layer with a clean 400 before the DB raises a 23xxx error.
"""

# Shared across engagements, expert_engagement_types, connection_requests.org_stated_need
ENGAGEMENT_TYPE = {
    "cryptographic_audit", "risk_assessment", "migration_roadmap",
    "executive_briefing", "staff_training", "ongoing_advisory",
    "compliance_review", "full_migration_support",
}

# Shared across organization_profiles.sector, expert_sector_experience.sector
SECTOR = {
    "financial", "healthcare", "government", "nonprofit",
    "legal", "energy", "education", "other",
}

USER_ROLE = {"organization", "expert", "admin"}

AVAILABILITY_STATUS = {"available", "limited", "unavailable", "booking_future"}
PROFICIENCY_LEVEL = {"familiar", "proficient", "expert", "leading_researcher"}
PREFERRED_ENGAGEMENT_LENGTH = {"short_term", "long_term", "both"}
QUANTUM_KNOWLEDGE_LEVEL = {"none", "basic", "intermediate", "advanced"}
BUDGET_RANGE = {"under_10k", "10k_50k", "50k_250k", "250k_plus", "undisclosed"}
URGENCY_LEVEL = {"just_exploring", "planning_ahead", "urgent", "critical"}

CONNECTION_STATUS = {"pending", "accepted", "declined", "expired"}
ORG_STATED_TIMELINE = {"asap", "within_3mo", "within_6mo", "within_year", "just_exploring"}

ENGAGEMENT_STATUS = {
    "scoping", "proposal_sent", "proposal_accepted",
    "active", "on_hold", "completed", "cancelled",
}
PAYMENT_STRUCTURE = {"hourly", "fixed_price", "milestone_based", "retainer"}

MILESTONE_STATUS = {"proposed", "confirmed", "in_progress", "completed", "skipped", "blocked"}
PROPOSED_BY_ROLE = {"organization", "expert"}

MESSAGE_TYPE = {"text", "file", "milestone_update", "system_event"}
# Clients may only POST these two; the rest are server-emitted.
CLIENT_MESSAGE_TYPE = {"text", "file"}

REVIEWER_ROLE = {"organization", "expert"}

VERIFICATION_TYPE = {
    "identity", "professional_credential",
    "organization_legitimacy", "background_check",
}
VERIFICATION_STATUS = {"pending", "under_review", "approved", "rejected", "expired"}

RISK_LEVEL = {"critical", "high", "medium", "low"}
HNDL_EXPOSURE = {"high", "medium", "low", "none"}
ASSESSMENT_STATUS = {"draft", "under_org_review", "finalized", "delivered"}
FINDING_SEVERITY = {"critical", "high", "medium", "low", "informational"}
RECOMMENDATION_PRIORITY = {
    "immediate", "short_term_0_6mo", "medium_term_6_18mo", "long_term_18mo_plus",
}