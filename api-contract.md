# QuantumConnect — API Contract (v2)

REST API contract mapped to the current schema (Identity & Auth, Profiles & Discovery, Matching, Engagements, Communication, Trust & Reviews, Risk Assessment).

---

## 1. Conventions

**Base URL:** `https://api.quantumconnect.io/api/v1`

**Content type:** `application/json` for all requests and responses, except file upload endpoints which use `multipart/form-data`.

**Authentication:** JWT Bearer tokens.

```
Authorization: Bearer <access_token>
```

**Roles:** `organization` | `expert` | `admin`. Every endpoint below lists which roles may call it. `Auth: Public` means no token required.

**Timestamps:** ISO 8601 UTC (`2026-07-06T14:30:00Z`).

**IDs:** Integers (SERIAL PKs from the schema).

### 1.1 Standard error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "hourly_rate_min must be less than hourly_rate_max",
    "details": [
      { "field": "hourly_rate_min", "issue": "must be <= hourly_rate_max" }
    ]
  }
}
```

### 1.2 Status codes

| Code | Meaning                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 200  | OK (read / update succeeded)                                                                                              |
| 201  | Created                                                                                                                   |
| 204  | No Content (delete succeeded)                                                                                             |
| 400  | Validation error / malformed request                                                                                      |
| 401  | Missing or invalid token                                                                                                  |
| 403  | Authenticated but not permitted (wrong role or not resource owner)                                                        |
| 404  | Resource not found                                                                                                        |
| 409  | Conflict (duplicate email, duplicate open connection request, duplicate review, engagement already exists for connection) |
| 410  | Gone (connection request expired, document access expired/revoked)                                                        |
| 422  | Semantically invalid (e.g. invalid status transition)                                                                     |
| 429  | Rate limited                                                                                                              |

### 1.3 Pagination, sorting, filtering

List endpoints accept:

```
?page=1&limit=20&sort=created_at&order=desc
```

Paginated responses use this envelope:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 143,
    "total_pages": 8
  }
}
```

### 1.4 Canonical enums

Two enums are shared across multiple resources — referenced throughout this contract instead of repeating the value lists.

**`engagement_type`** (used by `engagements.engagement_type`, `expert_engagement_types.engagement_type`, and `connection_requests.org_stated_need`):

```
cryptographic_audit | risk_assessment | migration_roadmap | executive_briefing |
staff_training | ongoing_advisory | compliance_review | full_migration_support
```

**`sector`** (used by `organization_profiles.sector` and `expert_sector_experience.sector`):

```
financial | healthcare | government | nonprofit | legal | energy | education | other
```

---

## 2. Auth & Identity (`users`)

### POST /auth/register

Create an account with a role. — **Auth: Public**

Request:

```json
{
  "email": "rob.otter@jpmc.com",
  "password": "S3curePassw0rd!",
  "role": "organization"
}
```

Response `201`:

```json
{
  "user_id": 42,
  "email": "rob.otter@jpmc.com",
  "role": "organization",
  "is_email_verified": false,
  "created_at": "2026-07-06T14:30:00Z"
}
```

Errors: `409` email already registered · `400` invalid role / weak password.

### POST /auth/verify-email

**Auth: Public.** Body: `{ "token": "<email_verification_token>" }` → `200 { "is_email_verified": true }`

### POST /auth/login

**Auth: Public**

Request:

```json
{ "email": "rob.otter@jpmc.com", "password": "S3curePassw0rd!" }
```

