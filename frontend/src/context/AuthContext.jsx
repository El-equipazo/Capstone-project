import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => authApi.getSession())

  // apiFetch dispatches this event when it clears a stale token on 401,
  // so React state stays in sync without a circular import.
  useEffect(() => {
    const handler = () => setSession(null)
    window.addEventListener('auth:session-expired', handler)
    return () => window.removeEventListener('auth:session-expired', handler)
  }, [])

  // authApi.me() persists its fresher user fields (e.g. is_email_verified,
  // profile_photo_url, which login() never returns) to localStorage, but
  // that alone doesn't update this component's live session state --
  // nothing re-renders without going through setSession here.
  const refreshUser = useCallback(async () => {
    const { user } = await authApi.me()
    setSession((prev) => (prev ? { ...prev, user } : prev))
    return user
  }, [])

  // A session restored from localStorage (i.e. every page load after the
  // first) is whatever `login()`/`me()` last stored -- it can be missing
  // fields added since then (is_email_verified, profile_photo_url), or
  // just be stale (an expert uploaded a new photo in another tab). Refresh
  // once on mount so those show up without forcing a re-login.
  useEffect(() => {
    if (session) refreshUser().catch(() => {})
    // Intentionally mount-only: refreshUser is stable, and re-running this
    // on every session change would just refetch after every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials)
    setSession(result)
    // login()'s own response never includes is_email_verified (see
    // UserInToken) -- fetch it in the background so the navbar's status
    // row has something to show shortly after, without making every login
    // wait on a second request first.
    refreshUser().catch(() => {})
    return result
  }, [refreshUser])

  const register = useCallback(async (details) => {
    return authApi.register(details)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user ?? null, login, register, logout, refreshUser }),
    [session, login, register, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
