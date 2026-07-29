// API client that talks to the FastAPI backend at VITE_API_BASE_URL.
// All callers use the same function signatures as the old localStorage mock,
// so no page components needed to change.

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
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
    // A 401 with a stored session means the token has expired — clear it so the
    // user is prompted to log in again instead of looping on stale credentials.
    if (res.status === 401 && getStoredSession()) {
      localStorage.removeItem(SESSION_KEY)
      window.dispatchEvent(new Event('auth:session-expired'))
    }
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

  // GET /auth/me already resolves either an organization_profile or an
  // expert_profile server-side depending on the user's role, so this stays
  // generic rather than branching on role itself.
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

  async listCredentials(expertId) {
    return await apiFetch(`/experts/${expertId}/credentials`, { headers: authHeader() })
  },

  async addCredential(expertId, data) {
    return await apiFetch(`/experts/${expertId}/credentials`, {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async deleteCredential(expertId, credentialId) {
    return await apiFetch(`/experts/${expertId}/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: authHeader(),
    })
  },
}

// ---------------- Organizations -----------------------------------------------
// Same userId-kept-for-signature-compatibility pattern as expertsApi above —
// POST /organizations and PATCH /organizations/:orgId already exist server-side
// (server/controllers/organizations.py + server/models/organization_model.py).

export const organizationsApi = {
  async createProfile(_userId, data) {
    return await apiFetch('/organizations', {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async updateProfile(orgId, patch) {
    return await apiFetch(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: patch,
      headers: authHeader(),
    })
  },

  async getInfrastructure(orgId) {
    return await apiFetch(`/organizations/${orgId}/infrastructure`, { headers: authHeader() })
  },

  async upsertInfrastructure(orgId, data) {
    return await apiFetch(`/organizations/${orgId}/infrastructure`, {
      method: 'PUT',
      body: data,
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

  // GET /connections now returns the standard { data, pagination } envelope
  // (api-contract.md §1.3); unwrap it here so page components can keep
  // treating this as a plain array. The backend scopes the result to the
  // caller's own side (sent vs received) based on their role, so the org and
  // expert variants hit the same endpoint.
  async listForExpert() {
    const result = await apiFetch('/connections', { headers: authHeader() })
    return result.data
  },

  async listForOrg() {
    const result = await apiFetch('/connections', { headers: authHeader() })
    return result.data
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
  async create(data) {
    return await apiFetch('/engagements', {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async list(filters = {}) {
    const params = new URLSearchParams()
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '') params.set(key, val)
    }
    const qs = params.toString() ? `?${params}` : ''
    const result = await apiFetch(`/engagements${qs}`, { headers: authHeader() })
    return result.data
  },

  // kept for backwards compat with ExpertDashboard
  async listForExpert() {
    const result = await apiFetch('/engagements', { headers: authHeader() })
    return result.data
  },

  // Participant-gated (unlike expertsApi.getById, which is public directory
  // data) -- must send the auth header.
  async getById(engagementId) {
    return await apiFetch(`/engagements/${engagementId}`, { headers: authHeader() })
  },

  async update(engagementId, data) {
    return await apiFetch(`/engagements/${engagementId}`, {
      method: 'PATCH',
      body: data,
      headers: authHeader(),
    })
  },

  async listMilestones(engagementId) {
    return await apiFetch(`/engagements/${engagementId}/milestones`, { headers: authHeader() })
  },

  async createMilestone(engagementId, data) {
    return await apiFetch(`/engagements/${engagementId}/milestones`, {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async updateMilestone(engagementId, milestoneId, data) {
    return await apiFetch(`/engagements/${engagementId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: data,
      headers: authHeader(),
    })
  },

  async confirmMilestone(engagementId, milestoneId) {
    return await apiFetch(`/engagements/${engagementId}/milestones/${milestoneId}/confirm`, {
      method: 'POST',
      headers: authHeader(),
    })
  },

  async deleteMilestone(engagementId, milestoneId) {
    return await apiFetch(`/engagements/${engagementId}/milestones/${milestoneId}`, {
      method: 'DELETE',
      headers: authHeader(),
    })
  },
}

// ---------------- Notifications -------------------------------------------

export const notificationsApi = {
  async list({ isRead } = {}) {
    const params = new URLSearchParams()
    if (isRead !== undefined) params.set('is_read', isRead)
    const qs = params.toString() ? `?${params}` : ''
    const result = await apiFetch(`/notifications${qs}`, { headers: authHeader() })
    return result.data
  },

  async unreadCount() {
    return await apiFetch('/notifications/unread-count', { headers: authHeader() })
  },

  async markRead(notificationId) {
    return await apiFetch(`/notifications/${notificationId}`, {
      method: 'PATCH',
      body: { is_read: true },
      headers: authHeader(),
    })
  },

  async markAllRead() {
    return await apiFetch('/notifications/read-all', { method: 'POST', headers: authHeader() })
  },
}

// ---------------- Verifications ----------------------------------------------

export const verificationsApi = {
  async submit(data) {
    return await apiFetch('/verifications', {
      method: 'POST',
      body: data,
      headers: authHeader(),
    })
  },

  async list() {
    return await apiFetch('/verifications', { headers: authHeader() })
  },
}

// ---------------- Admin -------------------------------------------------------

export const adminApi = {
  async listExpertProfiles({ is_verified } = {}) {
    const params = new URLSearchParams()
    if (is_verified != null) params.set('is_verified', is_verified)
    const qs = params.toString() ? `?${params}` : ''
    return await apiFetch(`/admin/experts${qs}`, { headers: authHeader() })
  },

  async listOrganizationProfiles({ is_verified } = {}) {
    const params = new URLSearchParams()
    if (is_verified != null) params.set('is_verified', is_verified)
    const qs = params.toString() ? `?${params}` : ''
    return await apiFetch(`/admin/organizations${qs}`, { headers: authHeader() })
  },

  async listUsers({ role, is_active } = {}) {
    const params = new URLSearchParams()
    if (role != null) params.set('role', role)
    if (is_active != null) params.set('is_active', is_active)
    const qs = params.toString() ? `?${params}` : ''
    return await apiFetch(`/admin/users${qs}`, { headers: authHeader() })
  },

  async setUserActive(userId, isActive) {
    return await apiFetch(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: { is_active: isActive },
      headers: authHeader(),
    })
  },

  async listVerifications({ status, verification_type } = {}) {
    const params = new URLSearchParams()
    if (status != null) params.set('status', status)
    if (verification_type != null) params.set('verification_type', verification_type)
    const qs = params.toString() ? `?${params}` : ''
    return await apiFetch(`/admin/verifications${qs}`, { headers: authHeader() })
  },

  async decideVerification(verificationId, data) {
    return await apiFetch(`/admin/verifications/${verificationId}`, {
      method: 'PATCH',
      body: data,
      headers: authHeader(),
    })
  },

  async reviewVerificationWithAI(verificationId) {
    return await apiFetch(`/admin/verifications/${verificationId}/ai-review`, {
      method: 'POST',
      headers: authHeader(),
    })
  },

  async setExpertVerified(expertProfileId, isVerified) {
    return await apiFetch(`/admin/experts/${expertProfileId}/verify`, {
      method: 'PATCH',
      body: { is_verified: isVerified },
      headers: authHeader(),
    })
  },

  async verifyOrganization(orgProfileId) {
    return await apiFetch(`/admin/organizations/${orgProfileId}/verify`, {
      method: 'PATCH',
      body: { is_verified: true },
      headers: authHeader(),
    })
  },
}

// ---------------- AI Matching --------------------------------------------------
// POST /matching/recommendations returns a flat { model, recommendations }
// object, not the { data, pagination } envelope other list endpoints use —
// nothing to unwrap here.

export const matchingApi = {
  async getRecommendations({ need_description, limit = 5 } = {}) {
    return await apiFetch('/matching/recommendations', {
      method: 'POST',
      body: { need_description, limit },
      headers: authHeader(),
    })
  },
}

// ---------------- Uploads -----------------------------------------------------
// multipart/form-data, so this can't go through apiFetch (which always
// JSON-encodes the body) — a raw fetch with FormData, no Content-Type
// override (the browser sets the multipart boundary itself).

export const uploadsApi = {
  async upload(file) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${BASE}/uploads`, {
      method: 'POST',
      headers: authHeader(),
      body: formData,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      const err = data?.error ?? {}
      throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText)
    }
    return data
  },
}

// ---------------- Threads (pre-connection inquiry chat) -----------------------

export const threadsApi = {
  async getOrCreate(expertProfileId) {
    return await apiFetch('/threads', {
      method: 'POST',
      body: { expert_profile_id: expertProfileId },
      headers: authHeader(),
    })
  },

  async list() {
    return await apiFetch('/threads', { headers: authHeader() })
  },

  async messages(threadId, { page = 1, limit = 20 } = {}) {
    return await apiFetch(`/threads/${threadId}/messages?page=${page}&limit=${limit}`, {
      headers: authHeader(),
    })
  },

  async send(threadId, content) {
    return await apiFetch(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: { message_type: 'text', content },
      headers: authHeader(),
    })
  },

  async markRead(threadId) {
    return await apiFetch(`/threads/${threadId}/messages/read`, {
      method: 'POST',
      body: { all: true },
      headers: authHeader(),
    })
  },

  async getOrCreateForEngagement(engagementId) {
    return await apiFetch(`/engagements/${engagementId}/thread`, { headers: authHeader() })
  },

  wsUrl(threadId) {
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1'
    const wsBase = base.startsWith('/')
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${base}`
      : base.replace(/^http/, 'ws')
    const token = authApi.getSession()?.access_token ?? ''
    return `${wsBase}/threads/${threadId}/ws?token=${encodeURIComponent(token)}`
  },
}