Response `200` (also updates `last_login_at`):

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "def502...",
  "expires_in": 3600,
  "user": {
    "user_id": 42,
    "email": "rob.otter@jpmc.com",
    "role": "organization"
  }
}
```

Errors: `401` bad credentials · `403` account deactivated (`is_active = false`).

### POST /auth/refresh

**Auth: Public.** Body: `{ "refresh_token": "..." }` → `200` new token pair.

### POST /auth/logout

**Auth: Any role.** Invalidates the refresh token. → `204`

### GET /auth/me

**Auth: Any role.** Returns the current `users` row (minus `password_hash`) plus the attached profile (`organization_profile` or `expert_profile`) if one exists.

### PATCH /auth/me

**Auth: Any role.** Update `email` (re-triggers verification) or `password` (requires `current_password`). → `200`

### DELETE /auth/me

**Auth: Any role.** Soft-deactivate (`is_active = false`). → `204`

---

## 3. Organization Profiles

### POST /organizations

Create the org profile for the current user (1:1 with `users`). — **Auth: organization**

Request:

```json
{
  "org_name": "JPMorgan Chase",
  "contact_name": "Rob Otter",
  "contact_title": "Head of Global Technology Applied Research",
  "sector": "financial",
  "sub_sector": "banking",
  "founded_year": 1799,
  "employee_count_range": ">10k",
  "country": "US",
  "state_province": "NY",
  "website": "https://jpmorganchase.com",
  "org_description": "Global financial services firm.",
  "quantum_knowledge_level": "advanced",
  "budget_range": "250k_plus",
  "urgency_level": "urgent",
  "default_connection_expiry_days": 30
}
```

`sector` must be one of the canonical `sector` enum values (§1.4).

Response `201`: full `organization_profiles` row (`is_verified: false` until admin verification).
Errors: `409` profile already exists for user · `400` invalid enum value.

### GET /organizations/:orgId

**Auth: Any role.** Public fields only for non-owners; owner and admin see everything.

### PATCH /organizations/:orgId

**Auth: organization (owner) or admin.** Partial update of any mutable field. → `200`

### PUT /organizations/:orgId/infrastructure

Create or replace the org's infrastructure record (1:1, `organization_infrastructure`). — **Auth: organization (owner)**

Request:

```json
{
  "data_categories": ["transaction_records", "customer_pii"],
  "storage_type": "hybrid",
  "primary_cloud_providers": ["AWS", "Azure"],
  "current_encryption_standards": ["RSA-2048", "AES-256"],
  "data_retention_years": 25,
  "oldest_system_age_years": 30,
  "compliance_requirements": ["PCI-DSS", "SOX", "GLBA"],
  "has_dedicated_security_team": true,
  "had_prior_quantum_assessment": false,
  "known_risks_freetext": "Legacy mainframe payment rails on RSA-2048."
}
```

Response `200` / `201`.

### GET /organizations/:orgId/infrastructure

**Auth: org owner, admin, or an expert with an `accepted` connection / active engagement with this org** (infrastructure is sensitive — it is _not_ public). Otherwise `403`.

---

## 4. Expert Profiles & Sub-resources

### POST /experts

Create expert profile for the current user. — **Auth: expert**

Request (abridged):

```json
{
  "first_name": "Dustin",
  "last_name": "Moody",
  "headline": "Post-Quantum Cryptography Standards Lead",
  "bio": "Led NIST PQC standardization since 2016...",
  "years_of_experience": 15,
  "hourly_rate_min": 300.0,
  "hourly_rate_max": 500.0,
  "availability_status": "limited",
  "preferred_engagement_length": "both"
}
```

Response `201`. `verification_status` starts as `unsubmitted`; `avg_rating` and `total_completed_engagements` are server-computed and read-only.

### GET /experts/:expertId

**Auth: Any role.** Full public profile including nested sub-resources:

```json
{
  "expert_profile_id": 7,
  "first_name": "Dustin",
  "last_name": "Moody",
  "headline": "Post-Quantum Cryptography Standards Lead",
  "availability_status": "limited",
  "hourly_rate_min": 300.00,
  "hourly_rate_max": 500.00,
  "is_verified": true,
  "avg_rating": 4.85,
  "total_completed_engagements": 12,
  "credentials": [ ... ],
  "work_history": [ ... ],
  "specializations": [ ... ],
  "sector_experience": [ ... ],
  "engagement_types": [ ... ]
}
```

### PATCH /experts/:expertId

**Auth: expert (owner) or admin.** → `200`

### Credentials (`expert_credentials`)

| Method & Path                                         | Auth           | Notes                                                                                                                                |
| ----------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /experts/:expertId/credentials`                 | expert (owner) | Body: `credential_type`, `credential_name`, `institution`, `year_obtained`, `expiry_date?`, `verification_url?` → `201`              |
| `GET /experts/:expertId/credentials`                  | any            | Each item includes a derived `is_verified` (true if it has a linked `verification_records` row with `status = 'approved'`) — see §9  |
| `PATCH /experts/:expertId/credentials/:credentialId`  | expert (owner) | Editing a credential does not touch its verification status; a materially changed credential should be re-submitted for verification |
| `DELETE /experts/:expertId/credentials/:credentialId` | expert (owner) | Cascades to any linked `verification_records` row → `204`                                                                            |

