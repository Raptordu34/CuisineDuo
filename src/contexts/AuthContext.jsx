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

    // Si on a un profil cache, debloquer l'UI immediatement
    // getSession() peut bloquer longtemps (Web Locks API + token refresh)
    if (cachedProfile) {
      setLoading(false)
    }

    const syncSession = async () => {
      try {
        const t0 = Date.now()
        const { data: { session } } = await supabase.auth.getSession()
        console.log(`[Auth] getSession() resolved in ${Date.now() - t0}ms`)
        if (cancelled) return

        if (session?.user) {
          setUser(session.user)

          // Charger le profil frais en arriere-plan
          setSyncing(true)
          try {
            const freshProfile = await Promise.race([
              fetchProfile(session.user.id),
              new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
            ])
            if (cancelled) return
            if (freshProfile) {
              setProfile(freshProfile)
              setCachedProfile(freshProfile)
            }
          } finally {
            setSyncing(false)
          }

          // Valider la session cote serveur (non-bloquant, uniquement en ligne)
          if (navigator.onLine) {
            try {
              const { error: userError } = await supabase.auth.getUser()
              if (cancelled) return
              if (userError) {
                console.warn('[Auth] Session invalide cote serveur:', userError.message)
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
          }
        } else {
          // Pas de session Supabase
          if (!navigator.onLine && cachedProfile) {
            // Hors ligne avec un profil cache — on garde l'etat pour ne pas rediriger
            console.warn('[Auth] Pas de session mais hors ligne — on garde le cache')
          } else {
            setUser(null)
            if (!cachedProfile) {
              setProfile(null)
            }
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error('[Auth] Init error:', err)
      } finally {
        // Dans tous les cas, s'assurer que le loading est coupe
        setLoading(false)
        initializedRef.current = true
      }
    }

    syncSession()

    // Ecouter les changements (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return
        if (!initializedRef.current && event === 'INITIAL_SESSION') return

        // Si on recoit un SIGNED_OUT alors qu'on est hors ligne,
        // c'est un echec de token refresh — pas une vraie deconnexion.
        // On garde la session locale et le profil cache.
        if (event === 'SIGNED_OUT' && !navigator.onLine) {
          console.warn('[Auth] SIGNED_OUT recu hors ligne — ignore, on garde le cache')
          return
        }

        setUser(session?.user ?? null)
        if (session?.user) {
          // CRITIQUE : ne pas awaiting Supabase ici pour éviter deadlock.
          setTimeout(async () => {
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
          }, 0)
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
