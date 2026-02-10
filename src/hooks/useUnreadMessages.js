import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useUnreadMessages(profile) {
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnread = useCallback(async () => {
    if (!profile?.id || !profile?.household_id) return

    // Get the read cursor for this profile
    const { data: cursor } = await supabase
      .from('chat_read_cursors')
      .select('last_read_at')
      .eq('profile_id', profile.id)
      .eq('household_id', profile.household_id)
      .maybeSingle()

    const lastReadAt = cursor?.last_read_at || '1970-01-01T00:00:00Z'

    // Count messages after cursor that are not from me
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', profile.household_id)
      .neq('profile_id', profile.id)
      .gt('created_at', lastReadAt)

    setUnreadCount(count || 0)
  }, [profile?.id, profile?.household_id])

  useEffect(() => {
    fetchUnread()

    if (!profile?.household_id) return

    // Subscribe to new messages to update count in realtime
    const channel = supabase
      .channel(`unread:${profile.household_id}:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${profile.household_id}`,
        },
        (payload) => {
          if (payload.new.profile_id !== profile.id) {
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.household_id, profile?.id, fetchUnread])

  const markAsRead = useCallback(async () => {
    if (!profile?.id || !profile?.household_id) return

    await supabase
      .from('chat_read_cursors')
      .upsert({
        profile_id: profile.id,
        household_id: profile.household_id,
        last_read_at: new Date().toISOString(),
      }, { onConflict: 'profile_id,household_id' })

    setUnreadCount(0)
  }, [profile?.id, profile?.household_id])

  return { unreadCount, markAsRead, refetchUnread: fetchUnread }
}