> Credential verification is no longer a direct admin toggle on this resource — see `POST /verifications` in §9. `GET` responses derive `is_verified` from the linked verification record rather than storing it locally.

### Work History (`expert_work_history`)

| Method & Path                                           | Auth           | Notes                                                  |
| ------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| `POST /experts/:expertId/work-history`                  | expert (owner) | → `201`                                                |
| `GET /experts/:expertId/work-history`                   | any            | Sorted by `order_index` if set, else `start_date DESC` |
| `PATCH /experts/:expertId/work-history/:workHistoryId`  | expert (owner) | Setting `is_current = true` should null out `end_date` |
| `DELETE /experts/:expertId/work-history/:workHistoryId` | expert (owner) | → `204`                                                |

POST body:

```json
{
  "organization_name": "National Institute of Standards and Technology (NIST)",
  "job_title": "Mathematician, Post-Quantum Cryptography Project Lead",
  "employment_type": "government",
  "start_date": "2016-01-01",
  "is_current": true,
  "description": "Leading NIST's PQC standardization effort since 2016."
}
```

### Specializations (`expert_specializations`)

| Method & Path                                                 | Auth           |
| ------------------------------------------------------------- | -------------- |
| `POST /experts/:expertId/specializations`                     | expert (owner) |
| `GET /experts/:expertId/specializations`                      | any            |
| `PATCH /experts/:expertId/specializations/:specializationId`  | expert (owner) |
| `DELETE /experts/:expertId/specializations/:specializationId` | expert (owner) |

POST body:

```json
{
  "specialization": "post_quantum_cryptography",
  "proficiency_level": "leading_researcher",
  "years_in_specialization": 10
}
```

### Sector experience (`expert_sector_experience`)

Same CRUD pattern at `/experts/:expertId/sector-experience[/:sectorExpId]`.

POST body:

```json
{
  "sector": "financial",
  "years_experience_in_sector": 8,
  "compliance_standards_known": ["PCI-DSS", "SOX"],
  "anonymized_client_examples": "Tier-1 US bank cryptographic audit (2024)."
}
```

`sector` must be one of the canonical `sector` enum values (§1.4) — the same enum used by `organization_profiles.sector`, so sector-based search and matching stay consistent.

### Engagement types offered (`expert_engagement_types`)

Same CRUD pattern at `/experts/:expertId/engagement-types[/:engTypeId]`.

POST body:

```json
{
  "engagement_type": "cryptographic_audit",
  "typical_duration_weeks_min": 4,
  "typical_duration_weeks_max": 8,
  "typical_budget_min": 40000.0,
  "typical_budget_max": 120000.0,
  "approach_description": "Inventory-first audit against FIPS 203/204/205."
}
```

`engagement_type` must be one of the canonical `engagement_type` enum values (§1.4).

---

## 5. Discovery (Search)

### GET /experts

Search/filter the directory. — **Auth: Any role** (only `is_verified = true` experts are returned to non-admins). Note: this domain is a stretch feature — see §6 — but the underlying directory/search endpoint is core to the MVP.

Query parameters:

