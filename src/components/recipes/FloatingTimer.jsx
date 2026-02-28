import { useLanguage } from '../../contexts/LanguageContext'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function FloatingTimer({ stepIndex, remainingSeconds, paused, onPause, onResume, onCancel }) {
  const { t } = useLanguage()
  const finished = remainingSeconds <= 0

  return (
    <div className="fixed bottom-20 right-4 z-50 bg-white rounded-2xl shadow-lg border border-gray-200 p-3 flex items-center gap-3 min-w-[200px]">
      <div className="flex-1">
        <p className="text-xs text-gray-500">
          {t('recipes.timerStep', { step: stepIndex + 1 })}
        </p>
        <p className={`text-xl font-bold tabular-nums ${finished ? 'text-red-500 animate-pulse' : 'text-gray-900'}`}>
          {formatTime(remainingSeconds)}
        </p>
      </div>
      <div className="flex gap-1.5">
        {!finished && (
          <button
            onClick={paused ? onResume : onPause}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer transition-colors"
          >
            {paused ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            )}
          </button>
        )}
        <button
          onClick={onCancel}
          className="p-2 rounded-full bg-red-100 hover:bg-red-200 text-red-600 cursor-pointer transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
