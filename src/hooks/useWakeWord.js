import { useEffect, useRef, useCallback } from 'react'

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

const WAKE_PATTERNS = [
  /hey\s*miam/i,
  /eh\s*miam/i,
  /dis\s*miam/i,
  /ok\s*miam/i,
  /hey\s*mia[mn]?$/i,
]

const LOCALE_MAP = { fr: 'fr-FR', en: 'en-US', zh: 'zh-CN' }

export function useWakeWord({ enabled, onWake, lang = 'fr' }) {
  const recognitionRef = useRef(null)
  const restartTimerRef = useRef(null)
  const enabledRef = useRef(enabled)
  const onWakeRef = useRef(onWake)
  const startListeningRef = useRef(null)

  useEffect(() => { enabledRef.current = enabled })
  useEffect(() => { onWakeRef.current = onWake })

  const startListening = useCallback(() => {
    if (!SpeechRecognition || !enabledRef.current) return

    // Clean up existing
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore abort errors */ }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.lang = LOCALE_MAP[lang] || 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        const detected = WAKE_PATTERNS.some(p => p.test(text))
        if (detected) {
          recognition.abort()
          recognitionRef.current = null
          onWakeRef.current?.()
          // Restart after a delay if still enabled
          restartTimerRef.current = setTimeout(() => {
            if (enabledRef.current) startListeningRef.current?.()
          }, 3000)
          return
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        recognitionRef.current = null
        return
      }
      recognitionRef.current = null
    }

    recognition.onend = () => {
      recognitionRef.current = null
      if (enabledRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (enabledRef.current) startListeningRef.current?.()
        }, 500)
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch { recognitionRef.current = null }
  }, [lang])

  // Keep ref in sync
  useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  // Start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      startListening()
    } else {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }
    }

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }
    }
  }, [enabled, startListening])

  return { isSupported: !!SpeechRecognition }
}