| Param                  | Type                             | Example                                    |
| ---------------------- | -------------------------------- | ------------------------------------------ |
| `q`                    | text search on name/headline/bio | `q=lattice`                                |
| `specialization`       | repeatable enum                  | `specialization=post_quantum_cryptography` |
| `proficiency_min`      | enum floor                       | `proficiency_min=expert`                   |
| `sector`               | canonical `sector` enum          | `sector=financial`                         |
| `compliance`           | repeatable                       | `compliance=PCI-DSS`                       |
| `engagement_type`      | canonical `engagement_type` enum | `engagement_type=cryptographic_audit`      |
| `availability`         | enum                             | `availability=available`                   |
| `rate_max`             | number                           | `rate_max=400`                             |
| `rating_min`           | number 1–5                       | `rating_min=4`                             |
| `years_experience_min` | integer                          | `years_experience_min=5`                   |

Response `200`: paginated envelope of expert profile summaries (card view: name, headline, top specializations, sectors, rate range, availability, rating, verified badge).

---

## 6. Matching (stretch feature)

`connection_requests` and `match_scoring_factors`. Fully specified here since the schema supports it, but treat this domain as cuttable under time pressure per the project's user stories.

### POST /connections

Org initiates a connection request to an expert. Server computes `match_score` and its factor breakdown, and sets `expires_at` from the org's `default_connection_expiry_days`. — **Auth: organization**

Request:

```json
{
  "expert_id": 7,
  "initial_message": "We need an independent audit of our payment rails.",
  "org_stated_need": "cryptographic_audit",
  "org_stated_timeline": "within_3mo"
}
```

`org_stated_need` must be one of the canonical `engagement_type` enum values (§1.4), or omitted/`null` to mean "not sure."

Response `201`:

```json
{
  "connection_id": 501,
  "org_id": 12,
  "expert_id": 7,
  "initiated_by_user_id": 42,
  "status": "pending",
  "match_score": 87.5,
  "expires_at": "2026-08-05T14:30:00Z",
  "created_at": "2026-07-06T14:30:00Z"
}
```

Errors: `409` an open (`pending`) request to this expert already exists for this org — enforced by a DB-level unique partial index, not just app logic · `422` expert `availability_status = unavailable`.

### GET /connections

List the current user's connection requests (org sees sent; expert sees received). — **Auth: organization | expert**
Filters: `?status=pending&expert_id=7&org_id=12`.

### GET /connections/:connectionId

**Auth: participant (org side or expert side) or admin.**

### GET /connections/:connectionId/score-factors

Match score breakdown (`match_scoring_factors`). — **Auth: participant or admin**

Response `200`:

```json
{
  "connection_id": 501,
  "match_score": 87.5,
  "factors": [
    {
      "factor_name": "sector_match",
      "weight": 0.3,
      "raw_score": 100.0,
      "weighted_contribution": 30.0
    },
    {
      "factor_name": "compliance_overlap",
      "weight": 0.25,
      "raw_score": 90.0,
      "weighted_contribution": 22.5
    },
    {
      "factor_name": "budget_fit",
      "weight": 0.2,
      "raw_score": 75.0,
      "weighted_contribution": 15.0
    },
    {
      "factor_name": "availability_fit",
      "weight": 0.25,
      "raw_score": 80.0,
      "weighted_contribution": 20.0
    }
  ]
}
```

The server writes all factor rows for a connection in a single transaction — the DB enforces that their weights sum to 1.00 before the transaction commits, so this endpoint should never return a set of factors with an inconsistent total.

### PATCH /connections/:connectionId

Expert responds. — **Auth: expert (recipient)**

Request: `{ "status": "accepted" }` or `{ "status": "declined" }`

Response `200` (sets `responded_at`).
Errors: `410` request already expired · `422` not in `pending` state.

> `expired` status is set by a scheduled job when `NOW() > expires_at` and status is still `pending`. Clients never set it directly.

---

## 7. Engagements & Milestones

### POST /engagements

Create an engagement from an **accepted** connection (1:1 — `connection_id` is UNIQUE). — **Auth: organization or expert (participant of the connection)**

Request:

