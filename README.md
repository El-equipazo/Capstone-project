# QuantumConnect

A full-stack marketplace connecting high-risk organizations with verified post-quantum cryptography experts. Built with React, FastAPI, and PostgreSQL.

---

## Mission Statement

This project proposes the development of a specialized application designed to connect quantum security experts with high-risk organizations, enabling proactive assessment and remediation before a quantum breakthrough renders current protections obsolete.

### The Platform

It serves as a specialized marketplace where organizations can discover and connect with the quantum security experts best suited to their needs. Institutions access the platform to search a curated directory of verified quantum security professionals, filtering by specialization, industry experience, and the specific types of cryptographic risk they face. Each expert profile details their areas of expertise, past engagement types, certifications, and familiarity with relevant sector-specific compliance requirements, giving organizations the context they need to make informed decisions about who to engage.

Once a match is identified, organizations can initiate contact directly through the platform, share relevant infrastructure details in a secure environment, and coordinate assessments end-to-end. Whether a bank is seeking a cryptographic audit, a hospital system needs guidance on securing long-lived patient records, or a government agency requires a full post-quantum migration roadmap, it ensures they can quickly find and engage the right expertise for their specific risk profile, without relying on fragmented referral networks or generalist cybersecurity firms that may lack deep quantum knowledge.

### Target Sectors

The platform focuses on sectors where the consequences of a quantum breach would be most severe:

- **Financial institutions** — banks, payment processors, and investment firms whose transaction integrity and customer data rely on public-key cryptography
- **Healthcare organizations** — hospitals, insurers, and research institutions storing long-lived sensitive patient records
- **Government and defense agencies** — entities managing classified communications, national infrastructure, or citizen data
- **Critical infrastructure operators** — energy, telecommunications, and transportation companies with long asset lifecycles and legacy encryption

### The Problem

Today, financial institutions holding the most sensitive long-term data are operating under a security model that quantum computing will quietly and completely break. The threat is not theoretical. "Harvest now, decrypt later" attacks are already underway; adversaries are collecting encrypted data today with the intent to decrypt it once a cryptographically relevant quantum computer exists. The window between now and that moment is narrowing, and most organizations will not be ready.

The institutions with the most to lose are also the ones with the most complex legacy systems, the heaviest regulatory exposure, and the least flexibility to pivot quickly. A payment processor handling trillions of dollars a day, a bank whose core systems are decades old, a government agency with classified infrastructure — these are the organizations where a quantum breach would be most devastating and where the gap between need and independent expertise is of most importance.

### Our Position

The data needed to assess quantum risk already exists inside every organization. Network diagrams, encryption inventories, compliance documentation, vendor contracts — the raw material for a thorough assessment is sitting in every CTO's file server. The bottleneck is not information. It is that almost no one outside of a handful of labs and one government agency has the depth to interpret that data through a post-quantum cryptography lens and translate it into a prioritized, actionable remediation plan.

QuantumConnect does not try to replace quantum security expertise; it makes that expertise findable, verifiable, and deployable. By building a curated directory of verified quantum security professionals with structured profiles and pairing it with a structured engagement workflow, the platform removes the coordination overhead that currently consumes both sides of the market. Organizations stop wasting time on generalist vendors who lack depth. Experts stop wasting time on leads who aren't ready to act.

### The Impact

If successful, our platform gives high-risk organizations a credible, structured path to genuine post-quantum cryptography expertise before the quantum cliff arrives. It gives the small, specialized community of quantum security experts a channel that helps them communicate with clients who are genuinely ready, genuinely at risk, and genuinely within their area of competency. And it creates a structured paper trail — assessments, findings, remediation roadmaps — that regulators and auditors will increasingly demand as post-quantum compliance frameworks mature into enforceable standards.

---

## User Personas

### Persona 1: The Organization

**Rob Otter — Head of Global Technology Applied Research (GTAR), JPMorgan Chase**

Rob Otter is the current head of JPMorgan Chase's Global Technology Applied Research group, appointed in July 2025.

**Background:** Otter now leads JPMorgan Chase's internal research group responsible for quantum computing, blockchain, advanced networking, and computer vision — one of the only dedicated applied research functions of its kind at a major financial institution. His mandate is to turn frontier technology research into bankable business value: securing communications, hardening payment infrastructure, and ensuring the bank stays ahead of the cryptographic threats that quantum computing will eventually make real.

