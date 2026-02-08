import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const TASTE_KEYS = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']

function computeTasteProfile(ratings, tasteParamsMap) {
  // Weighted average: each taste param weighted by the user's rating
  const sums = {}
  const weights = {}

  TASTE_KEYS.forEach(key => {
    sums[key] = 0
    weights[key] = 0
  })

  for (const r of ratings) {
    const tp = tasteParamsMap[r.recipe_id]
    if (!tp) continue
    for (const key of TASTE_KEYS) {
      if (tp[key] != null) {
        sums[key] += tp[key] * r.rating
        weights[key] += r.rating
      }
    }
  }

  const profile = {}
  for (const key of TASTE_KEYS) {
    profile[key] = weights[key] > 0 ? sums[key] / weights[key] : null
  }
  return profile
}

export function useTasteProfile(profileId, householdId) {
  const [userTasteProfile, setUserTasteProfile] = useState(null)
  const [householdTasteProfiles, setHouseholdTasteProfiles] = useState(null)
  const [ratingsCount, setRatingsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!profileId || !householdId) {
      setLoading(false)
      return
    }

    try {
      // Get all household members
      const { data: members } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', householdId)

      if (!members) {
        setLoading(false)
        return
      }

      const memberIds = members.map(m => m.id)

      // Get all ratings for household members
      const { data: allRatings } = await supabase
        .from('recipe_ratings')
        .select('recipe_id, profile_id, rating')
        .in('profile_id', memberIds)

      if (!allRatings || allRatings.length === 0) {
        setLoading(false)
        return
      }

      // Get unique recipe IDs
      const recipeIds = [...new Set(allRatings.map(r => r.recipe_id))]

      // Get taste params for those recipes
      const { data: tasteParams } = await supabase
        .from('recipe_taste_params')
        .select('*')
        .in('recipe_id', recipeIds)

      const tasteParamsMap = {}
      for (const tp of (tasteParams || [])) {
        tasteParamsMap[tp.recipe_id] = tp
      }

      // Compute per-member profiles
      const profiles = []
      for (const member of members) {
        const memberRatings = allRatings.filter(r => r.profile_id === member.id)
        if (memberRatings.length === 0) continue
        const profile = computeTasteProfile(memberRatings, tasteParamsMap)
        profiles.push({
          profileId: member.id,
          displayName: member.display_name,
          tasteProfile: profile,
          ratingsCount: memberRatings.length,
        })
      }

      setHouseholdTasteProfiles(profiles.length > 0 ? profiles : null)

      // Current user's profile
      const currentUser = profiles.find(p => p.profileId === profileId)
      const currentUserRatings = allRatings.filter(r => r.profile_id === profileId)
      setRatingsCount(currentUserRatings.length)
      if (currentUser) {
        setUserTasteProfile(currentUser.tasteProfile)
      }
    } catch {
      // Tables may not exist yet
    } finally {
      setLoading(false)
    }
  }, [profileId, householdId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { userTasteProfile, householdTasteProfiles, ratingsCount, loading, refetch: fetch }
}
