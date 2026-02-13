import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // Web Worker : heartbeat dans un thread séparé, moins affecté par le throttling
    // des navigateurs mobiles quand l'app est en arrière-plan (PWA/tab inactive)
    worker: true,
    // Reconnexion explicite quand heartbeat détecte une déconnexion silencieuse
    heartbeatCallback: (status) => {
      if (status === 'disconnected' || status === 'timeout') {
        supabase.realtime.connect()
      }
    },
  },
})

export { supabase }