**Values:** Otter values speed of translation from research to implementation. He has sat on both sides — the institution that needs quantum-safe infrastructure and the research group responsible for building it. He wants assessments that are infrastructure-specific, not benchmark reports; he wants remediation plans that his engineers can actually execute against his systems, not generic frameworks that describe a theoretical bank.

**The Problem:** JPMorgan Chase faces a gap that internal research cannot close alone: independent, infrastructure-specific cryptographic assessment of the bank's own legacy systems. Otter needs external quantum security experts who can go inside JPMorgan's infrastructure, assess it against the actual NIST PQC standards his own institution helped develop, and deliver a prioritized remediation roadmap that holds up to regulatory scrutiny. Finding that specific profile — not a generalist cybersecurity firm, not a quantum hardware vendor, but an independent post-quantum cryptography auditor with financial sector experience — is harder than it should be.

**What's Been Tried:**

- **Internal GTAR team** — Focused on research and innovation, not infrastructure audits. When Otter's deputy Charles Lim (former global head for quantum communications and cryptography) departed in 2025, the gap between research capability and operational assessment widened.
- **Big-4 consulting firms** — Produce quantum readiness reports benchmarked against industry averages — not against JPMorgan's specific encryption inventory, vendor contracts, or payment architecture.
- **Quantum hardware partners (IBM, Quantinuum)** — Excellent for computing research and algorithm collaboration. Not structured to provide independent infrastructure security assessments — and not independent, given JPMorgan's direct investment in Quantinuum.
- **Peer institutions** — Industry groups like FS-ISAC share frameworks and timelines but don't provide hands-on assessors.

### Persona 2: The Expert

**Dr. Dustin Moody — Mathematician and Lead of the Post-Quantum Cryptography Project, NIST**

Dr. Dustin Moody is a mathematician in the Computer Security Division at the National Institute of Standards and Technology (NIST). He has led NIST's Post-Quantum Cryptography standardization project since 2016.

**Background:** Since 2016, Moody has run one of the most consequential cryptographic initiatives of the modern era — an eight-year international competition involving hundreds of researchers across academia, industry, and government to select the algorithms that will protect the world's digital infrastructure from quantum computers.

**Values:** Moody has described himself as a "quiet guy" who didn't initially like public speaking but found himself giving the opening talk at PQCrypto 2016 in Japan to announce the NIST standardization process. He values rigor, precision, and the practical impact of getting cryptography right. He is careful to distinguish hype from reality in a field crowded with both; he knows exactly which threats are immediate, which are on a 10-to-15-year horizon, and which are vendor noise. His work is inherently collaborative — the NIST process involved hundreds of researchers — but his expertise is genuine.

**The Problem:** The expertise that Moody and people with his background represent is extraordinarily difficult to find through conventional channels. Organizations that want a NIST-caliber assessment of their cryptographic infrastructure — or someone who can look at their RSA-2048 dependency and give them a specific, standards-grounded answer about their exposure and remediation path — have no reliable way to locate, vet, and engage that expertise. From the expert side: people in Moody's field who do consulting work or advising alongside their research roles spend a disproportionate share of their time fielding inquiries from organizations that aren't ready to act, don't understand what they're asking for, or are looking for a checkbox rather than a real assessment.

**What's Been Tried:**

- **Conference appearances** — Moody has spoken extensively (PQCrypto, PKI Consortium, Red Hat Government Symposium, NIST workshops). These build visibility in the research community but don't create a pipeline of well-qualified enterprise clients.
- **NIST guidance documents** — NIST IR 8547, NIST SP 800-208, the NCCoE Migration to PQC project. These are frameworks that organizations should follow, but they don't replace an expert who can apply them to a specific infrastructure. Publishing the standard is not the same as helping an organization implement it.

---

## MVP User Stories

Without these features, the application will not be useful:

- As a **User**, I can sign up with my email, password and choose a role
- As an **Organization**, I can browse a directory of verified quantum security experts so that I can explore my options before reaching out
- As an **Organization**, I can view a full expert profile — including credentials, engagement types, and estimated timelines

---

## Stretch Features

When time is running short, these features will get cut:

- As an **Organization**, I can leave a rating and written review after an engagement ends so that future organizations can make more informed hiring decisions
- As an **Expert**, I can receive a notification when someone sends me a connection request so that I can respond promptly
- As an **Organization**, I can see an expert's average rating and completed engagement count on their public profile so that I can gauge their track record at a glance

---

## Schema

The full schema lives in [schema.md](schema.md). It is organized into seven domains:

### Identity & Auth

