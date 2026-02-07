import { useState, useEffect, useRef, useCallback } from 'react'
import { useDictation } from '../hooks/useDictation'
import { useLanguage } from '../contexts/LanguageContext'

const LANGS = ['fr', 'en', 'zh']
const LANG_LABELS = { fr: 'FR', en: 'EN', zh: 'ZH' }

export default function DictationButton({ onResult, disabled, className = '', color = 'orange', popoverDirection = 'down' }) {
  const { t, lang: appLang } = useLanguage()
  const { isListening, transcript, startListening, stopListening, isSupported, error } = useDictation()
  const [dictLang, setDictLang] = useState(appLang)
  const lastTranscriptRef = useRef('')
  const pointerDownTimeRef = useRef(0)
  const isHoldModeRef = useRef(false)
  const holdTimerRef = useRef(null)
  const dictLangRef = useRef(dictLang)

  // Keep ref in sync for use in the onResult effect
  dictLangRef.current = dictLang

  useEffect(() => {
    if (!isListening && lastTranscriptRef.current) {
      onResult(lastTranscriptRef.current, dictLangRef.current)
      lastTranscriptRef.current = ''
    }
  }, [isListening, onResult])

  useEffect(() => {
    if (transcript) {
      lastTranscriptRef.current = transcript
    }
  }, [transcript])

  const cycleLang = useCallback(() => {
    if (isListening) return
    setDictLang((prev) => {
      const idx = LANGS.indexOf(prev)
      return LANGS[(idx + 1) % LANGS.length]
    })
  }, [isListening])

  const doStartListening = useCallback(() => {
    startListening(dictLangRef.current)
  }, [startListening])

  const onPointerDown = useCallback((e) => {
    if (disabled) return
    e.preventDefault()
    pointerDownTimeRef.current = Date.now()
    isHoldModeRef.current = false

    holdTimerRef.current = setTimeout(() => {
      if (!isListening) {
        isHoldModeRef.current = true
        doStartListening()
      }
    }, 300)
  }, [disabled, isListening, doStartListening])

  const onPointerUp = useCallback((e) => {
    if (disabled) return
    e.preventDefault()

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    const elapsed = Date.now() - pointerDownTimeRef.current

    if (elapsed < 300) {
      if (isListening) {
        stopListening()
      } else {
        isHoldModeRef.current = false
        doStartListening()
      }
    } else {
      if (isHoldModeRef.current && isListening) {
        stopListening()
      }
    }
  }, [disabled, isListening, doStartListening, stopListening])

  const onPointerLeave = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (isHoldModeRef.current && isListening) {
      stopListening()
    }
  }, [isListening, stopListening])

  if (!isSupported) return null

  const colorClasses = color === 'indigo'
    ? 'bg-indigo-500 hover:bg-indigo-600'
    : 'bg-orange-500 hover:bg-orange-600'

  const idleClasses = color === 'indigo'
    ? 'bg-gray-100 text-indigo-400 hover:bg-indigo-50'
    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'

  return (
    <div className="relative flex items-center gap-0.5">
      {/* Language toggle badge */}
      <button
        type="button"
        onClick={cycleLang}
        disabled={disabled || isListening}
        title={t('dictation.changeLang')}
        className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 hover:bg-gray-200 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {LANG_LABELS[dictLang]}
      </button>

      {/* Mic button */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        title={isListening ? t('dictation.stop') : t('dictation.start')}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed touch-none select-none ${
          isListening
            ? `${colorClasses} text-white shadow-md ${isHoldModeRef.current ? 'scale-125 ring-4 ring-orange-300/50 animate-pulse' : 'animate-pulse'}`
            : idleClasses
        } ${className}`}
      >
        {isListening ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zm-4 7.93A7.001 7.001 0 0112 19a7.001 7.001 0 01-1 0v3h2v-3.07z" />
          </svg>
        )}
      </button>

      {isListening && transcript && (
        <div className={`absolute left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-[200px] whitespace-pre-wrap shadow-lg z-50 ${
          popoverDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 ${
            popoverDirection === 'up' ? 'top-full -mt-1' : 'bottom-full mt-1'
          }`} />
          {transcript}
        </div>
      )}

      {error && (
        <div className={`absolute left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs rounded-lg px-3 py-2 max-w-[200px] shadow-lg z-50 ${
          popoverDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 rotate-45 ${
            popoverDirection === 'up' ? 'top-full -mt-1' : 'bottom-full mt-1'
          }`} />
          {t('dictation.error')}
        </div>
      )}
    </div>
  )
}
