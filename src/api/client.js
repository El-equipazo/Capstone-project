// Mock client that mirrors api-contract.md's request/response shapes and status
// codes. Every page talks to *this* module, never to mock data directly — once
// the FastAPI backend exists, only the bodies of these functions change (to
// real `fetch` calls against VITE_API_BASE_URL); callers stay the same.

import { mockExperts, verifiedMockExperts } from '../data/mockExperts'
import { labelize } from '../utils/format'

const USERS_KEY = 'qc_mock_users'
const SESSION_KEY = 'qc_mock_session'
// Profiles created through the expert dashboard, keyed by user_id — separate from
// the seeded mockExperts.js directory data, mirroring how a real backend would
// have `expert_profiles.user_id` rows independent of any fixture data.
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

let nextDashboardExpertId = 5000
let nextConnectionId = 9000
let nextEngagementId = 9500

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

function seedConnectionsForExpert(expertId) {
  const all = loadConnections()
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
}

// ---------------- Discovery (GET /experts, GET /experts/:expertId) ----------------

function allDashboardProfiles() {
  return Object.values(loadExpertProfiles())
}

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

  // ---------------- Expert dashboard (POST /experts, PATCH /experts/:id, specializations CRUD) ----------------

  async getByUserId(userId) {
    const profiles = loadExpertProfiles()
    return delay(profiles[userId] ?? null)
  },

  async createProfile(userId, data) {
    const profiles = loadExpertProfiles()
    if (profiles[userId]) {
      throw new ApiError(409, 'CONFLICT', 'Profile already exists for this user.')
    }
    const profile = {
      expert_profile_id: nextDashboardExpertId++,
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
    profiles[userId] = profile
    saveExpertProfiles(profiles)
    seedConnectionsForExpert(profile.expert_profile_id)
    return delay(profile)
  },

  async updateProfile(userId, patch) {
    const profiles = loadExpertProfiles()
    if (!profiles[userId]) {
      throw new ApiError(404, 'NOT_FOUND', 'No profile to update.')
    }
    profiles[userId] = { ...profiles[userId], ...patch }
    saveExpertProfiles(profiles)
    return delay(profiles[userId])
  },

  async addSpecialization(userId, spec) {
    const profiles = loadExpertProfiles()
    const profile = profiles[userId]
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No profile found for this user.')
    const item = { specialization_id: Date.now(), ...spec }
    profile.specializations.push(item)
    saveExpertProfiles(profiles)
    return delay(item)
  },

  async removeSpecialization(userId, specializationId) {
    const profiles = loadExpertProfiles()
    const profile = profiles[userId]
    if (!profile) throw new ApiError(404, 'NOT_FOUND', 'No profile found for this user.')
    profile.specializations = profile.specializations.filter((s) => s.specialization_id !== specializationId)
    saveExpertProfiles(profiles)
    return delay({})
  },
}

// ---------------- Matching (GET /connections, PATCH /connections/:id) ----------------

export const connectionsApi = {
  async listForExpert(expertId) {
    const all = loadConnections()
    const mine = all
      .filter((c) => c.expert_id === expertId)
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
  async listForExpert(expertId) {
    const all = loadEngagements()
    const mine = all
      .filter((e) => e.expert_id === expertId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return delay(mine)
  },
}
