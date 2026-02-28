import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lock simple en memoire — remplace navigator.locks qui cause des deadlocks
// quand un ancien SW ou onglet zombie tient le lock indefiniment.
// Utilise acquireTimeout pour eviter les blocages apres retour d'arriere-plan
// sur mobile (le lock precedent peut pendre si son refresh token a ete coupe).
let lockPromise = Promise.resolve()
async function inProcessLock(_name, acquireTimeout, fn) {
  const prev = lockPromise
  let resolve
  lockPromise = new Promise((r) => { resolve = r })
  // Attendre le lock precedent, mais avec un timeout pour eviter les deadlocks
  // (si le holder precedent pend a cause d'un reseau coupe en arriere-plan)
  const timeout = Math.max(acquireTimeout || 5000, 1000)
  await Promise.race([
    prev,
    new Promise((r) => setTimeout(r, timeout)),
  ])
  try {
    return await fn()
  } finally {
    resolve()
  }
}

// Reinitialiser le lock au retour d'arriere-plan pour debloquer les requetes
// pendantes qui ont ete interrompues par la mise en veille
export function resetAuthLock() {
  lockPromise = Promise.resolve()
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    lock: inProcessLock,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs: (tries) => Math.min(1000 * 2 ** tries, 30000),
  },
})
