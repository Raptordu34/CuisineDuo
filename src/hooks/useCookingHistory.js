import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useCookingHistory(householdId) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      return
    }

    try {
      const { data } = await supabase
        .from('cooking_history')
        .select('*, recipes(name, image_url)')
        .eq('household_id', householdId)
        .order('cooked_at', { ascending: false })
        .limit(50)

      setHistory(data || [])
    } catch {
      // Table may not exist yet
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const logCook = useCallback(async ({ recipeId, cookedBy, notes, servingsCooked }) => {
    if (!householdId) return null

    const { data, error } = await supabase
      .from('cooking_history')
      .insert({
        recipe_id: recipeId,
        household_id: householdId,
        cooked_by: cookedBy,
        notes: notes || null,
        servings_cooked: servingsCooked || null,
      })
      .select()
      .single()

    if (!error && data) {
      setHistory((prev) => [data, ...prev])
    }
    return data
  }, [householdId])

  return { history, loading, logCook, refetch: fetchHistory }
}
