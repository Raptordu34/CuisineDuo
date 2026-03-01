import { supabase } from './supabase'
import {
  getPendingSyncEntries,
  updateSyncEntry,
  removeSyncEntry,
} from './offlineRecipeStore'

const MAX_RETRIES = 3

/**
 * Deduplique les entrees de sync : pour un meme recipeId,
 * garde uniquement l'entree la plus recente par type.
 */
function deduplicateEntries(entries) {
  const latest = new Map()
  for (const entry of entries) {
    const key = `${entry.recipeId}:${entry.type}`
    const existing = latest.get(key)
    if (!existing || entry.createdAt > existing.createdAt) {
      latest.set(key, entry)
    }
  }
  // Retourner les entrees a supprimer et celles a traiter
  const toProcess = [...latest.values()]
  const toRemove = entries.filter(e => !toProcess.includes(e))
  return { toProcess, toRemove }
}

/**
 * Traite la file de sync. Retourne { synced: number, failed: number }.
 */
export async function processSyncQueue() {
  const pending = await getPendingSyncEntries()
  if (!pending.length) return { synced: 0, failed: 0 }

  const { toProcess, toRemove } = deduplicateEntries(pending)

  // Supprimer les entrees dupliquees
  for (const entry of toRemove) {
    await removeSyncEntry(entry.id)
  }

  let synced = 0
  let failed = 0

  for (const entry of toProcess) {
    await updateSyncEntry(entry.id, { status: 'syncing' })

    try {
      if (entry.type === 'update') {
        const { error } = await supabase
          .from('recipes')
          .update({ ...entry.payload, updated_at: new Date().toISOString() })
          .eq('id', entry.recipeId)
        if (error) throw error
      } else if (entry.type === 'delete') {
        const { error } = await supabase
          .from('recipes')
          .delete()
          .eq('id', entry.recipeId)
        if (error) throw error
      }

      await removeSyncEntry(entry.id)
      synced++
    } catch (err) {
      console.error('[syncManager] Sync failed for entry', entry.id, err)
      const nextRetry = (entry.retryCount || 0) + 1
      if (nextRetry >= MAX_RETRIES) {
        // Abandonner apres MAX_RETRIES
        await removeSyncEntry(entry.id)
        failed++
      } else {
        await updateSyncEntry(entry.id, { status: 'pending', retryCount: nextRetry })
        failed++
      }
    }
  }

  return { synced, failed }
}
