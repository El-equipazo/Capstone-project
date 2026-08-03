import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'qc_language'
const DEFAULT_LANGUAGE = 'en'

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && translations[stored] ? stored : DEFAULT_LANGUAGE
  })

  const setLanguage = useCallback((lang) => {
    if (!translations[lang]) return
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }, [])

  // Falls back to English for any key not yet translated in the active
  // language, and to the raw key itself if it's missing from English too
  // (makes a typo'd/forgotten key visible instead of rendering blank).
  const t = useCallback((key) => {
    return (
      getNested(translations[language], key) ??
      getNested(translations[DEFAULT_LANGUAGE], key) ??
      key
    )
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
