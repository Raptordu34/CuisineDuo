import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ReloadPrompt() {
  const { t } = useLanguage()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Verifier les mises a jour toutes les 60 secondes
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-center gap-3">
        <p className="text-sm text-gray-700 flex-1">
          {t('offline.updateAvailable')}
        </p>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          {t('offline.dismiss')}
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors cursor-pointer"
        >
          {t('offline.updateNow')}
        </button>
      </div>
    </div>
  )
}
