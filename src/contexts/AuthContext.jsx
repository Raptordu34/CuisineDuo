import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_CACHE_KEY = 'cachedProfile'
const USER_CACHE_KEY = 'cachedUser'
const AUTH_TIMEOUT_MS = 5000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  // AbortController courant pour annuler les requetes en vol
  const abortRef = useRef(null)
  // Eviter les appels concurrents a fetchProfile
  const fetchingRef = useRef(false)
  // Ref pour acceder au profil dans onAuthStateChange sans le mettre en dep
  const profileRef = useRef(null)
  profileRef.current = profile

  const cacheProfile = (profileData) => {
    if (profileData) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData))
    }
  }

  const getCachedProfile = () => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  }

  const getCachedUser = () => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  }

  const cacheUser = (userData) => {
    if (userData) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify({ id: userData.id, email: userData.email }))
    }
  }

  // Fetch profile avec AbortController pour pouvoir annuler la requete
  const fetchProfile = async (userId, signal) => {
    const query = supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    const { data, error } = signal ? await query.abortSignal(signal) : await query
    if (error) {
      // Ne pas logger les abort
      if (error.name !== 'AbortError' && error.code !== 'PGRST116') {
        console.error('Failed to fetch profile:', error.message)
      }
      return null
    }
    return data
  }

  // Fetch profile deduplicado : annule la requete precedente, timeout, abort propre
  const fetchProfileSafe = useCallback(async (userId) => {
    // Annuler la requete precedente si elle existe
    if (abortRef.current) abortRef.current.abort()
    if (fetchingRef.current) return null

    fetchingRef.current = true
    const controller = new AbortController()
    abortRef.current = controller

    // Timeout : abort apres AUTH_TIMEOUT_MS
    const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)

    try {
      const data = await fetchProfile(userId, controller.signal)
      clearTimeout(timeout)
      return data
    } catch {
      clearTimeout(timeout)
      return null
    } finally {
      fetchingRef.current = false
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  // Tente de re-synchroniser le profil quand le reseau revient
  const syncProfile = useCallback(async () => {
    if (!user) return
    const data = await fetchProfileSafe(user.id)
    if (data) {
      setProfile(data)
      cacheProfile(data)
      setIsOffline(false)
    }
  }, [user, fetchProfileSafe])

  useEffect(() => {
    let mounted = true
    let initDone = false

    const initAuth = async () => {
      try {
        // Supabase stocke la session en localStorage — getSession() est normalement instantane
        // Mais avec des extensions/intercepteurs ca peut bloquer, d'ou le timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)
        )
        const result = await Promise.race([sessionPromise, timeoutPromise])

        if (!mounted) return

        const session = result?.data?.session

        if (session?.user) {
          setUser(session.user)
          cacheUser(session.user)

          const data = await fetchProfileSafe(session.user.id)
          if (mounted) {
            if (data) {
              setProfile(data)
              cacheProfile(data)
              setIsOffline(false)
            } else {
              // Timeout ou erreur — fallback cache
              const cached = getCachedProfile()
              if (cached) {
                setProfile(cached)
                setIsOffline(true)
              }
            }
          }
        } else if (!result) {
          // Timeout sur getSession — fallback cache complet
          if (mounted) {
            const cachedUser = getCachedUser()
            const cachedProfile = getCachedProfile()
            if (cachedUser && cachedProfile) {
              setUser(cachedUser)
              setProfile(cachedProfile)
              setIsOffline(true)
            }
          }
        }
        // result existe mais pas de session = pas connecte (normal)
      } catch {
        // Erreur reseau sur getSession — fallback cache
        if (mounted) {
          const cachedUser = getCachedUser()
          const cachedProfile = getCachedProfile()
          if (cachedUser && cachedProfile) {
            setUser(cachedUser)
            setProfile(cachedProfile)
            setIsOffline(true)
          }
        }
      } finally {
        if (mounted) {
          setLoading(false)
          initDone = true
        }
      }
    }

    initAuth()

    // Ecouter les changements d'etat d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        // Ignorer INITIAL_SESSION car deja gere par initAuth
        if (event === 'INITIAL_SESSION') return
        // Pour TOKEN_REFRESHED, pas besoin de re-fetch le profil si on l'a deja
        if (event === 'TOKEN_REFRESHED' && profileRef.current) {
          setUser(session?.user ?? null)
          if (session?.user) cacheUser(session.user)
          return
        }

        setUser(session?.user ?? null)
        if (session?.user) {
          cacheUser(session.user)
          const data = await fetchProfileSafe(session.user.id)
          if (mounted) {
            if (data) {
              setProfile(data)
              cacheProfile(data)
              setIsOffline(false)
            } else {
              const cached = getCachedProfile()
              if (cached) setProfile(cached)
            }
          }
        } else {
          setProfile(null)
          localStorage.removeItem(PROFILE_CACHE_KEY)
          localStorage.removeItem(USER_CACHE_KEY)
        }
        if (mounted && !initDone) setLoading(false)
      }
    )

    // Re-synchroniser quand le reseau revient
    const handleOnline = () => syncProfile()
    window.addEventListener('online', handleOnline)

    return () => {
      mounted = false
      // Annuler toute requete en vol
      if (abortRef.current) abortRef.current.abort()
      subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [syncProfile, fetchProfileSafe])

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
    setIsOffline(false)
    localStorage.removeItem('profileId')
    localStorage.removeItem(PROFILE_CACHE_KEY)
    localStorage.removeItem(USER_CACHE_KEY)
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id)
      if (data) setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOffline, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
