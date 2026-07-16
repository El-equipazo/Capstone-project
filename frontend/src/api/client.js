// Mock client that mirrors api-contract.md's request/response shapes and status
// codes. Every page talks to *this* module, never to mock data directly — once
// the FastAPI backend exists, only the bodies of these functions change (to
// real `fetch` calls against VITE_API_BASE_URL); callers stay the same.
//
// Everything below is persisted to localStorage purely so the mock survives a
// page reload during development. None of these keys (qc_mock_*) have any
// real-world meaning once the backend exists — the whole localStorage layer
// should be deleted wholesale during migration, not patched piecemeal, or
// leftover rows (like the illustrative seed data below) will surface as
// phantom data alongside the real API's responses.

import { mockExperts, verifiedMockExperts } from '../data/mockExperts'
import { labelize } from '../utils/format'

const USERS_KEY = 'qc_mock_users'
const SESSION_KEY = 'qc_mock_session'
// Profiles created through the expert dashboard, keyed by expert_profile_id —
// separate from the seeded mockExperts.js directory data, and keyed the same
// way the real PATCH /experts/:expertId route is, not by user_id (there's a
// separate lookup, findProfileByUserId, for the one place that legitimately
// needs to go the other direction: GET /auth/me resolving "my profile").
const EXPERT_PROFILES_KEY = 'qc_mock_expert_profiles'
const NETWORK_DELAY_MS = 350

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS))
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.body = { error: { code, message } }
  }
}

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || []
  } catch {
    return []
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function loadExpertProfiles() {
  try {
    return JSON.parse(localStorage.getItem(EXPERT_PROFILES_KEY)) || {}
  } catch {
    return {}
  }
}

function saveExpertProfiles(map) {
  localStorage.setItem(EXPERT_PROFILES_KEY, JSON.stringify(map))
}

function allDashboardProfiles() {
  return Object.values(loadExpertProfiles())
}

function findProfileByUserId(userId) {
  return allDashboardProfiles().find((p) => p.user_id === userId) ?? null
}

// connection_requests and engagements for dashboard experts. We don't have a
// real organization_profiles fixture set, so — unlike expert_profiles, which
// mirrors the schema's org_id FK — these mock rows carry org_name/org_sector
// directly for simplicity.
const CONNECTIONS_KEY = 'qc_mock_connections'
const ENGAGEMENTS_KEY = 'qc_mock_engagements'

function loadConnections() {
  try {
    return JSON.parse(localStorage.getItem(CONNECTIONS_KEY)) || []
  } catch {
    return []
  }
}

function saveConnections(list) {
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(list))
}

function loadEngagements() {
  try {
    return JSON.parse(localStorage.getItem(ENGAGEMENTS_KEY)) || []
  } catch {
    return []
  }
}

function saveEngagements(list) {
  localStorage.setItem(ENGAGEMENTS_KEY, JSON.stringify(list))
}

// Resume ID counters from whatever's already in localStorage instead of
// restarting at the fallback on every reload — otherwise a second profile
// created after a reload gets the same id as the first and silently
// overwrites it.
function computeNextId(items, idKey, fallback) {
  const ids = items.map((item) => item[idKey]).filter((n) => typeof n === 'number')
  return ids.length ? Math.max(...ids) + 1 : fallback
}

let nextDashboardExpertId = computeNextId(allDashboardProfiles(), 'expert_profile_id', 5000)
let nextConnectionId = computeNextId(loadConnections(), 'connection_id', 9000)
let nextEngagementId = computeNextId(loadEngagements(), 'engagement_id', 9500)

// A freshly created profile has no real inbound activity yet — seed a couple
// of illustrative pending requests so the Overview tab has something to
// demo/act on, the same way mockExperts.js fabricates realistic directory
// fixtures rather than leaving everything at zero.
const DEMO_REQUESTS = [
  {
    org_name: 'Meridian Trust Bank',
    org_sector: 'financial',
    org_stated_need: 'cryptographic_audit',
    org_stated_timeline: 'within_3mo',
    initial_message: 'We need an independent audit of our payment rails ahead of our Q3 compliance review.',
    match_score: 88.5,
  },
  {
    org_name: 'Alpine Health Network',
    org_sector: 'healthcare',
    org_stated_need: 'risk_assessment',
    org_stated_timeline: 'within_6mo',
    initial_message: 'Looking for a harvest-now-decrypt-later exposure assessment on our patient records archive.',
    match_score: 76.0,
  },
]

