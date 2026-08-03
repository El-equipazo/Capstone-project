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
  // which login() never returns) to localStorage, but that alone doesn't
  // update this component's live session state -- nothing re-renders
  // without going through setSession here.
  const refreshUser = useCallback(async () => {
    const { user } = await authApi.me()
    setSession((prev) => (prev ? { ...prev, user } : prev))
    return user
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
