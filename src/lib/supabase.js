import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug Realtime : ?debug=1 ou localStorage.setItem('chatDebug','1')
const debugRealtime = typeof window !== 'undefined' && (
  new URLSearchParams(window.location.search).get('debug') === '1' ||
  localStorage.getItem('chatDebug') === '1'
)
const logRealtime = (...args) => debugRealtime && console.log('[Realtime]', ...args)

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // worker: false - le Web Worker provoque CHANNEL_ERROR sur certains Android (ex. Samsung)
    // Le heartbeat reste actif sur le main thread, moins résistant en arrière-plan mais stable
    worker: false,
    // Reconnexion explicite quand heartbeat détecte une déconnexion silencieuse
    heartbeatCallback: (status) => {
      logRealtime('heartbeatCallback', status)
      if (status === 'disconnected' || status === 'timeout') {
        logRealtime('reconnect()')
        supabase.realtime.connect()
      }
    },
  },
})

export { supabase }