// Idempotent by expertId — guards against ever double-seeding the same
// profile (a retried create-profile submission, a duplicate effect firing,
// etc.), regardless of what caused the second call.
function seedConnectionsForExpert(expertId) {
  const all = loadConnections()
  if (all.some((c) => c.expert_id === expertId)) return
  const now = Date.now()
  DEMO_REQUESTS.forEach((req, i) => {
    all.push({
      connection_id: nextConnectionId++,
      expert_id: expertId,
      status: 'pending',
      created_at: new Date(now - i * 3600_000).toISOString(),
      expires_at: new Date(now + 30 * 86400_000).toISOString(),
      responded_at: null,
      ...req,
    })
  })
  saveConnections(all)
}

// ---------------- Auth (POST /auth/register, /auth/login, GET /auth/me) ----------------

export const authApi = {
  async register({ email, password, role }) {
    if (!email || !password || password.length < 8) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.')
    }
    if (!['organization', 'expert'].includes(role)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid role.')
    }
    const users = loadUsers()
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError(409, 'CONFLICT', 'An account with this email already exists.')
    }
    const user = {
      user_id: users.length + 1,
      email,
      role,
      is_email_verified: false,
      created_at: new Date().toISOString(),
    }
    users.push({ ...user, password })
    saveUsers(users)
    return delay({ ...user })
  },

  async login({ email, password }) {
    const users = loadUsers()
    const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    if (!match || match.password !== password) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Incorrect email or password.')
    }
    const session = {
      access_token: `mock.${match.user_id}.${Date.now()}`,
      user: { user_id: match.user_id, email: match.email, role: match.role },
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return delay(session)
  },

  logout() {
    localStorage.removeItem(SESSION_KEY)
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))
    } catch {
      return null
    }
  },

  // GET /auth/me — returns the current user plus their attached profile, if
  // any. This is how the dashboard should find "my profile", rather than a
  // dedicated by-user-id expert route (which doesn't exist in the contract).
  async me() {
    const session = authApi.getSession()
    if (!session) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in.')
    }
    const profile = session.user.role === 'expert' ? findProfileByUserId(session.user.user_id) : null
    return delay({ user: session.user, profile })
  },
}

// ---------------- Discovery (GET /experts, GET /experts/:expertId) ----------------