```json
{
  "connection_id": 501,
  "engagement_type": "cryptographic_audit",
  "title": "Payment infrastructure PQC audit",
  "description": "Audit of RSA-2048 dependencies across payment rails.",
  "payment_structure": "milestone_based",
  "agreed_budget": 95000.0,
  "start_date": "2026-08-01",
  "estimated_end_date": "2026-10-01"
}
```

`engagement_type` must be one of the canonical `engagement_type` enum values (§1.4). Milestones are added separately after creation (see below) — there is no template to clone from; the frontend is responsible for offering starting-point structures if desired.

Response `201`: full engagement row, `status: "scoping"`.
Errors: `409` engagement already exists for this connection · `422` connection not `accepted`.

### GET /engagements

List the current user's engagements. — **Auth: organization | expert | admin**
Filters: `?status=active&engagement_type=cryptographic_audit`.

### GET /engagements/:engagementId

**Auth: participant or admin.** Includes nested milestones.

### PATCH /engagements/:engagementId

Update mutable fields or transition status. — **Auth: participant** (role rules below)

Request: `{ "status": "proposal_sent" }` or field updates.

Allowed status transitions:

```
scoping → proposal_sent            (expert)
proposal_sent → proposal_accepted  (organization)
proposal_accepted → active         (either)
active ↔ on_hold                   (either)
active → completed                 (expert; sets actual_end_date,
                                    increments expert total_completed_engagements)
any non-terminal → cancelled       (either; cancellation_reason required)
```

Errors: `422` illegal transition · `400` cancelling without `cancellation_reason`.

### Milestones (`engagement_milestones`)

Either party can propose a milestone, but the expert always has final say on scope and timeline.

