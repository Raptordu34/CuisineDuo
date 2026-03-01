import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import useOnlineStatus from './useOnlineStatus'
import {
  getAllRecipes,
  getRecipe as getRecipeFromIDB,
  putRecipes,
  putRecipe,
  deleteRecipeLocal,
  addToSyncQueue,
  getPendingCountByRecipeId,
} from '../lib/offlineRecipeStore'
import { processSyncQueue } from '../lib/syncManager'

const RECIPES_CACHE_KEY = 'cuisineduo_recipes'

/**
 * Migre le cache localStorage existant vers IndexedDB (une seule fois).
 */
async function migrateFromLocalStorage(householdId) {
  const lsKey = `${RECIPES_CACHE_KEY}_${householdId}`
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return null
    const recipes = JSON.parse(raw)
    if (Array.isArray(recipes) && recipes.length > 0) {
      await putRecipes(recipes)
      localStorage.removeItem(lsKey)
      return recipes
    }
    localStorage.removeItem(lsKey)
  } catch {
    // Nettoyage en cas d'erreur de parsing
    try { localStorage.removeItem(lsKey) } catch { /* ignore */ }
  }
  return null
}

export default function useOfflineRecipes(householdId) {
  const status = useOnlineStatus()
  const isOffline = status === 'offline'
  const [recipes, setRecipes] = useState([])
  const [pendingSyncIds, setPendingSyncIds] = useState(new Set())
  const mountedRef = useRef(true)
  const initialLoadDone = useRef(false)

  // Charger les pendingSyncIds
  const refreshPendingIds = useCallback(async () => {
    const map = await getPendingCountByRecipeId()
    if (mountedRef.current) {
      setPendingSyncIds(new Set(map.keys()))
    }
  }, [])

  // Fetch depuis Supabase
  const fetchFromServer = useCallback(async () => {
    if (!householdId) return null
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_ratings(rating, profile_id), cooking_history(cooked_at)')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    } catch {
      return null
    }
  }, [householdId])

  // Refresh complet depuis le serveur
  const refreshFromServer = useCallback(async () => {
    const data = await fetchFromServer()
    if (data && mountedRef.current) {
      setRecipes(data)
      await putRecipes(data)
      await refreshPendingIds()
    }
  }, [fetchFromServer, refreshPendingIds])

  // Chargement initial : IDB d'abord, puis Supabase en arriere-plan
  useEffect(() => {
    if (!householdId || initialLoadDone.current) return
    initialLoadDone.current = true

    const load = async () => {
      // 1. Migration localStorage → IDB
      const migrated = await migrateFromLocalStorage(householdId)

      // 2. Charger depuis IDB
      const cached = migrated || await getAllRecipes(householdId)
      if (cached.length > 0 && mountedRef.current) {
        setRecipes(cached)
      }

      // 3. Charger les pending sync IDs
      await refreshPendingIds()

      // 4. Fetch depuis Supabase en arriere-plan
      const serverData = await fetchFromServer()
      if (serverData && mountedRef.current) {
        setRecipes(serverData)
        await putRecipes(serverData)
      }
    }

    load()
  }, [householdId, fetchFromServer, refreshPendingIds])

  // Quand on repasse online : sync + refresh
  const prevOnlineRef = useRef(!isOffline)
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current
    prevOnlineRef.current = !isOffline

    if (wasOffline && !isOffline) {
      const syncAndRefresh = async () => {
        const result = await processSyncQueue()
        if (result.synced > 0 || result.failed > 0) {
          await refreshPendingIds()
        }
        await refreshFromServer()
      }
      syncAndRefresh()
    }
  }, [isOffline, refreshFromServer, refreshPendingIds])

  // Cleanup
  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  // Lecture d'une recette individuelle (avec fallback IDB)
  const getRecipe = useCallback(async (id) => {
    // D'abord chercher dans l'etat local
    const fromState = recipes.find(r => r.id === id)
    if (fromState) return fromState
    // Sinon IDB
    return getRecipeFromIDB(id)
  }, [recipes])

  // Sauvegarder une recette (optimistic + queue si offline)
  const saveRecipe = useCallback(async (id, updates) => {
    // Mise a jour optimiste du state
    setRecipes(prev => prev.map(r =>
      r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
    ))

    // Mise a jour IDB
    const existing = await getRecipeFromIDB(id)
    if (existing) {
      await putRecipe({ ...existing, ...updates, updated_at: new Date().toISOString() })
    }

    if (isOffline) {
      // Ajouter a la file de sync
      await addToSyncQueue({
        type: 'update',
        recipeId: id,
        payload: updates,
      })
      await refreshPendingIds()
    } else {
      // Mutation Supabase directe
      const { error } = await supabase
        .from('recipes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        // Fallback : ajouter a la queue pour retry
        await addToSyncQueue({
          type: 'update',
          recipeId: id,
          payload: updates,
        })
        await refreshPendingIds()
      }
    }
  }, [isOffline, refreshPendingIds])

  // Supprimer une recette (optimistic + queue si offline)
  const deleteRecipe = useCallback(async (id) => {
    // Optimistic removal
    setRecipes(prev => prev.filter(r => r.id !== id))
    await deleteRecipeLocal(id)

    if (isOffline) {
      await addToSyncQueue({
        type: 'delete',
        recipeId: id,
      })
      await refreshPendingIds()
    } else {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id)
      if (error) {
        await addToSyncQueue({
          type: 'delete',
          recipeId: id,
        })
        await refreshPendingIds()
      }
    }
  }, [isOffline, refreshPendingIds])

  return {
    recipes,
    getRecipe,
    saveRecipe,
    deleteRecipe,
    pendingSyncIds,
    isOffline,
    refreshFromServer,
  }
}