export const expertsApi = {
  async list(filters = {}) {
    let results = [...verifiedMockExperts, ...allDashboardProfiles().filter((p) => p.is_verified)]

    if (filters.q) {
      const q = filters.q.toLowerCase()
      results = results.filter(
        (e) =>
          `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
          e.headline.toLowerCase().includes(q) ||
          e.bio.toLowerCase().includes(q)
      )
    }
    if (filters.specialization) {
      results = results.filter((e) =>
        e.specializations.some((s) => s.specialization === filters.specialization)
      )
    }
    if (filters.sector) {
      results = results.filter((e) => e.sector_experience.some((s) => s.sector === filters.sector))
    }
    if (filters.engagement_type) {
      results = results.filter((e) =>
        e.engagement_types.some((t) => t.engagement_type === filters.engagement_type)
      )
    }
    if (filters.availability) {
      results = results.filter((e) => e.availability_status === filters.availability)
    }
    if (filters.rate_max) {
      results = results.filter((e) => e.hourly_rate_min <= Number(filters.rate_max))
    }
    if (filters.rating_min) {
      results = results.filter((e) => (e.avg_rating || 0) >= Number(filters.rating_min))
    }

    return delay({
      data: results,
      pagination: {
        page: 1,
        limit: results.length,
        total_items: results.length,
        total_pages: 1,
      },
    })
  },

  async getById(expertId) {
    const expert =
      mockExperts.find((e) => String(e.expert_profile_id) === String(expertId)) ??
      allDashboardProfiles().find((e) => String(e.expert_profile_id) === String(expertId))
    if (!expert) {
      throw new ApiError(404, 'NOT_FOUND', 'Expert profile not found.')
    }
    return delay(expert)
  },

  // ---------------- Expert dashboard (POST /experts, PATCH /experts/:expertId, specializations CRUD) ----------------
  // createProfile takes userId because that's genuinely what POST /experts is
  // keyed on (there's no expert_profile_id yet). Every other mutation below
  // takes expertId, matching PATCH /experts/:expertId and its sub-resources.

  async createProfile(userId, data) {
    if (findProfileByUserId(userId)) {
      throw new ApiError(409, 'CONFLICT', 'Profile already exists for this user.')
    }
    const profiles = loadExpertProfiles()
    const expertProfileId = nextDashboardExpertId++
    const profile = {
      expert_profile_id: expertProfileId,
      user_id: userId,
      first_name: data.first_name,
      last_name: data.last_name,
      headline: data.headline || '',
      bio: data.bio || '',
      years_of_experience: data.years_of_experience ?? 0,
      linkedin_url: data.linkedin_url || '',
      hourly_rate_min: data.hourly_rate_min ?? null,
      hourly_rate_max: data.hourly_rate_max ?? null,
      availability_status: data.availability_status || 'available',
      preferred_engagement_length: data.preferred_engagement_length || 'both',
      is_verified: false,
      verification_status: 'unsubmitted',
      avg_rating: null,
      total_completed_engagements: 0,
      credentials: [],
      verification_records: [],
      work_history: [],
      specializations: [],
      sector_experience: [],
      engagement_types: [],
    }
    profiles[expertProfileId] = profile
    saveExpertProfiles(profiles)
    seedConnectionsForExpert(expertProfileId)
    return delay(profile)
  },

  async updateProfile(expertId, patch) {
    const profiles = loadExpertProfiles()
    if (!profiles[expertId]) {
      throw new ApiError(404, 'NOT_FOUND', 'No profile to update.')
    }
    profiles[expertId] = { ...profiles[expertId], ...patch }
    saveExpertProfiles(profiles)
    return delay(profiles[expertId])
  },

  async addSpecialization(expertId, spec) {
    const profiles = loadExpertProfiles()
    const profile = profiles[expertId]
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No profile found for this expert.')
    const item = { specialization_id: Date.now(), ...spec }
    profile.specializations.push(item)
    saveExpertProfiles(profiles)
    return delay(item)
  },

  async removeSpecialization(expertId, specializationId) {
    const profiles = loadExpertProfiles()
    const profile = profiles[expertId]
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No profile found for this expert.')
    profile.specializations = profile.specializations.filter((s) => s.specialization_id !== specializationId)
    saveExpertProfiles(profiles)
    return delay({})
  },
}

// ---------------- Matching (GET /connections, PATCH /connections/:id) ----------------
// Neither endpoint takes an explicit expert id — like the real API, the
// caller is identified from the session, not from a parameter.

export const connectionsApi = {
  async listForExpert() {
    const session = authApi.getSession()
    const profile = session ? findProfileByUserId(session.user.user_id) : null
    if (!profile) return delay([])
    const all = loadConnections()
    const mine = all
      .filter((c) => c.expert_id === profile.expert_profile_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return delay(mine)
  },

  async respond(connectionId, status) {
    if (!['accepted', 'declined'].includes(status)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Status must be accepted or declined.')
    }
    const all = loadConnections()
    const connection = all.find((c) => c.connection_id === connectionId)
    if (!connection) throw new ApiError(404, 'NOT_FOUND', 'Connection request not found.')
    if (connection.status !== 'pending') {
      throw new ApiError(422, 'INVALID_STATE', 'This request has already been responded to.')
    }
    connection.status = status
    connection.responded_at = new Date().toISOString()
    saveConnections(all)

    // Mock-only convenience: the contract doesn't document PATCH
    // /connections/:id auto-creating an engagement on acceptance. This exists
    // so the Overview tab's "Active Engagements" list has something to show
    // in the demo — confirm with the backend team whether acceptance really
    // should create an engagement automatically, or whether that's a
    // separate explicit POST /engagements step the org or expert takes later.
    if (status === 'accepted') {
      const engagements = loadEngagements()
      engagements.push({
        engagement_id: nextEngagementId++,
        connection_id: connection.connection_id,
        expert_id: connection.expert_id,
        org_name: connection.org_name,
        engagement_type: connection.org_stated_need,
        title: `${connection.org_stated_need ? labelize(connection.org_stated_need) : 'Engagement'} — ${connection.org_name}`,
        status: 'scoping',
        created_at: new Date().toISOString(),
      })
      saveEngagements(engagements)
    }

    return delay(connection)
  },
}

// ---------------- Engagements (GET /engagements) ----------------

export const engagementsApi = {
  async listForExpert() {
    const session = authApi.getSession()
    const profile = session ? findProfileByUserId(session.user.user_id) : null
    if (!profile) return delay([])
    const all = loadEngagements()
    const mine = all
      .filter((e) => e.expert_id === profile.expert_profile_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return delay(mine)
  },
}
