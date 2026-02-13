import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export default function DictationTrace({ trace }) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(false)
  const [prevTrace, setPrevTrace] = useState(trace)

  // Expand when trace changes (React-recommended pattern for derived state)
  if (trace !== prevTrace) {
    setPrevTrace(trace)
    if (trace) setExpanded(true)
  }

  useEffect(() => {
    if (!trace) return

    // Auto-collapse after 10 seconds
    const timer = setTimeout(() => {
      setExpanded(false)
    }, 10000)

    return () => clearTimeout(timer)
  }, [trace])

  if (!trace) return null

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-xs text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <span className="font-medium">{t('dictation.lastDictation')}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1 text-xs">
          <p>
            <span className="font-medium text-gray-600">{t('dictation.heard')}:</span>{' '}
            <span className="text-gray-500">{trace.rawTranscript}</span>
          </p>
          <p>
            <span className="font-medium text-gray-600">{t('dictation.understood')}:</span>{' '}
            <span className="text-gray-800">{trace.correctedResult}</span>
          </p>
        </div>
      )}
    </div>
  )
}
