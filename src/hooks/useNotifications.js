import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiPost, apiDelete } from '../lib/apiClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i)
  return array
}

export function useNotifications() {
  const { profile } = useAuth()
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
  const [permission, setPermission] = useState(() => supported ? Notification.permission : 'default')
  const [subscribed, setSubscribed] = useState(false)
  const [needsResubscribe, setNeedsResubscribe] = useState(false)
  const [error, setError] = useState(null)

  const verifySubscriptionInDb = useCallback(async (subscription) => {
    const response = await apiPost('/api/subscribe-push', {
      action: 'verify',
      subscription,
    })

    if (!response.ok) {
      let message = 'Subscription verification failed'
      try {
        const data = await response.json()
        message = data?.error || message
      } catch {
        // ignore parse errors
      }
      throw new Error(message)
    }

    const data = await response.json()
    return !!data?.subscribed
  }, [])

  // Check if already subscribed locally and linked in DB
  useEffect(() => {
    if (!supported || !profile) return

    let cancelled = false

    const checkSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()

        if (!sub) {
          if (cancelled) return
          setSubscribed(false)
          setNeedsResubscribe(false)
          return
        }

        const existsInDb = await verifySubscriptionInDb(sub.toJSON())
        if (cancelled) return

        setSubscribed(existsInDb)
        setNeedsResubscribe(!existsInDb)
        if (!existsInDb) {
          setError('Subscription missing on server. Please enable notifications again.')
        }
      } catch (err) {
        if (cancelled) return
        console.error('Push subscription check error:', err)
        setSubscribed(false)
        setNeedsResubscribe(false)
        setError(err.message || 'Subscription verification failed')
      }
    }

    checkSubscription()

    return () => {
      cancelled = true
    }
  }, [supported, profile, verifySubscriptionInDb])

  const subscribe = useCallback(async () => {
    if (!supported || !profile) return false
    setError(null)

    try {
      const reg = await navigator.serviceWorker.ready
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return false

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const response = await apiPost('/api/subscribe-push', {
        subscription: sub.toJSON(),
      })

      if (!response.ok) {
        let message = 'Subscription failed'
        try {
          const data = await response.json()
          message = data?.error || message
        } catch {
          // ignore parse errors
        }
        throw new Error(message)
      }

      setSubscribed(true)
      setNeedsResubscribe(false)
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      setError(err.message || 'Subscription failed')
      return false
    }
  }, [supported, profile])

  const unsubscribe = useCallback(async () => {
    if (!supported || !profile) return

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      const response = await apiDelete('/api/subscribe-push', {
        subscription: sub.toJSON(),
      })

      if (!response.ok) {
        let message = 'Unsubscription failed'
        try {
          const data = await response.json()
          message = data?.error || message
        } catch {
          // ignore parse errors
        }
        throw new Error(message)
      }

      await sub.unsubscribe()
      setSubscribed(false)
      setNeedsResubscribe(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
      setError(err.message || 'Unsubscription failed')
    }
  }, [supported, profile])

  return { supported, permission, subscribed, needsResubscribe, subscribe, unsubscribe, error }
}
