import { useState, useEffect, useRef, useCallback } from 'react'

const LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  zh: 'zh-CN',
}

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

// Mobile Android : continuous=true produit des doublons (bug connu Chrome)
// On utilise continuous=false + restart dans onend
const isMobileAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

export function useDictation() {
  const [isListening, setIsListening] = useState(false)
  // Transcription complete accumulee (pour envoi)
  const [transcript, setTranscript] = useState('')
  // Phrase en cours de dictee (pour affichage popover)
  const [currentPhrase, setCurrentPhrase] = useState('')
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  // Texte confirme accumule (persiste entre sessions si onend + restart)
  const accumulatedRef = useRef('')
  // Index du dernier resultat final traite dans la session courante
  // Desktop : empeche de compter deux fois le meme isFinal
  const lastFinalIdxRef = useRef(-1)
  // Dernier texte interim de la session (sauvegarde si onend sans final)
  const sessionInterimRef = useRef('')
  // Flag : la session courante a-t-elle produit au moins un resultat final ?
  const sessionHadFinalRef = useRef(false)

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

  const startListening = useCallback((lang) => {
    if (!SpeechRecognition) {
      setError('unsupported')
      return
    }

    wantListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    setError(null)
    setTranscript('')
    setCurrentPhrase('')
    accumulatedRef.current = ''
    lastFinalIdxRef.current = -1
    sessionInterimRef.current = ''
    sessionHadFinalRef.current = false
    wantListeningRef.current = true

    const recognition = new SpeechRecognition()
    recognition.lang = LOCALE_MAP[lang] || lang || 'fr-FR'
    // Desktop : continuous=true (pas de coupure entre phrases, deduplication par lastFinalIdx)
    // Mobile Android : continuous=false (evite les doublons, restart dans onend)
    recognition.continuous = !isMobileAndroid
    recognition.interimResults = true

    recognition.onresult = (event) => {
      if (isMobileAndroid) {
        // Mobile : continuous=false, chaque session produit des results independants
        // On accumule les finals et on garde le dernier interim
        let sessionFinal = ''
        let interim = ''
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            sessionFinal += event.results[i][0].transcript + ' '
            sessionHadFinalRef.current = true
          } else {
            interim = event.results[i][0].transcript
          }
        }
        if (sessionFinal) {
          accumulatedRef.current += sessionFinal
        }
        sessionInterimRef.current = interim

        setTranscript((accumulatedRef.current + interim).trimEnd())
        setCurrentPhrase(interim)
      } else {
        // Desktop : continuous=true, deduplication par index
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal && i > lastFinalIdxRef.current) {
            accumulatedRef.current += event.results[i][0].transcript + ' '
            lastFinalIdxRef.current = i
          }
        }

        // Interim = dernier resultat non-final
        let interim = ''
        const last = event.results[event.results.length - 1]
        if (last && !last.isFinal) {
          interim = last[0].transcript
        }
        sessionInterimRef.current = interim

        setTranscript((accumulatedRef.current + interim).trimEnd())
        setCurrentPhrase(interim)
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('not-allowed')
        wantListeningRef.current = false
        setIsListening(false)
      } else if (event.error === 'aborted') {
        // Abort intentionnel
      } else if (event.error === 'no-speech') {
        // Timeout silence — onend relancera
      } else {
        setError(event.error)
        wantListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Sauvegarder l'interim non finalise pour ne pas le perdre
      if (isMobileAndroid) {
        // Mobile : sauvegarder l'interim seulement si la session n'a pas produit de final
        // (si elle a produit un final, l'interim a deja ete traite dans onresult)
        if (!sessionHadFinalRef.current && sessionInterimRef.current) {
          accumulatedRef.current += sessionInterimRef.current + ' '
          setTranscript(accumulatedRef.current.trimEnd())
        }
      } else {
        // Desktop : sauvegarder l'interim restant
        if (sessionInterimRef.current) {
          accumulatedRef.current += sessionInterimRef.current + ' '
          setTranscript(accumulatedRef.current.trimEnd())
        }
      }
      sessionInterimRef.current = ''
      sessionHadFinalRef.current = false
      // Reset l'index pour la nouvelle session (event.results repart de zero)
      lastFinalIdxRef.current = -1
      setCurrentPhrase('')

      if (wantListeningRef.current) {
        try {
          recognition.start()
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
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setError('start-failed')
      wantListeningRef.current = false
    }
  }, [])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  return { isListening, transcript, currentPhrase, startListening, stopListening, isSupported, error }
}
