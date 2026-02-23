import { useState } from 'react'
import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'

function StatusDot({ ok, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'} inline-block`} />
      <span className="text-[11px] text-gray-500">{label}</span>
    </span>
  )
}

export default function ConnectionStatusBar() {
  const { isOnline, isSupabaseReachable, isApiReachable, showRestored } = useConnectionStatus()
  const { isOffline: isAuthOffline } = useAuth()
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const allOk = isOnline && isSupabaseReachable && isApiReachable && !isAuthOffline

  return (
    <>
      {/* Banniere offline / restored */}
      {showRestored && (
        <div className="bg-green-500 text-white text-center text-xs py-1.5 px-4 font-medium">
          {t('connection.restored')}
        </div>
      )}
      {!isOnline && !showRestored && (
        <div className="bg-red-500 text-white text-center text-xs py-1.5 px-4 font-medium">
          {t('connection.offline')} — {t('connection.offlineWarning')}
        </div>
      )}
      {isOnline && !showRestored && isAuthOffline && (
        <div className="bg-amber-500 text-white text-center text-xs py-1.5 px-4 font-medium">
          {t('connection.syncing')}
        </div>
      )}

      {/* Indicateur persistant : pastille cliquable */}
      <div className="flex justify-end px-4 py-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 cursor-pointer"
          title={allOk ? t('connection.allOk') : t('connection.issues')}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${allOk ? 'bg-green-400' : 'bg-amber-400'} inline-block`} />
          <span className="text-[11px] text-gray-400">
            {allOk ? t('connection.allOk') : t('connection.issues')}
          </span>
        </button>
      </div>

      {/* Details expandables */}
      {expanded && (
        <div className="flex justify-end px-4 pb-1.5 gap-3">
          <StatusDot ok={isOnline} label={t('connection.network')} />
          <StatusDot ok={isSupabaseReachable} label={t('connection.database')} />
          <StatusDot ok={isApiReachable} label={t('connection.ai')} />
        </div>
      )}
    </>
  )
}
