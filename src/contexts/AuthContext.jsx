import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Failed to fetch profile:', error.message)
      return null
    }
    return data
  }

  useEffect(() => {
    // Recuperer la session existante au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).then((data) => {
          setProfile(data)
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Ecouter les changements d'etat d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const data = await fetchProfile(session.user.id)
          setProfile(data)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
      if (data) setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, resetPassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
