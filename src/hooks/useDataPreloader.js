import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const INVENTORY_CACHE_KEY = 'cuisineduo_inventory'
const MESSAGES_CACHE_KEY = 'cuisineduo_messages'
const STATS_CACHE_KEY = 'cuisineduo_stats'

// Precharge et cache toutes les donnees au lancement de l'app (une seule fois)
export default function useDataPreloader() {
  const { profile } = useAuth()
  const preloadedRef = useRef(false)

  useEffect(() => {
    if (!profile?.household_id || !navigator.onLine || preloadedRef.current) return
    preloadedRef.current = true

    const householdId = profile.household_id

    const preload = async () => {
      const t0 = Date.now()

      // Lancer les 3 fetches en parallele
      const [inventoryResult, messagesResult, statsResult] = await Promise.allSettled([
        // Inventaire
        supabase
          .from('inventory_items')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false }),

        // Messages (200 derniers)
        supabase
          .from('messages')
          .select('*, profiles(display_name)')
          .eq('household_id', householdId)
          .order('created_at', { ascending: true })
          .limit(200),

        // Stats : items + consumed du mois
        Promise.all([
          supabase
            .from('inventory_items')
            .select('id, price, estimated_expiry_date')
            .eq('household_id', householdId),
          supabase
            .from('consumed_items')
            .select('price')
            .eq('household_id', householdId)
            .gte('consumption_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
        ]),
      ])

      // Cacher l'inventaire (seulement si pas deja en cache ou plus recent)
      if (inventoryResult.status === 'fulfilled' && inventoryResult.value.data) {
        try {
          localStorage.setItem(
            `${INVENTORY_CACHE_KEY}_${householdId}`,
            JSON.stringify(inventoryResult.value.data)
          )
        } catch { /* localStorage plein */ }
      }

      // Cacher les messages
      if (messagesResult.status === 'fulfilled' && messagesResult.value.data) {
        try {
          localStorage.setItem(
            `${MESSAGES_CACHE_KEY}_${householdId}`,
            JSON.stringify(messagesResult.value.data.slice(-200))
          )
        } catch { /* localStorage plein */ }
      }

      // Cacher les stats
      if (statsResult.status === 'fulfilled') {
        try {
          const [itemsRes, consumedRes] = statsResult.value
          if (itemsRes.data) {
            const items = itemsRes.data
            const now = new Date()
            const threeDays = 3 * 24 * 60 * 60 * 1000
            const expiringSoon = items.filter(
              (i) => i.estimated_expiry_date && new Date(i.estimated_expiry_date) > now && (new Date(i.estimated_expiry_date) - now) < threeDays
            ).length
            const purchaseTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
            const consumedTotal = consumedRes?.data ? consumedRes.data.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0) : 0

            localStorage.setItem(
              `${STATS_CACHE_KEY}_${householdId}`,
              JSON.stringify({
                inStock: items.length,
                expenses: (purchaseTotal + consumedTotal).toFixed(2),
                expiringSoon,
              })
            )
          }
        } catch { /* localStorage plein */ }
      }

      console.log(`[Preloader] Donnees prechargees en ${Date.now() - t0}ms`)
    }

    preload().catch((err) => {
      console.warn('[Preloader] Erreur de prechargement:', err.message)
    })
  }, [profile?.household_id])
}