```
users
─────────────────────────────────────
user_id            SERIAL PRIMARY KEY
email              TEXT UNIQUE NOT NULL
password_hash      TEXT NOT NULL
role               TEXT NOT NULL          -- 'organization' | 'expert' | 'admin'
is_email_verified  BOOLEAN DEFAULT false
is_active          BOOLEAN DEFAULT true
last_login_at      TIMESTAMP

organization_profiles                     -- 1:1 with users
─────────────────────────────────────
org_profile_id     SERIAL PRIMARY KEY
user_id            INTEGER UNIQUE REFERENCES users ON DELETE CASCADE
org_name           TEXT NOT NULL
sector             TEXT NOT NULL          -- canonical sector enum
sub_sector, founded_year, employee_count_range, country, state_province,
website, org_description, quantum_knowledge_level, budget_range,
urgency_level, default_connection_expiry_days, is_verified

expert_profiles                           -- 1:1 with users
─────────────────────────────────────
expert_profile_id  SERIAL PRIMARY KEY
user_id            INTEGER UNIQUE REFERENCES users ON DELETE CASCADE
first_name         TEXT NOT NULL
last_name          TEXT NOT NULL
headline, bio, profile_photo_url, years_of_experience,
hourly_rate_min, hourly_rate_max, availability_status,
preferred_engagement_length, is_verified, verification_status,
avg_rating         NUMERIC(3,2)           -- computed from reviews
total_completed_engagements
```

### Profiles & Discovery

Five 1:many sub-resource tables hang off `expert_profiles`, and one 1:1 table off `organization_profiles`:

```
expert_credentials          credential_type, credential_name, institution, year_obtained
expert_work_history         organization_name, job_title, start_date, end_date, is_current
expert_specializations      specialization, proficiency_level, years_in_specialization
expert_sector_experience    sector (canonical enum), compliance_standards_known TEXT[]
expert_engagement_types     engagement_type (canonical enum), typical duration/budget ranges

organization_infrastructure -- 1:1 with organization_profiles (sensitive, not public)
                            data_categories TEXT[], storage_type,
                            current_encryption_standards TEXT[],
                            compliance_requirements TEXT[], ...
```

### Canonical Enums

Two enums are shared across domains so search and matching stay consistent:

```
engagement_type   'cryptographic_audit' | 'risk_assessment' | 'migration_roadmap' |
                  'executive_briefing' | 'staff_training' | 'ongoing_advisory' |
                  'compliance_review' | 'full_migration_support'
                  (used by engagements, expert_engagement_types,
                   connection_requests.org_stated_need)

sector            'financial' | 'healthcare' | 'government' | 'nonprofit' |
                  'legal' | 'energy' | 'education' | 'other'
                  (used by organization_profiles, expert_sector_experience)
```

### Matching

```
connection_requests
─────────────────────────────────────
connection_id      SERIAL PRIMARY KEY
org_id             INTEGER REFERENCES organization_profiles ON DELETE CASCADE
expert_id          INTEGER REFERENCES expert_profiles ON DELETE CASCADE
status             TEXT DEFAULT 'pending' -- 'pending' | 'accepted' | 'declined' | 'expired'
org_stated_need    TEXT                   -- canonical engagement_type enum; NULL = "not sure"
match_score        NUMERIC(5,2)           -- system-computed 0–100
expires_at         TIMESTAMP              -- from org's default_connection_expiry_days

UNIQUE partial index on (org_id, expert_id) WHERE status = 'pending'

match_scoring_factors                     -- 1:many per connection
─────────────────────────────────────
factor_name, weight, raw_score, weighted_contribution
-- deferred constraint trigger verifies SUM(weight) ≈ 1.00 at commit
```

### Engagements

```
engagements                               -- 1:1 with an accepted connection
─────────────────────────────────────
engagement_id      SERIAL PRIMARY KEY
connection_id      INTEGER UNIQUE REFERENCES connection_requests ON DELETE RESTRICT
engagement_type    TEXT NOT NULL          -- canonical enum
status             TEXT DEFAULT 'scoping' -- 'scoping' | 'proposal_sent' | 'proposal_accepted' |
                                          -- 'active' | 'on_hold' | 'completed' | 'cancelled'
agreed_budget, payment_structure, start_date, estimated_end_date,
actual_end_date, cancellation_reason

engagement_milestones                     -- 1:many per engagement
─────────────────────────────────────
proposed_by_user_id / proposed_by_role    -- either party proposes,
confirmed_by_expert_id / confirmed_at     -- the expert has final say
status             'proposed' | 'confirmed' | 'in_progress' |
                   'completed' | 'skipped' | 'blocked'
requires_client_approval / client_approved_at
```

