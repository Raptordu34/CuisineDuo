import { useState, useEffect, useRef, useCallback } from 'react'

const LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  zh: 'zh-CN',
}

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

export function useDictation() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const wantListeningRef = useRef(false)
  const langRef = useRef('fr')

  const isSupported = !!SpeechRecognition

  useEffect(() => {
    return () => {
      wantListeningRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  const startSession = useCallback(() => {
    const recognition = new SpeechRecognition()
    recognition.lang = LOCALE_MAP[langRef.current] || langRef.current || 'fr-FR'
    // continuous=false avoids the duplicate-word bug on mobile browsers.
    // We restart manually on each onend to simulate continuous listening.
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      // With continuous=false, event.results contains only results
      // from this session (typically just 1 result at index 0).
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' '
          setTranscript(finalTranscriptRef.current.trimEnd())
        } else {
          // Show accumulated finals + current interim
          setTranscript(finalTranscriptRef.current + result[0].transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('not-allowed')
        wantListeningRef.current = false
        setIsListening(false)
      } else if (event.error === 'aborted') {
        // Intentional abort from stopListening, do nothing
      } else if (event.error === 'no-speech') {
        // Silence timeout — will restart via onend if still wanted
      } else {
        setError(event.error)
        wantListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      if (wantListeningRef.current) {
        // Restart for the next utterance
        try {
          startSession()
        } catch {
          wantListeningRef.current = false
          recognitionRef.current = null
          setIsListening(false)
        }
      } else {
        recognitionRef.current = null
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const startListening = useCallback((lang) => {
    if (!SpeechRecognition) {
      setError('unsupported')
      return
    }

    // Stop any existing session
    wantListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    setError(null)
    setTranscript('')
    finalTranscriptRef.current = ''
    langRef.current = lang || 'fr'
    wantListeningRef.current = true

    try {
      startSession()
      setIsListening(true)
    } catch {
      setError('start-failed')
      wantListeningRef.current = false
    }
  }, [startSession])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      // onend will fire and see wantListeningRef=false → setIsListening(false)
    }
  }, [])

  return { isListening, transcript, startListening, stopListening, isSupported, error }
}
