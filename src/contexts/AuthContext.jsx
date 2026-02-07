import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (profileId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single()
    return data
  }

  useEffect(() => {
    const savedId = localStorage.getItem('profileId')
    if (savedId) {
      fetchProfile(savedId).then((data) => {
        setProfile(data)
        setLoading(false)
      })
    } else {
      setLoading(false)
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
      setProfile(data)
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
