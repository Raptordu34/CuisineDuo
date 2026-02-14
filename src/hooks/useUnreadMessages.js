import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STORAGE_KEY_PREFIX = 'chat_lastReadAt_'

export default function useUnreadMessages() {
  const { profile } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const profileId = profile?.id
  const householdId = profile?.household_id

  const getLastReadAt = useCallback(() => {
    if (!profileId) return null
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + profileId)
    return stored || new Date(0).toISOString()
  }, [profileId])

  const markAsRead = useCallback(() => {
    if (!profileId) return
    localStorage.setItem(STORAGE_KEY_PREFIX + profileId, new Date().toISOString())
    setUnreadCount(0)
  }, [profileId])

  useEffect(() => {
    if (!profileId || !householdId) return

    const lastReadAt = getLastReadAt()

    // Requete initiale pour compter les messages non lus
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .neq('profile_id', profileId)
        .gt('created_at', lastReadAt)

      if (count != null) setUnreadCount(count)
    }

    fetchUnreadCount()

    // Ecouter les nouveaux messages en temps reel
    const channel = supabase
      .channel(`unread:${householdId}:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          // Ignorer ses propres messages
          if (payload.new.profile_id === profileId) return
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profileId, householdId, getLastReadAt])

  return { unreadCount, markAsRead }
}
