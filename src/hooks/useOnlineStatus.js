import { useState, useEffect, useCallback, useRef } from 'react'

// Etats possibles : 'online' | 'slow' | 'offline'
export default function useOnlineStatus() {
  const [status, setStatus] = useState(navigator.onLine ? 'online' : 'offline')
  const checkRef = useRef(null)

  const checkConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }

    // Utiliser Network Information API si disponible
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      const slow = conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' ||
        (conn.downlink != null && conn.downlink < 0.5) ||
        (conn.rtt != null && conn.rtt > 2000)
      setStatus(slow ? 'slow' : 'online')
      return
    }

    // Fallback : mesurer un ping vers Supabase (HEAD sur l'URL connue)
    try {
      const t0 = performance.now()
      await fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
      const rtt = performance.now() - t0
      setStatus(rtt > 3000 ? 'slow' : 'online')
    } catch {
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setStatus('online')
      // Verifier la qualite apres un court delai
      setTimeout(checkConnectionQuality, 500)
    }
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ecouter les changements de qualite reseau (Network Information API)
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      conn.addEventListener('change', checkConnectionQuality)
    }

    // Verifier periodiquement la qualite (toutes les 30s, uniquement si en ligne)
    checkRef.current = setInterval(() => {
      if (navigator.onLine) checkConnectionQuality()
    }, 30000)

    // Check initial (differe pour eviter setState synchrone dans l'effet)
    const initialCheck = setTimeout(checkConnectionQuality, 0)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearTimeout(initialCheck)
      if (conn) conn.removeEventListener('change', checkConnectionQuality)
      if (checkRef.current) clearInterval(checkRef.current)
    }
  }, [checkConnectionQuality])

  return status
}
