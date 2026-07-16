// API client that talks to the FastAPI backend at VITE_API_BASE_URL.
// All callers use the same function signatures as the old localStorage mock,
// so no page components needed to change.

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
const SESSION_KEY = 'qc_session'

class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.body = { error: { code, message } }
  }
}

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function authHeader() {
  const session = getStoredSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, options)

  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const err = data?.error ?? {}
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText)
  }
  return data
}

// ---------------- Auth -------------------------------------------------------

export const authApi = {
  async register({ email, password, role }) {
    return await apiFetch('/auth/register', { method: 'POST', body: { email, password, role } })
  },

  async login({ email, password }) {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } })
    const session = { access_token: data.access_token, user: data.user }
    storeSession(session)
    return session
  },

  logout() {
    const session = getStoredSession()
    if (session) {
      // Best-effort server-side logout; ignore failure (token self-expires)
      apiFetch('/auth/logout', { method: 'POST', headers: authHeader() }).catch(() => {})
    }
    localStorage.removeItem(SESSION_KEY)
  },

  getSession() {
    return getStoredSession()
  },

  async me() {
    const session = getStoredSession()
    if (!session) throw new ApiError(401, 'UNAUTHORIZED', 'Not signed in.')
    const data = await apiFetch('/auth/me', { headers: authHeader() })
    // Transform flat response into { user, profile } shape the dashboard expects
    const { profile, ...userFields } = data
    const user = { user_id: userFields.user_id, email: userFields.email, role: userFields.role }
    // Keep stored session user fields fresh
    storeSession({ ...session, user })
    return { user, profile }
  },
}

// ---------------- Experts ----------------------------------------------------

export const expertsApi = {
  async list(filters = {}) {
    const params = new URLSearchParams()
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, val)
      }
    }
    const qs = params.toString() ? `?${params}` : ''
    return await apiFetch(`/experts${qs}`)
  },

  async getById(expertId) {
    return await apiFetch(`/experts/${expertId}`)
  },

  // userId param kept for signature compatibility; the real API ignores it
  // (user comes from the JWT)
  async createProfile(_userId, data) {
    return await apiFetch('/experts', {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async updateProfile(expertId, patch) {
    return await apiFetch(`/experts/${expertId}`, {
      method: 'PATCH',
      body: patch,
      headers: authHeader(),
    })
  },

  async addSpecialization(expertId, spec) {
    return await apiFetch(`/experts/${expertId}/specializations`, {
      method: 'POST',
      body: spec,
      headers: authHeader(),
    })
  },

  async removeSpecialization(expertId, specializationId) {
    return await apiFetch(`/experts/${expertId}/specializations/${specializationId}`, {
      method: 'DELETE',
      headers: authHeader(),
    })
  },
}

// ---------------- Connections ------------------------------------------------

export const connectionsApi = {
  async create(expertId, { initial_message = '', org_stated_need = null, org_stated_timeline = null } = {}) {
    return await apiFetch('/connections', {
      method: 'POST',
      body: { expert_id: expertId, initial_message, org_stated_need, org_stated_timeline },
      headers: authHeader(),
    })
  },

  async listForExpert() {
    return await apiFetch('/connections', { headers: authHeader() })
  },

  async respond(connectionId, status) {
    return await apiFetch(`/connections/${connectionId}`, {
      method: 'PATCH',
      body: { status },
      headers: authHeader(),
    })
  },
}

// ---------------- Engagements ------------------------------------------------

export const engagementsApi = {
  async listForExpert() {
    return await apiFetch('/engagements', { headers: authHeader() })
  },
}
