import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY
    setSupported(isSupported)
    if (isSupported) {
      setPermission(Notification.permission)
    }
  }, [])

  // Check if already subscribed
  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub)
      })
    })
  }, [supported])

  const subscribe = useCallback(async () => {
    if (!supported || !profile) return false

    try {
      const reg = await navigator.serviceWorker.ready
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return false

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      await fetch('/api/push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          profile_id: profile.id,
          household_id: profile.household_id,
          subscription: sub.toJSON(),
        }),
      })

      setSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      return false
    }
  }, [supported, profile])

  const unsubscribe = useCallback(async () => {
    if (!supported || !profile) return

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      await fetch('/api/push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unsubscribe',
          profile_id: profile.id,
          subscription: sub.toJSON(),
        }),
      })

      await sub.unsubscribe()
      setSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
  }, [supported, profile])

  return { supported, permission, subscribed, subscribe, unsubscribe }
}
