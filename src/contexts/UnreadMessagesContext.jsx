import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const UnreadMessagesContext = createContext(null)

const POLLING_INTERVAL = 5000

export function UnreadMessagesProvider({ children }) {
  const { profile } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [readStatuses, setReadStatuses] = useState([])
  const lastReadAtRef = useRef(null)
  const lastReadAtState = useRef(null)

  const profileId = profile?.id
  const householdId = profile?.household_id

  // Requete pour compter les messages non lus
  const fetchUnreadCount = useCallback(async () => {
    if (!profileId || !householdId) return
    const since = lastReadAtState.current || new Date(0).toISOString()

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .neq('profile_id', profileId)
      .gt('created_at', since)

    if (count != null) setUnreadCount(count)
  }, [profileId, householdId])

  // Charger le last_read_at depuis Supabase
  const fetchLastReadAt = useCallback(async () => {
    if (!profileId || !householdId) return null

    const { data } = await supabase
      .from('chat_read_status')
      .select('last_read_at')
      .eq('profile_id', profileId)
      .eq('household_id', householdId)
      .single()

    const ts = data?.last_read_at || new Date(0).toISOString()
    lastReadAtState.current = ts
    if (!lastReadAtRef.current) lastReadAtRef.current = ts
    return ts
  }, [profileId, householdId])

  // Marquer comme lu via upsert dans Supabase
  const markAsRead = useCallback(async () => {
    if (!profileId || !householdId) return
    const now = new Date().toISOString()

    await supabase
      .from('chat_read_status')
      .upsert(
        { profile_id: profileId, household_id: householdId, last_read_at: now },
        { onConflict: 'profile_id,household_id' }
      )

    lastReadAtState.current = now
    setUnreadCount(0)
  }, [profileId, householdId])

  // Charger les read statuses des autres membres du foyer
  const fetchReadStatuses = useCallback(async () => {
    if (!householdId || !profileId) return

    const { data } = await supabase
      .from('chat_read_status')
      .select('profile_id, last_read_at, profiles(display_name)')
      .eq('household_id', householdId)
      .neq('profile_id', profileId)

    if (data) setReadStatuses(data)
  }, [householdId, profileId])

  useEffect(() => {
    if (!profileId || !householdId) return

    let pollingInterval = null
    let realtimeActive = false

    const init = async () => {
      await fetchLastReadAt()
      await fetchReadStatuses()
      await fetchUnreadCount()
    }

    const startPolling = () => {
      if (pollingInterval) return
      pollingInterval = setInterval(() => {
        fetchUnreadCount()
        fetchReadStatuses()
      }, POLLING_INTERVAL)
    }

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    init()

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
          if (payload.new.profile_id === profileId) return
          setUnreadCount((prev) => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_read_status',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const updated = payload.new
          if (updated.profile_id === profileId) return
          setReadStatuses((prev) => {
            const idx = prev.findIndex((r) => r.profile_id === updated.profile_id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...next[idx], last_read_at: updated.last_read_at }
              return next
            }
            fetchReadStatuses()
            return prev
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          realtimeActive = true
          stopPolling()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          realtimeActive = false
          startPolling()
        }
      })

    // Re-fetch au retour au premier plan
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
        fetchReadStatuses()
        if (!realtimeActive && !pollingInterval) {
          startPolling()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [profileId, householdId, fetchLastReadAt, fetchReadStatuses, fetchUnreadCount])

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, lastReadAtRef, readStatuses, markAsRead }}>
      {children}
    </UnreadMessagesContext.Provider>
  )
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext)
  if (!context) throw new Error('useUnreadMessages must be used within UnreadMessagesProvider')
  return context
}