### Communication

```
messages                    engagement-scoped; message_type 'text' | 'file' |
                            'milestone_update' | 'system_event';
                            document_id FK set when message_type = 'file'
secure_document_shares      engagement-scoped uploads with checksum_sha256,
                            access_expires_at, is_revoked
notifications               per-user, server-generated only; polymorphic
                            related_entity_type / related_entity_id
```

### Trust & Reviews

```
reviews                     one per side per engagement —
                            UNIQUE(engagement_id, reviewer_role);
                            overall/communication/expertise/timeliness/value
                            ratings; is_public, is_flagged
verification_records        'identity' | 'professional_credential' |
                            'organization_legitimacy' | 'background_check';
                            related_credential_id links a record to one
                            specific expert credential
```

### Risk Assessment

```
risk_assessments            engagement-scoped; overall_risk_level,
                            quantum_readiness_score, hndl_exposure,
                            status 'draft' → 'under_org_review' → 'finalized' → 'delivered'
assessment_findings         category, severity, vulnerability_type, order_index
remediation_recommendations priority, recommended_pqc_algorithm,
                            nist_standard_reference, is_completed
```

### Schema Diagram

```
                              ┌───────────┐
              1:1             │   users   │             1:1
      ┌───────────────────────┤  (role)   ├────────────────────────┐
      ▼                       └─────┬─────┘                        ▼
┌───────────────────────┐          │ 1:M            ┌──────────────────────────┐
│ organization_profiles │          ▼                │      expert_profiles     │
└───────┬───────────────┘   ┌───────────────┐      └──────────┬───────────────┘
   1:1  │                   │ notifications │            1:M  │
        ▼                   │ verification_ │                 ▼
┌────────────────────────┐  │ records       │   ┌─────────────────────────────┐
│ organization_          │  └───────────────┘   │ expert_credentials          │
│ infrastructure         │                      │ expert_work_history         │
└────────────────────────┘                      │ expert_specializations      │
                                                │ expert_sector_experience    │
        │  1:M (sender)              1:M        │ expert_engagement_types     │
        │                (receiver)             └─────────────────────────────┘
        ▼                                                      │
┌──────────────────────────────────────────────────────────────┴──┐
│                      connection_requests                        │
│         (org → expert, match_score, expires_at)                 │
└──────────────┬───────────────────────────────┬──────────────────┘
          1:M  ▼                          1:1  ▼
┌───────────────────────┐   ┌────────────────────────────────────┐
│ match_scoring_factors │   │            engagements             │
│ (weights sum to 1.00) │   └──┬──────┬──────────┬──────┬────────┘
└───────────────────────┘  1:M │  1:M │     1:M  │ 1:M  │ 1:M
                               ▼      ▼          ▼      ▼
                    ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐
                    │ engagement_│ │ messages │ │ reviews │ │ risk_assessments │
                    │ milestones │ │ + secure_│ │ (max 2) │ └───────┬──────────┘
                    └────────────┘ │ document_│ └─────────┘    1:M  ▼
                                   │ shares   │      ┌─────────────────────────┐
                                   └──────────┘      │ assessment_findings     │
                                                     │  └─ 1:M remediation_    │
                                                     │      recommendations    │
                                                     └─────────────────────────┘
```

A user has exactly one profile (organization or expert). An organization sends connection requests to experts; an accepted request can become exactly one engagement, which owns its milestones, messages, documents, reviews, and risk assessments. Deleting a user cascades through their profile and everything under it.

---

## API Contract

Full request/response examples live in [api-contract.md](api-contract.md) (v2, mapped 1:1 to the schema).

### Conventions

