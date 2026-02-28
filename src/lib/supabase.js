import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Lock mémoire simple et tolérant aux pannes
let lockPromise = Promise.resolve()
async function inProcessLock(_name, acquireTimeout, fn) {
  const currentLock = lockPromise
  let releaseLock
  lockPromise = new Promise((r) => { releaseLock = r })
  
  const timeout = Math.max(acquireTimeout || 5000, 1000)
  
  // Attendre le lock précédent (max 5s pour ne jamais bloquer indéfiniment)
  await Promise.race([
    currentLock,
    new Promise((r) => setTimeout(r, timeout)),
  ])
  
  try {
    return await fn()
  } finally {
    // Toujours libérer le lock, même si fn() crashe
    releaseLock()
  }
}

export function resetAuthLock() {
  console.log('[Supabase Lock] Reset manuel du lock Auth')
  lockPromise = Promise.resolve()
}

// Wrapper Fetch anti-zombies (CRITIQUE POUR PWA SUR MOBILE)
const customFetch = async (url, options) => {
  const FETCH_TIMEOUT_MS = 8000;
  const controller = new AbortController();
  
  const endpoint = new URL(url).pathname;
  
  // 1. La promesse de la requête native (qui peut devenir un zombie)
  const fetchPromise = fetch(url, { ...options, signal: controller.signal });
  
  // 2. La promesse de timeout purement Javascript
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      controller.abort(); // Tente d'annuler au niveau natif
      reject(new Error(`[Timeout JS] Requete annulee apres ${FETCH_TIMEOUT_MS}ms`)); // Force le rejet côté JS
    }, FETCH_TIMEOUT_MS);
  });

  try {
    // Ne pas loguer les requêtes de télémétrie si vous en avez, pour la clarté
    console.log(`[HTTP ->] ${options?.method || 'GET'} ${endpoint}`);
    const t0 = Date.now();
    
    // RACE : Si fetchPromise bloque (zombie), timeoutPromise gagnera au retour d'arrière-plan
    // Cela débloque immédiatement l'état interne de Supabase.
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    console.log(`[HTTP <-] ${response.status} ${endpoint} (${Date.now() - t0}ms)`);
    return response;
  } catch (err) {
    console.warn(`[HTTP X] Échec sur ${endpoint}:`, err.message);
    throw err;
  }
};

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
  global: {
    // Écrase le fetch par défaut pour empêcher les deadlocks réseau
    fetch: customFetch,
  }
})
