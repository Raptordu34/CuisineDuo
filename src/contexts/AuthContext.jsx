import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  const fetchProfile = async (userId) => {
    console.log('[Auth] fetchProfile start userId=', userId)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[Auth] fetchProfile error:', error.code, error.message)
      return null
    }
    console.log('[Auth] fetchProfile success household_id=', data?.household_id)
    return data
  }

  useEffect(() => {
    console.log('[Auth] useEffect init')

    // onAuthStateChange est la seule source de verite — inclut INITIAL_SESSION
    // Ne pas utiliser getSession() separement : il bloque les requetes suivantes
    // pendant le refresh du token (deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] onAuthStateChange event=', event, 'user=', session?.user?.id ?? 'null')

        if (event === 'PASSWORD_RECOVERY') {
          setUser(session?.user ?? null)
          setPasswordRecovery(true)
          setLoading(false)
          return
        }

        // TOKEN_REFRESHED : juste mettre a jour le user, le profil est deja charge
        if (event === 'TOKEN_REFRESHED') {
          setUser(session?.user ?? null)
          return
        }

        // INITIAL_SESSION, SIGNED_IN, SIGNED_OUT
        if (session?.user) {
          setUser(session.user)
          setLoading(true)
          // Defer profile fetch to escape the supabase auth lock
          // (making async supabase queries inside onAuthStateChange deadlocks)
          const userId = session.user.id
          setTimeout(async () => {
            const data = await fetchProfile(userId)
            console.log('[Auth] profile loaded=', !!data, 'household_id=', data?.household_id)
            setProfile(data)
            setLoading(false)
          }, 0)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

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
    }

    return { error: null }
  }

  const signIn = async (email, password) => {
    console.log('[Auth] signIn start')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    console.log('[Auth] signIn result error=', error?.message ?? 'null')
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    localStorage.removeItem('profileId')
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) {
      setPasswordRecovery(false)
      if (user) {
        const data = await fetchProfile(user.id)
        if (data) setProfile(data)
      }
    }
    return { error }
  }

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id)
      if (data) setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, passwordRecovery, signUp, signIn, signOut, resetPassword, updatePassword, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