- **Base URL:** `https://api.quantumconnect.io/api/v1` (locally: `http://localhost:8000/api/v1`)
- **Content type:** `application/json`, except file uploads (`multipart/form-data`)
- **Authentication:** JWT Bearer tokens (`Authorization: Bearer <access_token>`). Roles are `organization` | `expert` | `admin`; each endpoint lists which roles may call it. **Public** = no token required.
- **Timestamps:** ISO 8601 UTC. **IDs:** integers (SERIAL PKs).
- **Errors** use a standard envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "hourly_rate_min must be less than hourly_rate_max",
    "details": [{ "field": "hourly_rate_min", "issue": "must be <= hourly_rate_max" }]
  }
}
```

- **Status codes:** `200` OK · `201` Created · `204` No Content · `400` validation error · `401` missing/invalid token · `403` wrong role or not resource owner · `404` not found · `409` conflict (duplicate email / open connection request / review / engagement) · `410` gone (expired connection request, expired/revoked document) · `422` semantically invalid (e.g. illegal status transition) · `429` rate limited
- **Pagination:** list endpoints accept `?page=1&limit=20&sort=created_at&order=desc` and respond with a `{ "data": [...], "pagination": { page, limit, total_items, total_pages } }` envelope
- **Canonical enums** (shared across resources — see [Schema § Canonical Enums](#canonical-enums)): `engagement_type` and `sector`

### Auth & Identity

| Method | Endpoint             | Auth   | Request Body                                | Response                                            |
| ------ | -------------------- | ------ | ------------------------------------------- | --------------------------------------------------- |
| POST   | `/auth/register`     | Public | `{ email, password, role }`                 | `201` `{ user_id, email, role, is_email_verified }` |
| POST   | `/auth/verify-email` | Public | `{ token }`                                 | `{ is_email_verified: true }`                       |
| POST   | `/auth/login`        | Public | `{ email, password }`                       | `{ access_token, refresh_token, expires_in, user }` |
| POST   | `/auth/refresh`      | Public | `{ refresh_token }`                         | new token pair                                      |
| POST   | `/auth/logout`       | any    | —                                           | `204` (invalidates refresh token)                   |
| GET    | `/auth/me`           | any    | —                                           | current user + attached profile (org or expert)     |
| PATCH  | `/auth/me`           | any    | `{ email? }` or `{ password, current_password }` | updated user (email change re-triggers verification) |
| DELETE | `/auth/me`           | any    | —                                           | `204` (soft-deactivate, `is_active = false`)        |

### Organization Profiles

| Method | Endpoint                              | Auth                                   | Request Body                    | Response                                        |
| ------ | ------------------------------------- | -------------------------------------- | ------------------------------- | ----------------------------------------------- |
| POST   | `/organizations`                      | organization                           | org profile fields (`org_name`, `sector`, `budget_range`, `urgency_level`, ...) | `201` full profile row (`409` if one exists) |
| GET    | `/organizations/:orgId`               | any                                    | —                               | public fields; owner and admin see everything   |
| PATCH  | `/organizations/:orgId`               | owner or admin                         | partial update                  | updated profile                                 |
| PUT    | `/organizations/:orgId/infrastructure`| organization (owner)                   | `data_categories`, `storage_type`, `current_encryption_standards`, `compliance_requirements`, ... | created/replaced record |
| GET    | `/organizations/:orgId/infrastructure`| owner, admin, or connected expert      | —                               | record (`403` otherwise — infrastructure is sensitive, never public) |

### Expert Profiles & Sub-resources

| Method | Endpoint              | Auth           | Request Body          | Response                                                        |
| ------ | --------------------- | -------------- | --------------------- | --------------------------------------------------------------- |
| POST   | `/experts`            | expert         | profile fields (name, headline, bio, rates, availability, ...) | `201` (`avg_rating` and `total_completed_engagements` are server-computed, read-only) |
| GET    | `/experts`            | any            | — (query filters)     | paginated directory of verified experts (card summaries)        |
| GET    | `/experts/:expertId`  | any            | —                     | full public profile + nested `credentials`, `work_history`, `specializations`, `sector_experience`, `engagement_types` |
| PATCH  | `/experts/:expertId`  | owner or admin | partial update        | updated profile                                                 |

Directory search filters on `GET /experts`: `q` (name/headline/bio), `specialization` (repeatable), `proficiency_min`, `sector`, `compliance` (repeatable), `engagement_type`, `availability`, `rate_max`, `rating_min`, `years_experience_min`, plus pagination params. Non-admins only see `is_verified = true` experts.

Each sub-resource follows the same CRUD pattern — `GET` is public, writes are expert (owner) only:

| Sub-resource      | Base Path                                | Notes                                                                 |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Credentials       | `/experts/:expertId/credentials`         | `is_verified` is derived from a linked approved verification record (§ Trust & Reviews); deleting cascades to that record |
| Work history      | `/experts/:expertId/work-history`        | sorted by `order_index` if set, else `start_date DESC`; `is_current = true` nulls out `end_date` |
| Specializations   | `/experts/:expertId/specializations`     | `specialization`, `proficiency_level`, `years_in_specialization`      |
| Sector experience | `/experts/:expertId/sector-experience`   | `sector` uses the canonical enum so search/matching stay consistent   |
| Engagement types  | `/experts/:expertId/engagement-types`    | `engagement_type` (canonical enum) + typical duration/budget ranges   |

### Matching *(stretch)*

| Method | Endpoint                              | Auth               | Request Body / Notes                                             | Response                                        |
| ------ | ------------------------------------- | ------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| POST   | `/connections`                        | organization       | `{ expert_id, initial_message, org_stated_need?, org_stated_timeline? }` | `201` with server-computed `match_score` and `expires_at`; `409` open request already exists (DB-enforced); `422` expert unavailable |
| GET    | `/connections`                        | organization, expert | `?status=&expert_id=&org_id=`                                  | org sees sent; expert sees received             |
| GET    | `/connections/:connectionId`          | participant or admin | —                                                              | connection request                              |
| GET    | `/connections/:connectionId/score-factors` | participant or admin | —                                                         | `{ match_score, factors: [{ factor_name, weight, raw_score, weighted_contribution }] }` — weights sum to 1.00, DB-enforced at commit |
| PATCH  | `/connections/:connectionId`          | expert (recipient) | `{ status: "accepted" \| "declined" }`                           | `200` (sets `responded_at`); `410` expired; `422` not pending |

`expired` is set by a scheduled job when `NOW() > expires_at` — clients never set it directly.

### Engagements & Milestones *(stretch)*

| Method | Endpoint                       | Auth                        | Request Body / Notes                                       | Response                                    |
| ------ | ------------------------------ | --------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| POST   | `/engagements`                 | participant of connection   | `{ connection_id, engagement_type, title, payment_structure, agreed_budget, ... }` | `201` status `scoping`; `409` engagement exists for connection; `422` connection not accepted |
| GET    | `/engagements`                 | organization, expert, admin | `?status=&engagement_type=`                                 | current user's engagements                  |
| GET    | `/engagements/:engagementId`   | participant or admin        | —                                                           | engagement + nested milestones              |
| PATCH  | `/engagements/:engagementId`   | participant                 | field updates or `{ status }`                               | `200`; `422` illegal transition             |

Allowed status transitions:

```
scoping → proposal_sent            (expert)
proposal_sent → proposal_accepted  (organization)
proposal_accepted → active         (either)
active ↔ on_hold                   (either)
active → completed                 (expert; sets actual_end_date,
                                    increments total_completed_engagements)
