import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useLanguage } from './LanguageContext'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/apiClient'
import { logAI } from '../lib/aiLogger'
import { useWakeWord } from '../hooks/useWakeWord'
import { useVoiceChat } from '../hooks/useVoiceChat'

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

  // Conversation — persistée en localStorage par foyer
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

  // Membres du foyer (pour contexte correction + orchestrateur)
  const [householdMembers, setHouseholdMembers] = useState([])

  // Action registry
  const actionsRef = useRef({})

  // Context provider registry (pages peuvent fournir du contexte dynamique)
  const contextProvidersRef = useRef({})

  // ID du dernier message envoyé par Miam dans le chat du foyer
  const lastSentMessageIdRef = useRef(null)

  // Voice chat mode
  const [voiceChatActive, setVoiceChatActive] = useState(false)
  const voiceChatActiveRef = useRef(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isSpeakingRef = useRef(false)
  const sendMessageRef = useRef(null)
  const voiceChatFnsRef = useRef({})

  // Voice chat utterance handler (utilise sendMessageRef pour éviter la dépendance circulaire)
  const handleVoiceChatUtterance = useCallback((text) => {
    sendMessageRef.current?.(text)
  }, [])

  const voiceChat = useVoiceChat({
    onUtterance: handleVoiceChatUtterance,
    lang,
  })

  // Synchroniser les refs du voice chat
  useEffect(() => {
    voiceChatFnsRef.current = {
      start: voiceChat.start,
      stop: voiceChat.stop,
      enterSpeaking: voiceChat.enterSpeaking,
      resumeListening: voiceChat.resumeListening,
    }
  }, [voiceChat.start, voiceChat.stop, voiceChat.enterSpeaking, voiceChat.resumeListening])

  // Fetch des membres du foyer + chargement historique depuis localStorage
  useEffect(() => {
    if (!profile?.household_id) return

    // Membres du foyer
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('household_id', profile.household_id)
      .then(({ data }) => { if (data) setHouseholdMembers(data) })

    // Charger l'historique persisté
    try {
      const stored = localStorage.getItem(`miam_history_${profile.household_id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, [profile?.household_id])

  // Persister l'historique à chaque changement (max 50 messages)
  useEffect(() => {
    if (!profile?.household_id || messages.length === 0) return
    try {
      localStorage.setItem(`miam_history_${profile.household_id}`, JSON.stringify(messages.slice(-50)))
    } catch {
      // ignore localStorage errors
    }
  }, [messages, profile?.household_id])

  const registerActions = useCallback((pageActions) => {
    actionsRef.current = { ...actionsRef.current, ...pageActions }
    return () => {
      for (const key of Object.keys(pageActions)) {
        delete actionsRef.current[key]
      }
    }
  }, [])

  // Enregistrement de fournisseurs de contexte dynamique (ex: liste d'inventaire)
  const registerContextProvider = useCallback((key, providerFn) => {
    contextProvidersRef.current[key] = providerFn
    return () => {
      delete contextProvidersRef.current[key]
    }
  }, [])

  // Collecte le contexte de tous les providers enregistrés
  const collectContext = useCallback(() => {
    const collected = {}
    for (const [key, fn] of Object.entries(contextProvidersRef.current)) {
      try { collected[key] = fn() } catch { /* ignore provider errors */ }
    }
    return collected
  }, [])

  const getCurrentPage = useCallback(() => {
    return PAGE_MAP[location.pathname] || 'unknown'
  }, [location.pathname])

  const getAvailableActions = useCallback(() => {
    return Object.keys(actionsRef.current)
  }, [])

  // TTS — amélioré avec support conversation vocale
  const speak = useCallback((text) => {
    // En mode conversation vocale, toujours parler. Sinon respecter le toggle TTS.
    const shouldSpeak = voiceChatActiveRef.current || ttsEnabled
    if (!shouldSpeak || !window.speechSynthesis) {
      // Si conversation vocale active mais synth indisponible, reprendre l'écoute
      if (voiceChatActiveRef.current) {
        voiceChatFnsRef.current.resumeListening?.()
      }
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const langMap = { fr: 'fr-FR', en: 'en-US', zh: 'zh-CN' }
    utterance.lang = langMap[lang] || 'fr-FR'
    utterance.rate = 1.0
    utterance.pitch = 1.1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang.startsWith(utterance.lang) && v.localService)
    if (preferred) utterance.voice = preferred

    isSpeakingRef.current = true
    setIsSpeaking(true)

    // Notifier le voice chat qu'on entre en phase speaking (coupe le micro)
    if (voiceChatActiveRef.current) {
      voiceChatFnsRef.current.enterSpeaking?.()
    }

    utterance.onend = () => {
      isSpeakingRef.current = false
      setIsSpeaking(false)
      // Reprendre l'écoute en conversation vocale après la fin du TTS
      if (voiceChatActiveRef.current) {
        voiceChatFnsRef.current.resumeListening?.()
      }
    }

    utterance.onerror = () => {
      isSpeakingRef.current = false
      setIsSpeaking(false)
      if (voiceChatActiveRef.current) {
        voiceChatFnsRef.current.resumeListening?.()
      }
    }

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

  // Arrêter le TTS
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (isSpeakingRef.current) {
      isSpeakingRef.current = false
      setIsSpeaking(false)
    }
  }, [])

  // Interrompre le TTS et reprendre l'écoute (barge-in par tap)
  const interruptSpeaking = useCallback(() => {
    stopSpeaking()
    if (voiceChatActiveRef.current) {
      setTimeout(() => {
        voiceChatFnsRef.current.resumeListening?.()
      }, 200)
    }
  }, [stopSpeaking])

  // Execute action
  const executeAction = useCallback(async (action) => {
    const { name, args } = action

    // Built-in: navigate
    if (name === 'navigate') {
      navigate(args.path)
      return { success: true }
    }

    // Built-in: sendChatMessage (fallback quand pas sur ChatPage)
    if (name === 'sendChatMessage' && !actionsRef.current['sendChatMessage']) {
      if (!profile?.household_id || !profile?.id) return { success: false, error: 'No profile' }
      const { data, error } = await supabase
        .from('messages')
        .insert({
          household_id: profile.household_id,
          profile_id: profile.id,
          content: args.text,
        })
        .select('id')
        .single()
      if (!error && data?.id) {
        lastSentMessageIdRef.current = data.id
      }
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: editLastChatMessage
    if (name === 'editLastChatMessage') {
      const msgId = lastSentMessageIdRef.current
      if (!msgId) return { success: false, error: 'No last message to edit' }
      const { error } = await supabase
        .from('messages')
        .update({ content: args.newContent, edited_at: new Date().toISOString() })
        .eq('id', msgId)
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: deleteLastChatMessage
    if (name === 'deleteLastChatMessage') {
      const msgId = lastSentMessageIdRef.current
      if (!msgId) return { success: false, error: 'No last message to delete' }
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', msgId)
      if (!error) lastSentMessageIdRef.current = null
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: addInventoryItem (fonctionne depuis n'importe quelle page)
    if (name === 'addInventoryItem') {
      if (!profile?.household_id || !profile?.id) return { success: false, error: 'No profile' }
      const { error } = await supabase.from('inventory_items').insert({
        household_id: profile.household_id,
        added_by: profile.id,
        name: args.name,
        name_translations: args.name_translations || null,
        quantity: args.quantity ?? 1,
        unit: args.unit ?? 'piece',
        category: args.category ?? 'other',
        brand: args.brand || null,
        store: args.store || null,
        fill_level: 1,
        purchase_date: new Date().toISOString().split('T')[0],
      })
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: updateInventoryItem (fuzzy match par nom, fetch depuis DB)
    if (name === 'updateInventoryItem') {
      if (!profile?.household_id) return { success: false, error: 'No profile' }
      const { data: inv } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('household_id', profile.household_id)
      const nameLower = args.name.toLowerCase()
      const matched = inv?.find(i => i.name.toLowerCase().includes(nameLower))
        || inv?.find(i => nameLower.includes(i.name.toLowerCase()))
      if (!matched) return { success: false, error: `Item "${args.name}" not found` }
      const ALLOWED = ['name', 'brand', 'quantity', 'unit', 'price', 'fill_level', 'category', 'store', 'notes']
      const payload = Object.fromEntries(
        Object.entries(args.fields || {}).filter(([k]) => ALLOWED.includes(k))
      )
      if (!Object.keys(payload).length) return { success: false, error: 'No valid fields to update' }
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', matched.id)
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: consumeInventoryItem (fetch depuis DB, mirrors handleConsumeAll)
    if (name === 'consumeInventoryItem') {
      if (!profile?.household_id) return { success: false, error: 'No profile' }
      const { data: inv } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('household_id', profile.household_id)
      const nameLower = args.name.toLowerCase()
      const item = inv?.find(i => i.name.toLowerCase().includes(nameLower))
        || inv?.find(i => nameLower.includes(i.name.toLowerCase()))
      if (!item) return { success: false, error: `Item "${args.name}" not found` }
      await supabase.from('consumed_items').insert({
        household_id: item.household_id,
        name: item.name,
        name_translations: item.name_translations || null,
        brand: item.brand || null,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        price_per_kg: item.price_per_kg ?? null,
        price_estimated: item.price_estimated === true,
        category: item.category,
        purchase_date: item.purchase_date,
        store: item.store,
        notes: item.notes,
        added_by: item.added_by,
        consumed_by: profile.id,
        fill_level: item.fill_level ?? 1,
      })
      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Built-in: deleteInventoryItem (suppression directe sans historique)
    if (name === 'deleteInventoryItem') {
      if (!profile?.household_id) return { success: false, error: 'No profile' }
      const { data: inv } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('household_id', profile.household_id)
      const nameLower = args.name.toLowerCase()
      const item = inv?.find(i => i.name.toLowerCase().includes(nameLower))
        || inv?.find(i => nameLower.includes(i.name.toLowerCase()))
      if (!item) return { success: false, error: `Item "${args.name}" not found` }
      const { error } = await supabase.from('inventory_items').delete().eq('id', item.id)
      return error ? { success: false, error: error.message } : { success: true }
    }

    // Actions enregistrées par les pages
    const handler = actionsRef.current[name]
    if (handler) {
      try {
        const result = await handler.handler(args)
        // Si l'action retourne un ID (ex: sendChatMessage), on le tracke
        if (name === 'sendChatMessage' && result?.id) {
          lastSentMessageIdRef.current = result.id
        }
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

    const currentPage = getCurrentPage()
    const availableActions = getAvailableActions()
    const t0 = Date.now()

    try {
      const dynamicContext = collectContext()

      const res = await apiPost('/api/miam-orchestrator', {
        message: text,
        lang,
        currentPage,
        availableActions,
        conversationHistory: messages.slice(-10),
        context: {
          profileName: profile?.display_name,
          householdId: profile?.household_id,
          householdMembers,
          ...dynamicContext,
        },
      })

      if (!res.ok) throw new Error('Orchestrator request failed')
      const data = await res.json()
      const durationMs = Date.now() - t0

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

      // Log interaction IA (avec debug complet si disponible)
      logAI({
        householdId: profile?.household_id,
        profileId: profile?.id,
        endpoint: 'miam-orchestrator',
        input: {
          message: text,
          currentPage,
          availableActions,
          systemPrompt: data.debug?.systemPrompt,
          toolDeclarations: data.debug?.toolDeclarations,
          conversationHistory: data.debug?.conversationHistory,
          model: data.debug?.model,
          generationConfig: data.debug?.generationConfig,
        },
        output: {
          response: data.response,
          actions: data.actions,
          executedActions,
          rawResponse: data.debug?.rawResponse,
        },
        durationMs,
      })

      // TTS
      if (data.response) {
        speak(data.response)
      } else if (voiceChatActiveRef.current) {
        // Pas de texte de réponse — reprendre l'écoute directement
        voiceChatFnsRef.current.resumeListening?.()
      }
    } catch (err) {
      const errorMsg = t('miam.error')
      logAI({
        householdId: profile?.household_id,
        profileId: profile?.id,
        endpoint: 'miam-orchestrator',
        input: { message: text, currentPage, availableActions },
        durationMs: Date.now() - t0,
        error: err?.message || 'Unknown error',
      })
      setMessages(prev => [...prev, {
        role: 'miam',
        content: errorMsg,
      }])
      // En mode conversation vocale, lire l'erreur (qui reprendra l'écoute via onend)
      if (voiceChatActiveRef.current) {
        speak(errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, lang, getCurrentPage, getAvailableActions, messages, profile, householdMembers, collectContext, executeAction, speak, t])

  // Synchroniser sendMessageRef (doit être après la définition de sendMessage)
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  const openSheet = useCallback(() => setIsSheetOpen(true), [])
  const closeSheet = useCallback(() => {
    setIsSheetOpen(false)
    // Arrêter la conversation vocale si active
    if (voiceChatActiveRef.current) {
      voiceChatActiveRef.current = false
      setVoiceChatActive(false)
      setIsVoiceActive(false)
      voiceChatFnsRef.current.stop?.()
      stopSpeaking()
    }
  }, [stopSpeaking])

  // Démarrer une conversation vocale
  const startVoiceChat = useCallback(() => {
    if (!voiceChat.isSupported) return
    voiceChatActiveRef.current = true
    setVoiceChatActive(true)
    setIsVoiceActive(true)
    setIsSheetOpen(true)
    voiceChatFnsRef.current.start?.()
  }, [voiceChat.isSupported])

  // Arrêter la conversation vocale
  const stopVoiceChat = useCallback(() => {
    voiceChatActiveRef.current = false
    setVoiceChatActive(false)
    setIsVoiceActive(false)
    voiceChatFnsRef.current.stop?.()
    stopSpeaking()
  }, [stopSpeaking])

  const clearConversation = useCallback(() => {
    setMessages([])
    if (profile?.household_id) {
      try { localStorage.removeItem(`miam_history_${profile.household_id}`) } catch { /* ignore */ }
    }
  }, [profile?.household_id])

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
      registerActions, registerContextProvider,
      getCurrentPage, getAvailableActions,
      ttsEnabled, toggleTTS, speak,
      wakeWordEnabled, toggleWakeWord,
      isVoiceActive, setIsVoiceActive,
      householdMembers,
      voiceChatActive, startVoiceChat, stopVoiceChat,
      isSpeaking, stopSpeaking, interruptSpeaking,
      voiceChatPhase: voiceChat.phase,
      voiceChatTranscript: voiceChat.transcript,
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
