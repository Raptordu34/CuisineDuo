import { createContext, useContext, useState, useCallback } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('lang') || 'fr'
  })

  const setLang = useCallback((code) => {
    localStorage.setItem('lang', code)
    setLangState(code)
  }, [])

  const t = useCallback((key, params) => {
    const str = translations[lang]?.[key] || translations.fr[key] || key
    if (!params) return str
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '')
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