any non-terminal → cancelled       (either; cancellation_reason required)
```

Milestones — either party proposes, but the expert always has final say on scope and timeline:

| Method | Endpoint                                      | Auth                       | Notes                                                            |
| ------ | ---------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| POST   | `/engagements/:id/milestones`                  | participant                | expert-created → `confirmed` immediately; org-created → `proposed` until expert confirms |
| GET    | `/engagements/:id/milestones`                  | participant                | ordered by `order_index`                                          |
| PATCH  | `/engagements/:id/milestones/:milestoneId`     | expert: any field · org: `due_date`/`description` only, while `proposed` | `403` otherwise |
| POST   | `/engagements/:id/milestones/:milestoneId/confirm` | expert (participant)   | `proposed → confirmed`; sets `confirmed_by_expert_id`, `confirmed_at` |
| POST   | `/engagements/:id/milestones/:milestoneId/approve` | organization (participant) | only when `requires_client_approval = true` and status `completed`; sets `client_approved_at` |
| DELETE | `/engagements/:id/milestones/:milestoneId`     | expert (participant)       | only while engagement is `scoping`/`proposal_sent`                |

Milestone statuses: `proposed | confirmed | in_progress | completed | skipped | blocked` — a `proposed` milestone cannot advance to `in_progress` without confirmation (`422`).

### Communication *(stretch)*

| Method | Endpoint                                            | Auth               | Request Body / Notes                                              |
| ------ | --------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| GET    | `/engagements/:id/messages`                         | participant        | paginated, newest first; `?unread=true`                            |
| POST   | `/engagements/:id/messages`                         | participant        | `{ message_type: "text", content }` or `{ message_type: "file", content, document_id }` — file messages reference an already-uploaded document; `milestone_update`/`system_event` types are server-emitted only |
| POST   | `/engagements/:id/messages/read`                    | participant        | `{ message_ids: [...] }` or `{ all: true }` → `{ updated }`        |
| POST   | `/engagements/:id/documents`                        | participant        | `multipart/form-data`: `file`, `document_name`, `document_type`, `access_expires_at?` → `201` metadata incl. `checksum_sha256` |
| GET    | `/engagements/:id/documents`                        | participant        | metadata only (never raw `storage_url`)                            |
| GET    | `/engagements/:id/documents/:documentId/download`   | participant        | short-lived presigned URL; sets `first_accessed_at`; `410` revoked/expired |
| POST   | `/engagements/:id/documents/:documentId/revoke`     | uploader or admin  | sets `is_revoked` — referencing messages stay in history, attachment renders as "revoked" |
| GET    | `/notifications`                                    | any                | `?is_read=false`; paginated, newest first                          |
| GET    | `/notifications/unread-count`                       | any                | `{ count }`                                                        |
| PATCH  | `/notifications/:notificationId`                    | owner              | `{ is_read: true }`                                                |
| POST   | `/notifications/read-all`                           | owner              | `{ updated }`                                                      |

Message `content` is encrypted at rest; the API returns plaintext to authorized participants. Notifications are server-generated only (connection received/responded, message received, milestone changes, review received, verification decision) — no client POST.

### Trust & Reviews *(stretch)*

| Method | Endpoint                          | Auth                  | Request Body / Notes                                                 |
| ------ | --------------------------------- | --------------------- | --------------------------------------------------------------------- |
| POST   | `/engagements/:id/reviews`        | participant           | overall/communication/expertise/timeliness/value ratings + title/body; one per side (DB `UNIQUE(engagement_id, reviewer_role)`); `422` engagement not completed; `409` already reviewed; recomputes expert `avg_rating` |
| GET    | `/experts/:expertId/reviews`      | any                   | public, unflagged reviews + `{ aggregate: { avg_overall, avg_communication, count } }` |
| GET    | `/engagements/:id/reviews`        | participant or admin  | both sides' reviews, including private                                |
| POST   | `/reviews/:reviewId/flag`         | any authenticated     | `{ flagged_reason }` — hides from public listings pending admin review |
| POST   | `/verifications`                  | organization, expert  | `{ verification_type, submitted_document_urls, related_credential_id? }` → `201` pending; `related_credential_id` only with type `professional_credential`, must own the credential |
| GET    | `/verifications`                  | owner (own) / admin (all) | admin filterable: `?status=&verification_type=`                    |
| PATCH  | `/admin/verifications/:id`        | admin                 | `{ status: "approved", admin_notes?, expires_at? }` or `{ status: "rejected", rejection_reason }` — approving flips `is_verified` on the profile, or on the linked credential |

### Risk Assessment *(stretch)*

| Method | Endpoint                                     | Auth                       | Request Body / Notes                                            |
| ------ | -------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| POST   | `/engagements/:id/assessments`               | expert (participant)       | `overall_risk_level`, `quantum_readiness_score`, `hndl_exposure`, summary, methodology, migration cost/time estimates → `201` status `draft` |
| GET    | `/engagements/:id/assessments`               | participant                | org sees assessments only once status ≥ `under_org_review`; expert sees all incl. drafts |
| GET    | `/assessments/:assessmentId`                 | participant                | full assessment + nested findings and recommendations            |
| PATCH  | `/assessments/:assessmentId`                 | expert (author); org may only request changes | status flow: `draft → under_org_review → finalized → delivered` (expert advances); `under_org_review → draft` (org requests changes); content edits in `draft` only |
| POST/GET/PATCH/DELETE | `/assessments/:id/findings[/:findingId]` | expert (author), draft only; GET: participant | `category`, `severity`, `vulnerability_type`, `order_index`; filter `?severity=critical`; delete cascades to recommendations |
| POST   | `/findings/:findingId/recommendations`       | expert (author), draft only | `priority`, `action_title`, `recommended_pqc_algorithm`, `nist_standard_reference`, effort/cost estimates |
| GET    | `/assessments/:id/recommendations`           | participant                | filter `?priority=immediate&is_completed=false`                   |
| PATCH  | `/recommendations/:recommendationId`         | expert: content (draft) · org: completion (post-delivery) | —                                    |
| POST   | `/recommendations/:recommendationId/complete`| organization (participant) | assessment must be `delivered`; sets `is_completed`, `completed_at` |

### Admin

All admin routes require the `admin` role (`403` otherwise):

| Method & Path                                              | Purpose                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /admin/users?role=&is_active=` · `PATCH /admin/users/:userId` | User management, deactivate/reactivate                    |
| `PATCH /admin/organizations/:orgId/verify`                  | `{ is_verified: true }`                                          |
| `PATCH /admin/experts/:expertId/verify`                     | Sets `is_verified` / `verification_status`                       |
| `GET /admin/verifications?status=pending` · `PATCH /admin/verifications/:id` | Verification queue (incl. per-credential verification) |
| `GET /admin/reviews?is_flagged=true` · `PATCH /admin/reviews/:id` | Review moderation                                          |

