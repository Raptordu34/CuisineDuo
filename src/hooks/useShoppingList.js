import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useShoppingList(householdId) {
  const [lists, setLists] = useState([])
  const [activeListId, setActiveListId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch all lists for household
  const fetchLists = useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      return
    }

    try {
      const { data } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })

      const allLists = data || []
      setLists(allLists)

      // Auto-select active list
      if (allLists.length > 0) {
        const active = allLists.find((l) => l.status === 'active') || allLists[0]
        setActiveListId((prev) => prev && allLists.find((l) => l.id === prev) ? prev : active.id)
      }
    } catch {
      // Table may not exist yet
    } finally {
      setLoading(false)
    }
  }, [householdId])

  // Fetch items for active list
  const fetchItems = useCallback(async () => {
    if (!activeListId) {
      setItems([])
      return
    }

    try {
      const { data } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', activeListId)
        .order('checked', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('category', { ascending: true })

      setItems(data || [])
    } catch {
      // Table may not exist yet
    }
  }, [activeListId])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Realtime subscription on shopping_list_items
  useEffect(() => {
    if (!activeListId) return

    const channel = supabase
      .channel(`shopping-items-${activeListId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list_items', filter: `list_id=eq.${activeListId}` },
        () => {
          fetchItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeListId, fetchItems])

  const activeList = lists.find((l) => l.id === activeListId) || null

  const createList = useCallback(async (name, createdBy, sessionId) => {
    if (!householdId) return null

    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({
        household_id: householdId,
        name,
        created_by: createdBy,
        session_id: sessionId || null,
      })
      .select()
      .single()

    if (!error && data) {
      setLists((prev) => [data, ...prev])
      setActiveListId(data.id)
    }
    return data
  }, [householdId])

  const toggleItem = useCallback(async (itemId, profileId) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return

    const checked = !item.checked
    await supabase
      .from('shopping_list_items')
      .update({
        checked,
        checked_by: checked ? profileId : null,
        checked_at: checked ? new Date().toISOString() : null,
      })
      .eq('id', itemId)

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, checked, checked_by: checked ? profileId : null, checked_at: checked ? new Date().toISOString() : null }
          : i
      )
    )
  }, [items])

  const addItem = useCallback(async ({ name, quantity, unit, category, notes }) => {
    if (!activeListId) return null

    const { data, error } = await supabase
      .from('shopping_list_items')
      .insert({
        list_id: activeListId,
        name,
        quantity: quantity || null,
        unit: unit || null,
        category: category || 'other',
        notes: notes || null,
      })
      .select()
      .single()

    if (!error && data) {
      setItems((prev) => [...prev, data])
    }
    return data
  }, [activeListId])

  const removeItem = useCallback(async (itemId) => {
    await supabase.from('shopping_list_items').delete().eq('id', itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const updateItem = useCallback(async (itemId, updates) => {
    await supabase.from('shopping_list_items').update(updates).eq('id', itemId)
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)))
  }, [])

  const archiveList = useCallback(async (listId) => {
    await supabase.from('shopping_lists').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', listId)
    fetchLists()
  }, [fetchLists])

  const deleteList = useCallback(async (listId) => {
    await supabase.from('shopping_lists').delete().eq('id', listId)
    setLists((prev) => prev.filter((l) => l.id !== listId))
    if (activeListId === listId) {
      setActiveListId(null)
    }
  }, [activeListId])

  return {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    items,
    loading,
    createList,
    toggleItem,
    addItem,
    removeItem,
    updateItem,
    archiveList,
    deleteList,
    refetch: fetchLists,
  }
}
