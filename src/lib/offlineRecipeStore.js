import { openDB } from 'idb'

const DB_NAME = 'cuisineduo'
const DB_VERSION = 1
const RECIPES_STORE = 'recipes'
const SYNC_QUEUE_STORE = 'syncQueue'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(RECIPES_STORE)) {
        const recipeStore = db.createObjectStore(RECIPES_STORE, { keyPath: 'id' })
        recipeStore.createIndex('household_id', 'household_id')
      }
      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncStore = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' })
        syncStore.createIndex('createdAt', 'createdAt')
      }
    },
  })
}

// --- Recipes ---

export async function getAllRecipes(householdId) {
  const db = await getDB()
  const all = await db.getAllFromIndex(RECIPES_STORE, 'household_id', householdId)
  return all
}

export async function getRecipe(id) {
  const db = await getDB()
  return db.get(RECIPES_STORE, id) ?? null
}

export async function putRecipe(recipe) {
  const db = await getDB()
  await db.put(RECIPES_STORE, { ...recipe, _cachedAt: Date.now() })
}

export async function putRecipes(recipes) {
  const db = await getDB()
  const tx = db.transaction(RECIPES_STORE, 'readwrite')
  for (const recipe of recipes) {
    await tx.store.put({ ...recipe, _cachedAt: Date.now() })
  }
  await tx.done
}

export async function deleteRecipeLocal(id) {
  const db = await getDB()
  await db.delete(RECIPES_STORE, id)
}

// --- Sync Queue ---

export async function addToSyncQueue(entry) {
  const db = await getDB()
  await db.put(SYNC_QUEUE_STORE, {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    status: 'pending',
    createdAt: Date.now(),
    retryCount: 0,
  })
}

export async function getPendingSyncEntries() {
  const db = await getDB()
  const all = await db.getAllFromIndex(SYNC_QUEUE_STORE, 'createdAt')
  return all.filter(e => e.status === 'pending')
}

export async function updateSyncEntry(id, updates) {
  const db = await getDB()
  const entry = await db.get(SYNC_QUEUE_STORE, id)
  if (entry) {
    await db.put(SYNC_QUEUE_STORE, { ...entry, ...updates })
  }
}

export async function removeSyncEntry(id) {
  const db = await getDB()
  await db.delete(SYNC_QUEUE_STORE, id)
}

export async function getPendingCountByRecipeId() {
  const entries = await getPendingSyncEntries()
  const map = new Map()
  for (const e of entries) {
    map.set(e.recipeId, (map.get(e.recipeId) || 0) + 1)
  }
  return map
}

// --- Cleanup ---

export async function clearAll() {
  const db = await getDB()
  const tx = db.transaction([RECIPES_STORE, SYNC_QUEUE_STORE], 'readwrite')
  await tx.objectStore(RECIPES_STORE).clear()
  await tx.objectStore(SYNC_QUEUE_STORE).clear()
  await tx.done
}
