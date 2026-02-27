import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_CACHE_KEY = 'cuisineduo_cached_profile'
const SESSION_TIMEOUT_MS = 8000 // 8 secondes max pour le chargement de session

function getCachedProfile() {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

function setCachedProfile(profile) {
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY)
    }
  } catch {
    // localStorage indisponible — ignorer
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [profileLoadFailed, setProfileLoadFailed] = useState(false)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Failed to fetch profile:', error.message, error.code, error.details)
      return null
    }
    return data
  }

  // Valide la session cote serveur et retourne le user valide, ou null
  const validateSession = async () => {
    try {
      const { data: { user: validUser }, error } = await supabase.auth.getUser()
      if (error || !validUser) {
        console.warn('Session invalide cote serveur:', error?.message)
        return null
      }
      return validUser
    } catch (err) {
      console.error('Erreur validation session:', err)
      return null
    }
  }

  useEffect(() => {
    const handleOnline = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    // Timeout de securite : si getSession prend trop longtemps, charger depuis le cache
    const timeoutId = setTimeout(() => {
      if (cancelled) return
      const cached = getCachedProfile()
      if (cached) {
        console.warn('Auth session timeout — loading from cache')
        setProfile(cached)
      }
      // Pas de cache, pas de session → on laisse passer vers le login
      setLoading(false)
    }, SESSION_TIMEOUT_MS)

    // Recuperer la session existante au chargement
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return

      if (session?.user) {
        // Valider la session cote serveur avec getUser()
        const validUser = await validateSession()
        if (cancelled) return

        if (!validUser) {
          // Session locale invalide (token expire, compte supprime, etc.)
          console.warn('Session locale invalide — deconnexion automatique')
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setCachedProfile(null)
          clearTimeout(timeoutId)
          setLoading(false)
          return
        }

        setUser(validUser)
        const data = await fetchProfile(validUser.id)
        if (cancelled) return

        if (data) {
          setProfile(data)
          setCachedProfile(data)
          setProfileLoadFailed(false)
        } else {
          // fetchProfile a echoue malgre une session valide
          // Tenter un refresh de session puis re-essayer une fois
          console.warn('fetchProfile echoue, tentative de refresh session...')
          const { data: refreshData } = await supabase.auth.refreshSession()
          if (cancelled) return

          if (refreshData?.session) {
            const retryData = await fetchProfile(validUser.id)
            if (cancelled) return
            if (retryData) {
              setProfile(retryData)
              setCachedProfile(retryData)
              setProfileLoadFailed(false)
            } else {
              // Echec confirme — utiliser le cache ou marquer l'echec
              const cached = getCachedProfile()
              if (cached) {
                setProfile(cached)
                setProfileLoadFailed(false)
              } else {
                setProfileLoadFailed(true)
              }
            }
          } else {
            // Refresh echoue — utiliser le cache
            const cached = getCachedProfile()
            if (cached) {
              setProfile(cached)
              setProfileLoadFailed(false)
            } else {
              setProfileLoadFailed(true)
            }
          }
        }
      } else {
        setUser(null)
        // Pas de session Supabase — verifier le cache en cas de mode hors ligne
        if (!navigator.onLine) {
          const cached = getCachedProfile()
          if (cached) {
            setProfile(cached)
          }
        }
      }
      clearTimeout(timeoutId)
      setLoading(false)
    }).catch((err) => {
      if (cancelled) return
      console.error('Auth session error:', err)
      // Echec total — utiliser le cache si disponible
      const cached = getCachedProfile()
      if (cached) {
        setProfile(cached)
      }
      clearTimeout(timeoutId)
      setLoading(false)
    })

    // Ecouter les changements d'etat d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const data = await fetchProfile(session.user.id)
          if (data) {
            setProfile(data)
            setCachedProfile(data)
            setProfileLoadFailed(false)
          } else {
            // fetchProfile a echoue — utiliser le cache
            const cached = getCachedProfile()
            if (cached) {
              setProfile(cached)
              setProfileLoadFailed(false)
            } else {
              setProfileLoadFailed(true)
            }
          }
        } else {
          setProfile(null)
          setCachedProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email, password, displayName) => {
    // Le display_name est passe via les metadata — le trigger DB cree le profil automatiquement
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error }

    // Le trigger on_auth_user_created cree le profil cote serveur.
    // Attendre un court instant pour que le trigger s'execute, puis charger le profil.
    if (data.user) {
      // Petit delai pour laisser le trigger s'executer
      await new Promise((resolve) => setTimeout(resolve, 500))
      const profileData = await fetchProfile(data.user.id)
      setProfile(profileData)
      setCachedProfile(profileData)
    }

    return { error: null }
  }

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setCachedProfile(null)
    // Nettoyage de l'ancien systeme
    localStorage.removeItem('profileId')
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id)
      if (data) {
        setProfile(data)
        setCachedProfile(data)
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, offline, profileLoadFailed, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
