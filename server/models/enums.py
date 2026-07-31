"""
Canonical enums for QuantumConnect (API contract §1.4 + per-column enums).

Single source of truth: models validate against these sets rather than
hardcoding value lists in each module. Where the DB also has a CHECK
constraint (role, ratings, milestone status), these mirror it so bad input is
caught in the app layer with a clean 400 before the DB raises a 23xxx error.
"""

from enum import Enum

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


class ConnectionStatus(str, Enum):
    """Named constants for connection_requests.status so code references the
    canonical value instead of a bare string literal (a typo becomes an
    AttributeError at import, not a silently-wrong query). Subclasses str so
    instances compare/serialize as their value and drop straight into SQL."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"

    def __str__(self) -> str:
        # Enum overrides str.__str__ to 'ClassName.MEMBER'; restore the value
        # so f-strings and log messages render 'pending', not
        # 'ConnectionStatus.PENDING'. (StrEnum does this natively on 3.11+,
        # but this works on every version.)
        return self.value


# Validation set, derived from the enum so the two can't drift apart.
CONNECTION_STATUS = {s.value for s in ConnectionStatus}
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

# Scoped to what's actually emitted today -- not the contract's full
# aspirational list, since reviews/verification notifications belong to
# features that don't exist yet.
NOTIFICATION_TYPE = {
    "message_received",
    "connection_request_received", "connection_accepted", "connection_declined",
    "milestone_change_proposed", "milestone_change_confirmed", "milestone_change_declined",
    "milestone_proposed",
    "organization_deleted",
}

# A milestone can have at most one outstanding org-proposed change at a time
# (a reschedule/deliverable edit, or a cancellation request) awaiting the
# expert's response -- see engagement_milestones.pending_action.
MILESTONE_PENDING_ACTION = {"change", "cancel"}

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