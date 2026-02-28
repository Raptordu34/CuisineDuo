import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useRef, useState, useEffect } from 'react'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, syncing, signOut } = useAuth()
  const { t } = useLanguage()
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (loading) {
      timerRef.current = setTimeout(() => setShowSlowWarning(true), 3000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [loading])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">{t('common.loading')}</p>
        {showSlowWarning && (
          <div className="mt-4 text-center space-y-2">
            <p className="text-xs text-gray-400">
              {t('offline.slowConnection')}
            </p>
            {!navigator.onLine && (
              <p className="text-xs text-amber-600 font-medium">
                {t('offline.noInternet')}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!user && !profile) return <Navigate to="/login" replace />

  if (user && !profile) {
    const handleForceSignOut = async () => {
      try {
        await Promise.race([
          signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ])
      } catch {
        console.warn('signOut timeout/error — forcage local')
      }
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.startsWith('sb-') || key === 'cuisineduo_cached_profile' || key === 'profileId')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
      } catch {
        // Ignorer
      }
      try {
        if ('caches' in window) {
          const names = await caches.keys()
          await Promise.all(names.map((name) => caches.delete(name)))
        }
      } catch {
        // Ignorer
      }
      window.location.href = '/login'
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
        <span className="text-4xl mb-4">⚠️</span>
        <p className="text-gray-700 font-medium text-center mb-2">
          {t('offline.profileLoadFailed')}
        </p>
        <p className="text-gray-400 text-xs text-center mb-4">
          {t('offline.checkConnection')}
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors cursor-pointer"
          >
            {t('offline.retry')}
          </button>
          <button
            onClick={handleForceSignOut}
            className="px-6 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer text-sm"
          >
            {t('login.signOutAndRetry')}
          </button>
        </div>
      </div>
    )
  }

  if (!profile?.household_id) return <Navigate to="/onboarding" replace />

  return (
    <>
      {syncing && (
        <div className="bg-blue-500 text-white text-center text-xs py-0.5 px-2 font-medium animate-pulse">
          {t('offline.syncing')}
        </div>
      )}
      {!navigator.onLine && (
        <div className="bg-amber-500 text-white text-center text-xs py-1 px-2 font-medium">
          {t('offline.banner')}
        </div>
      )}
      {children}
    </>
  )
}
