import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(() => !!localStorage.getItem('profileId'))

  const fetchProfile = async (profileId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    if (error) {
      console.error('Failed to fetch profile:', error.message)
      return null
    }
    return data
  }

  useEffect(() => {
    const savedId = localStorage.getItem('profileId')
    if (savedId) {
      fetchProfile(savedId).then((data) => {
        if (!data) localStorage.removeItem('profileId')
        setProfile(data)
        setLoading(false)
      }).catch(() => {
        setLoading(false)
      })
    }
  }, [])

  const selectProfile = async (id) => {
    localStorage.setItem('profileId', id)
    const data = await fetchProfile(id)
    setProfile(data)
  }

  const signOut = () => {
    localStorage.removeItem('profileId')
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (profile) {
      const data = await fetchProfile(profile.id)
      if (data) setProfile(data)
    }
  }

  return (
    <AuthContext.Provider value={{ profile, loading, selectProfile, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
