import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lock simple en memoire — remplace navigator.locks qui cause des deadlocks
// quand un ancien SW ou onglet zombie tient le lock indefiniment
let lockPromise = Promise.resolve()
async function inProcessLock(_name, _acquireTimeout, fn) {
  const prev = lockPromise
  let resolve
  lockPromise = new Promise((r) => { resolve = r })
  await prev
  try {
    return await fn()
  } finally {
    resolve()
  }
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