### Endpoint ↔ User Story Map

| User story                                        | Endpoints                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Sign up with email, password, role                | `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/login`        |
| Browse directory of verified experts              | `GET /experts` (+ filters)                                                  |
| View full expert profile                          | `GET /experts/:expertId` (nested credentials, work history, specializations, sector experience, engagement types) |
| *Stretch:* review after engagement                | `POST /engagements/:id/reviews`, `GET /experts/:id/reviews`                 |
| *Stretch:* notification on connection request     | `POST /connections` (server emits notification), `GET /notifications`       |
| *Stretch:* rating & engagement count on profile   | `GET /experts/:expertId` (`avg_rating`, `total_completed_engagements`)      |

---

## Setup

### 1. Database

Create a local Postgres database:

```sh
createdb quantumconnect
```

### 2. Server

From the repo root, create a virtual environment and install dependencies:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Open `.env` and fill in your Postgres credentials and a `JWT_SECRET` (generate one with `python3 -c "import secrets; print(secrets.token_hex(32))"`). Then seed the database:

```sh
python -m server.db.seed
```

Start the server:

```sh
uvicorn server.main:app --reload
```

The API runs on `http://localhost:8000` (interactive docs at `http://localhost:8000/docs`).

### 3. Frontend

In a second terminal:

```sh
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`. It currently talks to a mock API client ([frontend/src/api/client.js](frontend/src/api/client.js)) that mirrors the API contract; swapping in real `fetch` calls against the FastAPI server changes only that module. The server's CORS config already allows `http://localhost:5173`.

