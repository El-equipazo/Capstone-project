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

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials)
    setSession(result)
    return result
  }, [])

  const register = useCallback(async (details) => {
    return authApi.register(details)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user ?? null, login, register, logout }),
    [session, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
