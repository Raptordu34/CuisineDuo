import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useSwipeSession(sessionId, profileId, householdId) {
  const [session, setSession] = useState(null)
  const [recipes, setRecipes] = useState([])
  const [votes, setVotes] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const statusRef = useRef(null)

  const fetchAll = useCallback(async () => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    try {
      // Fetch session + recipes in parallel
      const [sessionResult, recipesResult] = await Promise.all([
        supabase
          .from('swipe_sessions')
          .select('*')
          .eq('id', sessionId)
          .single(),
        supabase
          .from('swipe_session_recipes')
          .select('*')
          .eq('session_id', sessionId)
          .order('sort_order', { ascending: true }),
      ])

      const sessionData = sessionResult.data
      const recipesData = recipesResult.data || []

      // Fetch votes + members in parallel
      const [votesResult, membersResult] = await Promise.all([
        recipesData.length > 0
          ? supabase
              .from('swipe_votes')
              .select('*')
              .in('session_recipe_id', recipesData.map(r => r.id))
          : { data: [] },
        sessionData?.household_id
          ? supabase
              .from('profiles')
              .select('id, display_name')
              .eq('household_id', sessionData.household_id)
          : { data: [] },
      ])

      // Update all states together to avoid partial renders
      statusRef.current = sessionData?.status
      setSession(sessionData)
      setRecipes(recipesData)
      setVotes(votesResult.data || [])
      setMembers(membersResult.data || [])
    } catch {
      // Tables may not exist yet
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Realtime on recipe updates (e.g. images loaded in background)
  useEffect(() => {
    if (!sessionId || recipes.length === 0) return

    const channel = supabase
      .channel(`swipe-recipes-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'swipe_session_recipes' },
        (payload) => {
          const updated = payload.new
          if (updated?.session_id === sessionId) {
            setRecipes(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, recipes.length])

  // Realtime on votes
  useEffect(() => {
    if (!sessionId || recipes.length === 0) return

    const recipeIds = recipes.map(r => r.id)

    const channel = supabase
      .channel(`swipe-votes-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swipe_votes' },
        (payload) => {
          const vote = payload.new
          if (vote && recipeIds.includes(vote.session_recipe_id)) {
            setVotes(prev => {
              const existing = prev.findIndex(v => v.id === vote.id)
              if (existing >= 0) {
                const next = [...prev]
                next[existing] = vote
                return next
              }
              return [...prev, vote]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, recipes])

  // Realtime on session status
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`swipe-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'swipe_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.new?.status === 'voting' && statusRef.current === 'generating') {
            fetchAll()
          } else {
            setSession(payload.new)
            statusRef.current = payload.new?.status
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchAll])

  // Polling fallback while generating (every 2s)
  useEffect(() => {
    if (!sessionId || statusRef.current !== 'generating') return
    if (session?.status !== 'generating') return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('swipe_sessions')
        .select('status')
        .eq('id', sessionId)
        .single()

      if (data && data.status !== 'generating') {
        clearInterval(interval)
        fetchAll()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId, session?.status, fetchAll])

  // Derived state
  const myVotes = votes.filter(v => v.profile_id === profileId)
  const otherVotes = votes.filter(v => v.profile_id !== profileId)

  const myVotedRecipeIds = new Set(myVotes.map(v => v.session_recipe_id))
  const unvotedRecipes = recipes.filter(r => !myVotedRecipeIds.has(r.id))

  // Match = ALL members voted true
  const matches = recipes.filter(recipe => {
    const recipeVotes = votes.filter(v => v.session_recipe_id === recipe.id)
    if (recipeVotes.length < members.length) return false
    return members.every(m => {
      const memberVote = recipeVotes.find(v => v.profile_id === m.id)
      return memberVote?.vote === true
    })
  })

  // Progress per member
  const membersProgress = members.map(m => {
    const memberVotes = votes.filter(v => v.profile_id === m.id)
    return {
      profileId: m.id,
      displayName: m.display_name,
      votedCount: memberVotes.length,
      totalCount: recipes.length,
    }
  })

  const isComplete = members.length > 0 && membersProgress.every(m => m.votedCount >= m.totalCount) && recipes.length > 0

  const vote = useCallback(async (sessionRecipeId, liked) => {
    const { data, error } = await supabase
      .from('swipe_votes')
      .upsert({
        session_recipe_id: sessionRecipeId,
        profile_id: profileId,
        vote: liked,
      }, { onConflict: 'session_recipe_id,profile_id' })
      .select()
      .single()

    if (!error && data) {
      setVotes(prev => {
        const existing = prev.findIndex(v => v.session_recipe_id === sessionRecipeId && v.profile_id === profileId)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = data
          return next
        }
        return [...prev, data]
      })
    }
    return data
  }, [profileId])

  const cancelSession = useCallback(async () => {
    if (!sessionId) return
    await supabase
      .from('swipe_sessions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    statusRef.current = 'cancelled'
    setSession(prev => prev ? { ...prev, status: 'cancelled' } : prev)
  }, [sessionId])

  return {
    session,
    recipes,
    votes,
    myVotes,
    otherVotes,
    unvotedRecipes,
    matches,
    members,
    membersProgress,
    loading,
    vote,
    cancelSession,
    isComplete,
    refetch: fetchAll,
  }
}
