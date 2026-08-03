import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'qc_theme'

function osPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function ThemeProvider({ children }) {
  // null = no explicit choice made yet -- the stylesheet's
  // prefers-color-scheme media query drives the look until the user toggles.
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  })

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem(STORAGE_KEY, theme)
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const current = prev ?? (osPrefersDark() ? 'dark' : 'light')
      return current === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const effectiveTheme = theme ?? (osPrefersDark() ? 'dark' : 'light')

  const value = useMemo(
    () => ({ theme: effectiveTheme, toggleTheme }),
    [effectiveTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
