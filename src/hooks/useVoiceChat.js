import { useState, useRef, useCallback, useEffect } from 'react'

const LOCALE_MAP = {
  fr: 'fr-FR',
  en: 'en-US',
  zh: 'zh-CN',
}

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

/**
 * Hook pour gérer la boucle de conversation vocale avec Miam.
 *
 * Phases :
 * - idle       : conversation vocale inactive
 * - listening  : micro actif, en attente de la parole de l'utilisateur
 * - processing : l'utilisateur a fini de parler, en attente de la réponse IA
 * - speaking   : le TTS lit la réponse de l'IA
 *
 * Boucle : idle → listening → processing → speaking → listening → ...
 */
export function useVoiceChat({ onUtterance, lang = 'fr' }) {
  const [phase, setPhase] = useState('idle')
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')
  const phaseRef = useRef('idle')
  const langRef = useRef(lang)
  const onUtteranceRef = useRef(onUtterance)
  const activeRef = useRef(false)
  const startListeningRef = useRef(null)

  const isSupported = !!SpeechRecognition

  // Synchroniser les refs
  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { onUtteranceRef.current = onUtterance }, [onUtterance])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      activeRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch { /* ignore */ }
        recognitionRef.current = null
      }
    }
  }, [])

  // Démarrer une session d'écoute (continuous=false, restart automatique)
  const startListeningSession = useCallback(() => {
    if (!SpeechRecognition || !activeRef.current) return

    // Nettoyer toute session existante
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.lang = LOCALE_MAP[langRef.current] || 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + ' '
          setTranscript(finalTranscriptRef.current.trimEnd())
        } else {
          // Afficher les finals accumulés + l'interim courant
          setTranscript(finalTranscriptRef.current + result[0].transcript)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        activeRef.current = false
        setPhase('idle')
        setTranscript('')
      } else if (event.error === 'aborted') {
        // Arrêt intentionnel — rien à faire
      } else if (event.error === 'no-speech') {
        // Silence — onend va redémarrer si on écoute toujours
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null

      if (!activeRef.current) return

      const text = finalTranscriptRef.current.trim()

      if (text && phaseRef.current === 'listening') {
        // L'utilisateur a dit quelque chose → envoyer à l'orchestrateur
        setPhase('processing')
        setTranscript('')
        finalTranscriptRef.current = ''
        onUtteranceRef.current?.(text)
      } else if (phaseRef.current === 'listening') {
        // Pas de parole détectée → redémarrer l'écoute (continuer à attendre)
        setTimeout(() => {
          if (activeRef.current && phaseRef.current === 'listening') {
            startListeningRef.current?.()
          }
        }, 300)
      }
      // Si phase = processing ou speaking, ne pas redémarrer — la boucle sera reprise en externe
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
    }
  }, [])

  // Garder la ref synchronisée pour les redémarrages auto-référencés
  useEffect(() => {
    startListeningRef.current = startListeningSession
  }, [startListeningSession])

  // Démarrer la conversation vocale — entre en phase listening
  const start = useCallback(() => {
    if (!isSupported) return false
    activeRef.current = true
    finalTranscriptRef.current = ''
    setTranscript('')
    setPhase('listening')
    startListeningSession()
    return true
  }, [isSupported, startListeningSession])

  // Entrer en phase speaking — coupe le micro pour éviter l'écho
  const enterSpeaking = useCallback(() => {
    if (!activeRef.current) return
    setPhase('speaking')
    setTranscript('')
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  // Reprendre l'écoute après la fin du TTS
  const resumeListening = useCallback(() => {
    if (!activeRef.current) return
    finalTranscriptRef.current = ''
    setTranscript('')
    setPhase('listening')
    // Petit délai pour laisser le système audio se stabiliser après le TTS
    setTimeout(() => {
      if (activeRef.current && phaseRef.current === 'listening') {
        startListeningRef.current?.()
      }
    }, 400)
  }, [])

  // Arrêter la conversation vocale entièrement
  const stop = useCallback(() => {
    activeRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    finalTranscriptRef.current = ''
    setTranscript('')
    setPhase('idle')
  }, [])

  return {
    phase,
    transcript,
    isActive: phase !== 'idle',
    isSupported,
    start,
    stop,
    enterSpeaking,
    resumeListening,
  }
}
