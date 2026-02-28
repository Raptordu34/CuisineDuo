import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_CACHE_KEY = 'cuisineduo_cached_profile'

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
    // localStorage indisponible
  }
}

export function AuthProvider({ children }) {
  const cachedProfile = getCachedProfile()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(cachedProfile)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const initializedRef = useRef(false)

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[Auth] Failed to fetch profile:', error.message)
      return null
    }
    return data
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      // Sécurité : au bout de 5s, on force la fin du loading au cas où Supabase/le réseau serait totalement bloqué
      const safetyTimeout = setTimeout(() => {
        if (!cancelled && !initializedRef.current) {
          console.warn('[Auth] Init timeout de securite, on coupe le loading')
          setLoading(false)
        }
      }, 5000)

      // ETAPE 1 : getSession() — lit le localStorage Supabase, quasi-instantane
      // Cela restaure le JWT dans le client Supabase pour que les requetes RLS fonctionnent
      try {
        const fetchSessionPromise = supabase.auth.getSession()
        const sessionTimeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 4000))
        
        const sessionResult = await Promise.race([fetchSessionPromise, sessionTimeoutPromise])
        if (cancelled) {
          clearTimeout(safetyTimeout)
          return
        }

        if (sessionResult === 'timeout') {
          console.warn('[Auth] supabase.auth.getSession timeout')
          throw new Error('getSession timeout')
        }

        const { data: { session } } = sessionResult

        if (session?.user) {
          setUser(session.user)
          // Si on a un profil cache, on affiche tout de suite
          if (cachedProfile) {
            setLoading(false)
          }

          // ETAPE 2 : charger le profil frais (reseau) en arriere-plan
          setSyncing(true)

          const fetchPromise = fetchProfile(session.user.id)
          const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000))
          
          const freshProfileOrTimeout = await Promise.race([fetchPromise, timeoutPromise])

          if (cancelled) return

          if (freshProfileOrTimeout !== 'timeout' && freshProfileOrTimeout) {
            setProfile(freshProfileOrTimeout)
            setCachedProfile(freshProfileOrTimeout)
          } else if (freshProfileOrTimeout === 'timeout') {
            console.warn('[Auth] fetchProfile timeout - proceeding with local cache')
          }

          // Si echec, on garde le cache — pas de deconnexion
          setSyncing(false)
          setLoading(false)

          // ETAPE 3 : valider la session cote serveur (non-bloquant)
          // Ceci detecte les tokens expires/revoques
          try {
            const { error: userError } = await supabase.auth.getUser()
            if (cancelled) return
            if (userError) {
              console.warn('[Auth] Session invalide cote serveur:', userError.message)
              // Tenter un refresh avant de deconnecter
              const { data: refreshData } = await supabase.auth.refreshSession()
              if (!refreshData?.session) {
                console.warn('[Auth] Refresh echoue — deconnexion')
                await supabase.auth.signOut().catch(() => {})
                setUser(null)
                setProfile(null)
                setCachedProfile(null)
              }
            }
          } catch {
            // Erreur reseau sur getUser — ignorer, on garde la session locale
          }
        } else {
          // Pas de session
          setUser(null)
          if (!cachedProfile) {
            setProfile(null)
          }
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[Auth] Init error:', err)
        // getSession a echoue — utiliser le cache si disponible
        if (cachedProfile) {
          setProfile(cachedProfile)
        }
        setLoading(false)
      } finally {
        if (typeof safetyTimeout !== 'undefined') {
          clearTimeout(safetyTimeout)
        }
      }

      initializedRef.current = true
    }

    init()

    // Ecouter les changements (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        // Ignorer les evenements avant l'init pour eviter les races
        if (!initializedRef.current && event === 'INITIAL_SESSION') return

        setUser(session?.user ?? null)
        if (session?.user) {
          try {
            const data = await fetchProfile(session.user.id)
            if (cancelled) return
            if (data) {
              setProfile(data)
              setCachedProfile(data)
            }
          } catch (err) {
            console.warn('[Auth] fetchProfile error in onAuthStateChange:', err.message)
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
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error }

    if (data.user) {
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
    <AuthContext.Provider value={{ user, profile, loading, syncing, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
