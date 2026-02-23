import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const PING_INTERVAL_MS = 30000 // 30 secondes
const PING_TIMEOUT_MS = 5000

export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isSupabaseReachable, setIsSupabaseReachable] = useState(navigator.onLine)
  const [isApiReachable, setIsApiReachable] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)
  const [showRestored, setShowRestored] = useState(false)
  const intervalRef = useRef(null)
  const restoredTimerRef = useRef(null)

  const pingSupabase = useCallback(async () => {
    if (!navigator.onLine) {
      setIsSupabaseReachable(false)
      return false
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
      const { error } = await supabase
        .from('households')
        .select('id', { count: 'exact', head: true })
        .limit(0)
        .abortSignal(controller.signal)
      clearTimeout(timeout)
      const reachable = !error
      setIsSupabaseReachable(reachable)
      return reachable
    } catch {
      setIsSupabaseReachable(false)
      return false
    }
  }, [])

  const pingApi = useCallback(async () => {
    if (!navigator.onLine) {
      setIsApiReachable(false)
      return false
    }
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
      // OPTIONS est le plus leger — juste un preflight CORS
      const res = await fetch('/api/miam-orchestrator', {
        method: 'OPTIONS',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const reachable = res.ok
      setIsApiReachable(reachable)
      return reachable
    } catch {
      setIsApiReachable(false)
      return false
    }
  }, [])

  const pingAll = useCallback(async () => {
    await Promise.all([pingSupabase(), pingApi()])
  }, [pingSupabase, pingApi])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      pingAll().then(() => {
        if (wasOffline) {
          setShowRestored(true)
          restoredTimerRef.current = setTimeout(() => setShowRestored(false), 3000)
        }
        setWasOffline(false)
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      setIsSupabaseReachable(false)
      setIsApiReachable(false)
      setWasOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ping initial differe
    const initialPing = setTimeout(pingAll, 0)

    // Ping periodique
    intervalRef.current = setInterval(pingAll, PING_INTERVAL_MS)

    return () => {
      clearTimeout(initialPing)
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pingAll, wasOffline])

  return { isOnline, isSupabaseReachable, isApiReachable, showRestored }
}
