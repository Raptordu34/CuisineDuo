import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// Normalize string for matching: lowercase, remove accents, trim
function normalize(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Unit conversion to a common base (ml for liquids, g for solids)
const UNIT_TO_ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 }
const UNIT_TO_G = { g: 1, kg: 1000 }
const NO_QTY_UNITS = new Set(['pinch', 'bunch', 'slice', 'clove', 'none', 'can', 'pack'])

function convertToBase(qty, unit) {
  if (!qty || !unit) return null
  const u = unit.toLowerCase()
  if (UNIT_TO_G[u] != null) return { value: qty * UNIT_TO_G[u], type: 'weight' }
  if (UNIT_TO_ML[u] != null) return { value: qty * UNIT_TO_ML[u], type: 'volume' }
  if (u === 'piece') return { value: qty, type: 'piece' }
  return null
}

export function useInventoryMatch(ingredients, householdId) {
  const [inventoryItems, setInventoryItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!householdId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const fetch = async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('household_id', householdId)
      if (!cancelled) {
        setInventoryItems(data || [])
        setLoading(false)
      }
    }

    fetch()

    const channel = supabase
      .channel(`inv-match:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `household_id=eq.${householdId}`,
        },
        () => fetch()
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [householdId])

  const matches = useMemo(() => {
    if (!ingredients || ingredients.length === 0) return []

    return ingredients.map((ing) => {
      const ingName = normalize(ing.name)
      if (!ingName) return { status: 'missing', inventoryItems: [], availableQty: 0, neededQty: ing.quantity || 0 }

      // Find all matching inventory items
      const matchingItems = inventoryItems.filter((item) => {
        const itemName = normalize(item.name)
        return itemName.includes(ingName) || ingName.includes(itemName)
      })

      if (matchingItems.length === 0) {
        return { status: 'missing', inventoryItems: [], availableQty: 0, neededQty: ing.quantity || 0 }
      }

      const ingUnit = (ing.unit || 'none').toLowerCase()

      // For units where we can't compare quantities, just check presence
      if (NO_QTY_UNITS.has(ingUnit) || !ing.quantity) {
        return { status: 'available', inventoryItems: matchingItems, availableQty: null, neededQty: null }
      }

      // Convert recipe ingredient to base
      const neededBase = convertToBase(ing.quantity, ingUnit)
      if (!neededBase) {
        return { status: 'available', inventoryItems: matchingItems, availableQty: null, neededQty: null }
      }

      // Sum available qty from all matching inventory items (converted to same base)
      let totalAvailable = 0
      let hasComparable = false

      for (const item of matchingItems) {
        const itemUnit = (item.unit || 'piece').toLowerCase()
        const effectiveQty = (item.quantity || 0) * (item.fill_level ?? 1)
        const itemBase = convertToBase(effectiveQty, itemUnit)

        if (itemBase && itemBase.type === neededBase.type) {
          totalAvailable += itemBase.value
          hasComparable = true
        }
      }

      if (!hasComparable) {
        // Units are incompatible, just show as available (present in inventory)
        return { status: 'available', inventoryItems: matchingItems, availableQty: null, neededQty: null }
      }

      const neededValue = neededBase.value

      if (totalAvailable >= neededValue) {
        return { status: 'available', inventoryItems: matchingItems, availableQty: totalAvailable, neededQty: neededValue, baseType: neededBase.type }
      } else {
        return { status: 'partial', inventoryItems: matchingItems, availableQty: totalAvailable, neededQty: neededValue, baseType: neededBase.type }
      }
    })
  }, [ingredients, inventoryItems])

  return { matches, inventoryItems, loading }
}

// Utility: format base qty back to a readable unit
export function formatBaseQty(value, baseType) {
  if (value == null) return ''
  if (baseType === 'weight') {
    if (value >= 1000) return `${Math.round(value / 100) / 10}kg`
    return `${Math.round(value)}g`
  }
  if (baseType === 'volume') {
    if (value >= 1000) return `${Math.round(value / 100) / 10}L`
    return `${Math.round(value)}ml`
  }
  return `${Math.round(value)}`
}