---

## Seed Users

After running `python -m server.db.seed`, these accounts are available:

| Email                          | Password    | Role         |
| ------------------------------ | ----------- | ------------ |
| admin@quantumconnect.com       | password123 | admin        |
| cto@firstcommunitybankny.com   | password123 | organization |
| dr.chen@quantumsec.io          | password123 | expert       |

---

## Application Structure

```
quantumconnect/
├── frontend/                        # React app (Vite)
│   ├── src/
│   │   ├── main.jsx                 # Entry point, router setup
│   │   ├── App.jsx                  # Root component and route definitions
│   │   ├── api/
│   │   │   └── client.js            # API client mirroring api-contract.md (mock for now)
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Session state (current user, login/logout)
│   │   ├── pages/                   # Landing, HowItWorks, SignUp, Login,
│   │   │                            #   ExpertDirectory, ExpertProfile, NotFound
│   │   ├── components/              # Navbar, Footer, ExpertCard, RatingStars,
│   │   │                            #   VerifiedBadge, PortraitPlaceholder
│   │   ├── data/
│   │   │   └── mockExperts.js       # Fixture data shaped like the DB schema
│   │   └── utils/format.js          # Shared formatting helpers
│   └── vite.config.js
├── server/                          # FastAPI + Postgres API
│   ├── main.py                      # App entry point, routers, error-envelope handlers
│   ├── config.py                    # Env-driven settings (DB, JWT, CORS)
│   ├── dependencies.py              # Auth dependencies (current user, role guards)
│   ├── controllers/
│   │   ├── auth.py                  # register, verify-email, login, refresh, logout, me
│   │   ├── experts.py               # expert profile + all five sub-resources
│   │   └── organizations.py         # org profile + infrastructure
│   ├── models/                      # SQL query layer (asyncpg)
│   │   ├── user_model.py
│   │   ├── connection_model.py
│   │   ├── enums.py                 # Canonical enums (engagement_type, sector, ...)
│   │   ├── validators.py
│   │   └── errors.py                # Typed errors mapped to the contract's envelope
│   ├── schemas/                     # Pydantic request/response models
│   │   ├── auth.py, experts.py, organizations.py, common.py
│   │   └── ...
│   └── db/
│       ├── connection_pool.py       # asyncpg pool
│       └── seed.py                  # Creates all tables and inserts sample data
├── api-contract.md                  # Full REST contract (v2)
├── schema.md                        # Full database schema with diagrams
├── requirements.txt
└── .env.example
```