| Method & Path                                                     | Auth                                                                                                                              | Notes                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /engagements/:engagementId/milestones`                      | organization or expert (participant)                                                                                              | See body/behavior below → `201`                                                                                      |
| `GET /engagements/:engagementId/milestones`                       | participant                                                                                                                       | Ordered by `order_index`                                                                                             |
| `PATCH /engagements/:engagementId/milestones/:milestoneId`        | expert (participant): any field · organization (participant): `due_date`/`description` only, and only while `status = 'proposed'` |                                                                                                                      |
| `POST /engagements/:engagementId/milestones/:milestoneId/confirm` | expert (participant)                                                                                                              | Moves an org-proposed milestone from `proposed` → `confirmed`; sets `confirmed_by_expert_id`, `confirmed_at` → `200` |
| `POST /engagements/:engagementId/milestones/:milestoneId/approve` | organization (participant)                                                                                                        | Only when `requires_client_approval = true` and `status = 'completed'`; sets `client_approved_at` → `200`            |
| `DELETE /engagements/:engagementId/milestones/:milestoneId`       | expert (participant)                                                                                                              | Only while engagement is `scoping`/`proposal_sent` → `204`                                                           |

POST body:

```json
{
  "title": "Encryption inventory review",
  "description": "Catalog all cryptographic dependencies across payment rails.",
  "order_index": 1,
  "due_date": "2026-08-15",
  "deliverable_description": "Spreadsheet inventory + risk flags.",
  "requires_client_approval": true
}
```

`proposed_by_user_id` and `proposed_by_role` are set server-side from the caller. **Behavior:** if the caller is the expert, the milestone is created with `status = 'confirmed'` immediately (`confirmed_by_expert_id`/`confirmed_at` set to the expert/now). If the caller is the organization, it's created with `status = 'proposed'` and cannot advance to `in_progress` until the expert calls the `confirm` endpoint (optionally editing it first).

Status values: `proposed` | `confirmed` | `in_progress` | `completed` | `skipped` | `blocked`.
Errors: `422` attempting to move a `proposed` milestone to `in_progress` without confirming first · `403` organization attempting to set fields other than `due_date`/`description`, or attempting to confirm.

---

## 8. Communication

### Messages (`messages`)

#### GET /engagements/:engagementId/messages

**Auth: participant.** Paginated, newest first. Filter: `?unread=true`.

#### POST /engagements/:engagementId/messages

**Auth: participant.**

Request (text):

```json
{
  "message_type": "text",
  "content": "Encryption inventory uploaded — see documents tab."
}
```

Request (file message): a file message references an already-uploaded document rather than carrying its own file fields. Upload the file first via `POST /engagements/:engagementId/documents` (§8, Secure documents), then create the message pointing at it:

```json
{
  "message_type": "file",
  "content": "Network diagram attached.",
  "document_id": 77
}
```

Response `201`. `content` is encrypted at rest server-side; API always returns plaintext to authorized participants. When `message_type = "file"`, the response includes the resolved document metadata (`document_name`, `document_type`, `file_size_bytes`) alongside `document_id` so clients don't need a second round-trip.

Errors: `400` `message_type = "file"` without `document_id`, or `document_id` referencing a document outside this engagement.

> `milestone_update` and `system_event` message types are emitted by the server only (e.g. on milestone completion) — clients cannot POST them.

#### POST /engagements/:engagementId/messages/read

Mark messages read. — **Auth: participant.** Body: `{ "message_ids": [901, 902] }` or `{ "all": true }` → `200 { "updated": 2 }`

### Secure documents (`secure_document_shares`)

#### POST /engagements/:engagementId/documents

`multipart/form-data`: `file`, `document_name`, `document_type`, `access_expires_at?` — **Auth: participant**

Response `201`:

```json
{
  "document_id": 77,
  "engagement_id": 300,
  "uploaded_by_id": 42,
  "document_name": "Encryption inventory Q2",
  "document_type": "encryption_inventory",
  "file_size_bytes": 1048576,
  "checksum_sha256": "9f86d08...",
  "access_expires_at": "2026-10-01T00:00:00Z",
  "is_revoked": false,
  "created_at": "2026-07-06T15:00:00Z"
}
```

#### GET /engagements/:engagementId/documents

**Auth: participant.** List metadata (never raw `storage_url`).

#### GET /engagements/:engagementId/documents/:documentId/download

**Auth: participant.** Returns a short-lived presigned URL; sets `first_accessed_at` on first call.

```json
{ "download_url": "https://...&expires=300", "expires_in_seconds": 300 }
```

Errors: `410` revoked or past `access_expires_at`.

#### POST /engagements/:engagementId/documents/:documentId/revoke

**Auth: uploader or admin.** Sets `is_revoked = true`, `revoked_at`. → `200`

> Revoking a document does not delete the `messages` rows that reference it via `document_id`; the message stays in history but its attachment becomes inaccessible (client should render it as "revoked").

### Notifications (`notifications`)

| Method & Path                          | Auth  | Notes                    |
| -------------------------------------- | ----- | ------------------------ |
| `GET /notifications?is_read=false`     | any   | Paginated, newest first  |
| `GET /notifications/unread-count`      | any   | `{ "count": 4 }`         |
| `PATCH /notifications/:notificationId` | owner | `{ "is_read": true }`    |
| `POST /notifications/read-all`         | owner | → `200 { "updated": 4 }` |

Notification objects:

```json
{
  "notification_id": 1201,
  "type": "connection_request_received",
  "title": "New connection request",
  "body": "JPMorgan Chase sent you a connection request.",
  "related_entity_type": "connection_request",
  "related_entity_id": 501,
  "action_url": "/connections/501",
  "is_read": false,
  "created_at": "2026-07-06T14:30:01Z"
}
```

> Notifications are server-generated only (connection received/responded, message received, milestone proposed/confirmed/completed, review received, verification decision). No client POST endpoint.

---

## 9. Trust & Reviews

### POST /engagements/:engagementId/reviews

Leave a review after completion. — **Auth: participant.** One review per side (max 2 per engagement — enforced by a DB unique constraint on `(engagement_id, reviewer_role)`).

Request:

```json
{
  "overall_rating": 5,
  "communication_rating": 5,
  "expertise_rating": 5,
  "timeliness_rating": 4,
  "value_rating": 5,
  "review_title": "Exactly the independent audit we needed",
  "review_body": "Standards-grounded findings our engineers could act on.",
  "is_public": true
}
```

Server sets `reviewer_id`, `reviewee_id`, `reviewer_role` from the caller; recomputes the reviewee expert's `avg_rating`.

Response `201`.
Errors: `422` engagement not `completed` · `409` this side already reviewed · `400` `expertise_rating` supplied on an expert→org review.

### GET /experts/:expertId/reviews

**Auth: Any role.** Public (`is_public = true`, not flagged) reviews, paginated, plus aggregate:

```json
{
  "aggregate": { "avg_overall": 4.85, "avg_communication": 4.90, "count": 12 },
  "data": [ ... ]
}
```

### GET /engagements/:engagementId/reviews

**Auth: participant or admin.** Both reviews (if present), including private ones.

### POST /reviews/:reviewId/flag

**Auth: any authenticated user.** Body: `{ "flagged_reason": "Contains confidential client details" }` → `200` (sets `is_flagged`; hides from public listings pending admin review).

### Admin moderation

`GET /admin/reviews?is_flagged=true` · `PATCH /admin/reviews/:reviewId` (`{ "is_flagged": false }` or `{ "is_public": false }`) — **Auth: admin**

### Verification (`verification_records`)

Verification is unified here — there is no separate per-credential verification toggle. A credential counts as verified when it has a linked `verification_records` row approved by an admin.

#### POST /verifications

Submit a verification request for yourself. — **Auth: organization | expert**

Request (identity/org/background check — no credential link):

```json
{
  "verification_type": "identity",
  "submitted_document_urls": [
    "https://storage.quantumconnect.io/uploads/passport.pdf"
  ]
}
```

Request (verifying one specific credential):

```json
{
  "verification_type": "professional_credential",
  "related_credential_id": 14,
  "submitted_document_urls": [
    "https://storage.quantumconnect.io/uploads/phd-cert.pdf"
  ]
}
```

Response `201` (`status: "pending"`).
Errors: `400` `related_credential_id` supplied with a `verification_type` other than `professional_credential`, or referencing a credential not owned by the caller.

#### GET /verifications

**Auth: owner** — own records. **admin** — all, filterable `?status=pending&verification_type=identity`.

#### PATCH /admin/verifications/:verificationId

Admin decision. — **Auth: admin**

Request:

```json
{
  "status": "approved",
  "admin_notes": "Credentials confirmed against NIST staff directory.",
  "expires_at": "2028-07-06"
}
```

or

```json
{
  "status": "rejected",
  "rejection_reason": "Document illegible; please resubmit."
}
```

Response `200`. Side effects:

- Approving a record with `verification_type != 'professional_credential'` flips `is_verified` on the corresponding org/expert profile (and `verification_status` on expert profiles).
- Approving a record with `related_credential_id` set makes that specific credential show `is_verified: true` on subsequent `GET /experts/:expertId/credentials` calls — no separate action needed.

---

## 10. Risk Assessment

### POST /engagements/:engagementId/assessments

Create a draft risk assessment. — **Auth: expert (participant)**

Request:

```json
{
  "overall_risk_level": "high",
  "quantum_readiness_score": 34.5,
  "hndl_exposure": "high",
  "executive_summary": "Core payment rails depend on RSA-2048...",
  "methodology": "NIST IR 8547-aligned inventory and exposure analysis.",
  "estimated_migration_cost_min": 2000000.0,
  "estimated_migration_cost_max": 4500000.0,
  "estimated_migration_months": 18
}
```

Response `201` (`status: "draft"`).

### GET /engagements/:engagementId/assessments

**Auth: participant.** The org side sees assessments only once status ≥ `under_org_review`; the expert sees all including drafts. An engagement may accumulate multiple independent assessments over time (e.g. an initial audit and a later follow-up) — there's no versioning link between them.

### GET /assessments/:assessmentId

**Auth: participant.** Full assessment with nested findings and recommendations.

### PATCH /assessments/:assessmentId

Update content or transition status. — **Auth: expert (author); org may only trigger the review-feedback transition**

Status flow:

```
draft → under_org_review → finalized → delivered   (expert advances)
under_org_review → draft                            (org requests changes)
```

`delivered` sets `delivered_at`. Content edits allowed only in `draft`.
Errors: `422` illegal transition or editing after `finalized`.

### Findings (`assessment_findings`)

| Method & Path                                           | Auth                        | Notes                                                 |
| ------------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| `POST /assessments/:assessmentId/findings`              | expert (author), draft only | → `201`                                               |
| `GET /assessments/:assessmentId/findings`               | participant                 | Ordered by `order_index`, filter `?severity=critical` |
| `PATCH /assessments/:assessmentId/findings/:findingId`  | expert (author), draft only |                                                       |
| `DELETE /assessments/:assessmentId/findings/:findingId` | expert (author), draft only | Cascades to its recommendations → `204`               |

POST body:

```json
{
  "category": "cryptographic_algorithm",
  "severity": "critical",
  "title": "RSA-2048 in payment message signing",
  "description": "All interbank payment messages are signed with RSA-2048...",
  "affected_systems": "Core payment gateway, settlement engine",
  "vulnerability_type": "shor_algorithm_vulnerable",
  "order_index": 1
}
```

### Recommendations (`remediation_recommendations`)

| Method & Path                                      | Auth                                                           | Notes                                           |
| -------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `POST /findings/:findingId/recommendations`        | expert (author), draft only                                    | `assessment_id` set server-side → `201`         |
| `GET /assessments/:assessmentId/recommendations`   | participant                                                    | Filter `?priority=immediate&is_completed=false` |
| `PATCH /recommendations/:recommendationId`         | expert: content (draft only) · org: completion (post-delivery) |                                                 |
| `POST /recommendations/:recommendationId/complete` | organization (participant), assessment `delivered`             | Sets `is_completed`, `completed_at` → `200`     |

POST body:

```json
{
  "priority": "immediate",
  "action_title": "Migrate payment signing to ML-DSA",
  "action_description": "Replace RSA-2048 signatures with ML-DSA-65...",
  "recommended_pqc_algorithm": "CRYSTALS-Dilithium / ML-DSA (FIPS 204)",
  "nist_standard_reference": "NIST FIPS 204",
  "estimated_effort_weeks": 12,
  "estimated_cost_range": "500k_1m",
  "dependencies": "HSM firmware upgrade must land first."
}
```

---

## 11. Admin (summary)

| Method & Path                                                                | Purpose                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /admin/users?role=&is_active=`                                          | User management                                                                                 |
| `PATCH /admin/users/:userId`                                                 | Deactivate/reactivate (`is_active`)                                                             |
| `PATCH /admin/organizations/:orgId/verify`                                   | `{ "is_verified": true }`                                                                       |
| `PATCH /admin/experts/:expertId/verify`                                      | Sets `is_verified` / `verification_status`                                                      |
| `GET /admin/verifications?status=pending` · `PATCH /admin/verifications/:id` | Verification queue — also covers individual credential verification via `related_credential_id` |
| `GET /admin/reviews?is_flagged=true` · `PATCH /admin/reviews/:id`            | Review moderation                                                                               |

All admin routes: **Auth: admin**, otherwise `403`.

---

## 12. Endpoint ↔ User Story Map (MVP)

| User story                                    | Endpoints                                                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sign up with email, password, role            | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login`                                              |
| Browse directory of verified experts          | `GET /experts` (+ filters)                                                                                        |
| View full expert profile                      | `GET /experts/:expertId` (nested credentials, work history, specializations, sector experience, engagement types) |
| _Stretch:_ review after engagement            | `POST /engagements/:id/reviews`, `GET /experts/:id/reviews`                                                       |
| _Stretch:_ notification on connection request | `POST /connections` (server emits notification), `GET /notifications`                                             |
| _Stretch:_ matching/connection requests       | `POST /connections`, `GET /connections/:id/score-factors`, `PATCH /connections/:id`                               |
