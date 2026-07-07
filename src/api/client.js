// Mock client that mirrors api-contract.md's request/response shapes and status
// codes. Every page talks to *this* module, never to mock data directly — once
// the FastAPI backend exists, only the bodies of these functions change (to
// real `fetch` calls against VITE_API_BASE_URL); callers stay the same.

import { mockExperts, verifiedMockExperts } from '../data/mockExperts'

const USERS_KEY = 'qc_mock_users'
const SESSION_KEY = 'qc_mock_session'
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

export const expertsApi = {
  async list(filters = {}) {
    let results = [...verifiedMockExperts]

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
    const expert = mockExperts.find((e) => String(e.expert_profile_id) === String(expertId))
    if (!expert) {
      throw new ApiError(404, 'NOT_FOUND', 'Expert profile not found.')
    }
    return delay(expert)
  },
}
