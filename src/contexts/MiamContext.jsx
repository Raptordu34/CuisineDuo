import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import { supabase } from '../lib/supabase'
import { useWakeWord } from '../hooks/useWakeWord'

const MiamContext = createContext(null)

const PAGE_MAP = {
  '/': 'home',
  '/inventory': 'inventory',
  '/chat': 'chat',
}

export function MiamProvider({ children }) {
  const { profile } = useAuth()
  const { lang, t } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  // Sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  // Conversation (in-memory, resets on refresh)
  const [messages, setMessages] = useState([])

  // Loading
  const [isLoading, setIsLoading] = useState(false)

  // TTS
  const [ttsEnabled, setTtsEnabled] = useState(
    () => localStorage.getItem('miamTTS') === 'true'
  )

  // Wake word
  const [wakeWordEnabled, setWakeWordEnabled] = useState(
    () => localStorage.getItem('miamWakeWord') === 'true'
  )

  // Voice active (to prevent conflicts between wake word and dictation)
  const [isVoiceActive, setIsVoiceActive] = useState(false)

  // Action registry
  const actionsRef = useRef({})

  const registerActions = useCallback((pageActions) => {
    actionsRef.current = { ...actionsRef.current, ...pageActions }
    return () => {
      for (const key of Object.keys(pageActions)) {
        delete actionsRef.current[key]
      }
    }
  }, [])

  const getCurrentPage = useCallback(() => {
    return PAGE_MAP[location.pathname] || 'unknown'
  }, [location.pathname])

  const getAvailableActions = useCallback(() => {
    return Object.keys(actionsRef.current)
  }, [])

  // TTS
  const speak = useCallback((text) => {
    if (!ttsEnabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const langMap = { fr: 'fr-FR', en: 'en-US', zh: 'zh-CN' }
    utterance.lang = langMap[lang] || 'fr-FR'
    utterance.rate = 1.0
    utterance.pitch = 1.1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang.startsWith(utterance.lang) && v.localService)
    if (preferred) utterance.voice = preferred
    window.speechSynthesis.speak(utterance)
  }, [ttsEnabled, lang])

  const toggleTTS = useCallback(() => {
    setTtsEnabled(prev => {
      const next = !prev
      localStorage.setItem('miamTTS', String(next))
      return next
    })
  }, [])

  const toggleWakeWord = useCallback(() => {
    setWakeWordEnabled(prev => {
      const next = !prev
      localStorage.setItem('miamWakeWord', String(next))
      return next
    })
  }, [])

  // Execute action
  const executeAction = useCallback(async (action) => {
    const { name, args } = action

    // Built-in: navigate
    if (name === 'navigate') {
      navigate(args.path)
      return { success: true }
    }

    // Built-in: sendChatMessage (fallback when not on ChatPage)
    if (name === 'sendChatMessage' && !actionsRef.current['sendChatMessage']) {
      if (!profile?.household_id || !profile?.id) return { success: false, error: 'No profile' }
      const { error } = await supabase.from('messages').insert({
        household_id: profile.household_id,
        profile_id: profile.id,
        content: args.text,
      })
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Page-registered actions
    const handler = actionsRef.current[name]
    if (handler) {
      try {
        await handler.handler(args)
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message }
      }
    }

    return { success: false, error: `Unknown action: ${name}` }
  }, [navigate, profile])

  // Send message to orchestrator
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return

    const userMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      const res = await fetch('/api/miam-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang,
          currentPage: getCurrentPage(),
          availableActions: getAvailableActions(),
          conversationHistory: messages.slice(-10),
          context: {
            profileName: profile?.display_name,
            householdId: profile?.household_id,
          },
        }),
      })

      if (!res.ok) throw new Error('Orchestrator request failed')
      const data = await res.json()

      // Execute actions
      const executedActions = []
      if (data.actions && data.actions.length > 0) {
        for (const action of data.actions) {
          const result = await executeAction(action)
          executedActions.push({ ...action, result })
        }
      }

      const miamMessage = {
        role: 'miam',
        content: data.response,
        actions: executedActions,
      }
      setMessages(prev => [...prev, miamMessage])

      // TTS
      if (data.response) {
        speak(data.response)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'miam',
        content: t('miam.error'),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, lang, getCurrentPage, getAvailableActions, messages, profile, executeAction, speak, t])

  const openSheet = useCallback(() => setIsSheetOpen(true), [])
  const closeSheet = useCallback(() => setIsSheetOpen(false), [])
  const clearConversation = useCallback(() => setMessages([]), [])

  // Wake word: "Hey Miam"
  useWakeWord({
    enabled: wakeWordEnabled && !isSheetOpen && !isVoiceActive,
    onWake: openSheet,
    lang,
  })

  return (
    <MiamContext.Provider value={{
      isSheetOpen, openSheet, closeSheet,
      messages, sendMessage, clearConversation, isLoading,
      registerActions, getCurrentPage, getAvailableActions,
      ttsEnabled, toggleTTS, speak,
      wakeWordEnabled, toggleWakeWord,
      isVoiceActive, setIsVoiceActive,
    }}>
      {children}
    </MiamContext.Provider>
  )
}

export function useMiam() {
  const ctx = useContext(MiamContext)
  if (!ctx) throw new Error('useMiam must be used within MiamProvider')
  return ctx
}
