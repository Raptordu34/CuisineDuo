import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useMessageReactions(profile, messageIds) {
  const [reactions, setReactions] = useState({})
  const prevIdsRef = useRef('')

  // Construire la map des reactions a partir des donnees brutes
  const buildReactionsMap = useCallback((data, profileId) => {
    const map = {}
    for (const r of data) {
      if (!map[r.message_id]) map[r.message_id] = {}
      if (!map[r.message_id][r.emoji]) {
        map[r.message_id][r.emoji] = { count: 0, profiles: [], reactedByMe: false }
      }
      map[r.message_id][r.emoji].count++
      map[r.message_id][r.emoji].profiles.push(r.profiles?.display_name || '?')
      if (r.profile_id === profileId) {
        map[r.message_id][r.emoji].reactedByMe = true
      }
    }
    return map
  }, [])

  // Fetch initial des reactions
  useEffect(() => {
    if (!messageIds.length || !profile?.id) return

    const idsKey = messageIds.join(',')
    if (idsKey === prevIdsRef.current) return
    prevIdsRef.current = idsKey

    const fetchReactions = async () => {
      const { data } = await supabase
        .from('message_reactions')
        .select('*, profiles(display_name)')
        .in('message_id', messageIds)

      if (data) {
        setReactions(buildReactionsMap(data, profile.id))
      }
    }

    fetchReactions()
  }, [messageIds, profile?.id, buildReactionsMap])

  // Subscription Realtime
  useEffect(() => {
    if (!profile?.household_id) return

    const channel = supabase
      .channel(`reactions:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async () => {
          // Re-fetch toutes les reactions pour les messages affiches
          if (!prevIdsRef.current) return
          const ids = prevIdsRef.current.split(',')
          const { data } = await supabase
            .from('message_reactions')
            .select('*, profiles(display_name)')
            .in('message_id', ids)

          if (data) {
            setReactions(buildReactionsMap(data, profile.id))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [profile?.household_id, profile?.id, buildReactionsMap])

  // Toggle reaction avec update optimiste
  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!profile?.id) return

    const currentReactions = reactions[messageId]?.[emoji]
    const alreadyReacted = currentReactions?.reactedByMe

    // Update optimiste
    setReactions((prev) => {
      const updated = { ...prev }
      if (!updated[messageId]) updated[messageId] = {}

      if (alreadyReacted) {
        // Retirer ma reaction
        const entry = { ...updated[messageId][emoji] }
        entry.count = Math.max(0, entry.count - 1)
        entry.reactedByMe = false
        entry.profiles = entry.profiles.filter((_, i) => i !== entry.profiles.indexOf(profile.display_name))
        if (entry.count === 0) {
          const { [emoji]: _, ...rest } = updated[messageId]
          updated[messageId] = rest
        } else {
          updated[messageId] = { ...updated[messageId], [emoji]: entry }
        }
      } else {
        // Ajouter ma reaction
        const entry = updated[messageId][emoji]
          ? { ...updated[messageId][emoji] }
          : { count: 0, profiles: [], reactedByMe: false }
        entry.count++
        entry.reactedByMe = true
        entry.profiles = [...entry.profiles, profile.display_name]
        updated[messageId] = { ...updated[messageId], [emoji]: entry }
      }

      return updated
    })

    // Appel Supabase
    if (alreadyReacted) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('profile_id', profile.id)
        .eq('emoji', emoji)
    } else {
      await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, profile_id: profile.id, emoji })
    }
  }, [profile?.id, profile?.display_name, reactions])

  return { reactionsByMessageId: reactions, toggleReaction }
}
