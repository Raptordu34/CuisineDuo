import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { apiPost } from '../lib/apiClient'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useMiamActions } from '../hooks/useMiamActions'
import { useMiam } from '../contexts/MiamContext'
import VoiceRecorder from '../components/VoiceRecorder'
import DictationTrace from '../components/DictationTrace'
import GifPicker from '../components/chat/GifPicker'
import MessageContextMenu from '../components/chat/MessageContextMenu'
import ReactionBadges from '../components/chat/ReactionBadges'
import EmojiPicker from '../components/chat/EmojiPicker'
import { useUnreadMessages } from '../contexts/UnreadMessagesContext'
import { useMessageReactions } from '../hooks/useMessageReactions'
import { useLongPress } from '../hooks/useLongPress'
import { logAI } from '../lib/aiLogger'

export default function ChatPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const { householdMembers } = useMiam()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [emojiPickerTarget, setEmojiPickerTarget] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const unreadSeparatorRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const initialScrollDone = useRef(false)
  const { markAsRead, lastReadAtRef, readStatuses, clearChatNotifications } = useUnreadMessages()

  // Miam orchestrator: register available actions
  useMiamActions({
    sendChatMessage: {
      handler: async ({ text }) => {
        if (!profile?.household_id || !profile?.id || !text) return
        const { data, error } = await supabase
          .from('messages')
          .insert({
            household_id: profile.household_id,
            profile_id: profile.id,
            content: text,
          })
          .select('id')
          .single()
        // Retourner l'ID pour que MiamContext puisse tracker le message (edit/delete)
        if (!error && data?.id) return { id: data.id }
      },
      description: 'Send a message in household chat',
    },
  })

  // Fermer les notifications push dès l'arrivée sur la page chat
  useEffect(() => {
    clearChatNotifications()
  }, [clearChatNotifications])

  // Calculer pour chaque message "mine" quels membres ont lu jusqu'a ce message
  // On affiche les avatars uniquement sous le dernier message lu par chaque membre
  const readAvatarsByMessageId = useMemo(() => {
    if (!readStatuses.length || !messages.length || !profile?.id) return {}

    const myMessages = messages.filter((m) => m.profile_id === profile.id && !m.is_ai)
    const result = {}

    for (const rs of readStatuses) {
      const memberReadAt = new Date(rs.last_read_at)
      // Trouver le dernier de mes messages lu par ce membre
      let lastReadMsg = null
      for (let i = myMessages.length - 1; i >= 0; i--) {
        if (new Date(myMessages[i].created_at) <= memberReadAt) {
          lastReadMsg = myMessages[i]
          break
        }
      }
      if (lastReadMsg) {
        if (!result[lastReadMsg.id]) result[lastReadMsg.id] = []
        result[lastReadMsg.id].push({
          profile_id: rs.profile_id,
          display_name: rs.profiles?.display_name || '?',
        })
      }
    }

    return result
  }, [readStatuses, messages, profile?.id])

  // Auto-resize textarea when content changes
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [newMessage])

  useEffect(() => {
    if (!profile?.household_id) return

    let pollingInterval = null
    let realtimeActive = false
    let mounted = true

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(display_name)')
        .eq('household_id', profile.household_id)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }

    const startPollingFallback = () => {
      if (pollingInterval || !mounted) return
      console.warn('[Chat] Realtime indisponible, activation du polling (5s)')
      pollingInterval = setInterval(fetchMessages, 5000)
    }

    const stopPollingFallback = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
      }
    }

    fetchMessages()

    const channel = supabase
      .channel(`messages:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${profile.household_id}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select('*, profiles(display_name)')
            .eq('id', payload.new.id)
            .single()
          if (data) {
            setMessages((prev) => {
              if (prev.some(m => m.id === data.id)) return prev
              return [...prev, data].sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at)
              )
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${profile.household_id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id
                ? { ...m, content: payload.new.content, deleted_at: payload.new.deleted_at, edited_at: payload.new.edited_at }
                : m
            )
          )
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          realtimeActive = true
          stopPollingFallback()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[Chat] Realtime error:', status, err)
          realtimeActive = false
          startPollingFallback()
        } else if (status === 'CLOSED') {
          realtimeActive = false
          startPollingFallback()
        }
      })

    // Re-fetch au retour au premier plan (mobile/PWA)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchMessages()
        if (!realtimeActive && !pollingInterval) {
          startPollingFallback()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      stopPollingFallback()
      supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [profile?.household_id])

  // Scroll initial : vers le separateur non lu ou vers le bas
  useEffect(() => {
    if (!messages.length || initialScrollDone.current) return

    // Petit delai pour que le DOM soit a jour
    requestAnimationFrame(() => {
      if (unreadSeparatorRef.current) {
        unreadSeparatorRef.current.scrollIntoView({ block: 'center' })
      } else {
        bottomRef.current?.scrollIntoView()
      }
      initialScrollDone.current = true
    })
  }, [messages])

  // Scroll en bas pour les nouveaux messages (seulement si deja en bas)
  const isNearBottom = useRef(true)

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const threshold = 100
    isNearBottom.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    setActionTarget(null)
  }, [])

  useEffect(() => {
    if (!initialScrollDone.current) return
    if (isNearBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // IntersectionObserver : marquer comme lu quand le bas est visible
  useEffect(() => {
    const target = bottomRef.current
    const container = scrollContainerRef.current
    if (!target || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          markAsRead()
        }
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [markAsRead])

  // Marquer comme lu aussi quand l'onglet redevient visible et qu'on est en bas
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isNearBottom.current) {
        markAsRead()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [markAsRead])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = newMessage.trim()
    if (!content || sending) return

    setSending(true)
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Mode edition : UPDATE au lieu d'INSERT
    if (editingMessage) {
      const editedAt = new Date().toISOString()
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id ? { ...m, content, edited_at: editedAt } : m
        )
      )
      await supabase
        .from('messages')
        .update({ content, edited_at: editedAt })
        .eq('id', editingMessage.id)
        .eq('profile_id', profile.id)
      setEditingMessage(null)
      setSending(false)
      return
    }

    // Capturer le reply avant de le réinitialiser
    const capturedReplyTo = replyTo
    setReplyTo(null)

    await supabase.from('messages').insert({
      household_id: profile.household_id,
      profile_id: profile.id,
      content,
      reply_to_id: capturedReplyTo?.id || null,
    })

    // Marquer comme lu apres envoi (on est forcement en bas)
    markAsRead()

    // Fire-and-forget push notification
    apiPost('/api/send-notification', {
      title: profile.display_name,
      body: content.length > 100 ? content.slice(0, 100) + '...' : content,
    }).catch(() => {})

    setSending(false)
  }

  const handleGifSelect = async (gif) => {
    setShowGifPicker(false)
    setSending(true)

    // Forcer le scroll en bas apres l'envoi du GIF
    isNearBottom.current = true

    await supabase.from('messages').insert({
      household_id: profile.household_id,
      profile_id: profile.id,
      content: '',
      message_type: 'gif',
      media_url: gif.url,
      gif_title: gif.title,
      giphy_id: gif.id,
    })

    markAsRead()

    apiPost('/api/send-notification', {
      title: profile.display_name,
      body: t('chat.sentGif'),
    }).catch(() => {})

    setSending(false)
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleDictationResult = useCallback(async (text, dictLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)
    const t0 = Date.now()
    try {
      const chatHistory = messages.slice(-20).map(msg => ({
        author: msg.is_ai ? 'Miam (AI assistant)' : (msg.profiles?.display_name || 'User'),
        content: msg.content,
      }))
      const res = await apiPost('/api/correct-transcription', { text, context: 'chat', lang: dictLang || lang, chatHistory, householdMembers })
      if (res.ok) {
        const data = await res.json()
        setNewMessage((prev) => prev ? prev + ' ' + data.corrected : data.corrected)
        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.corrected,
          timestamp: Date.now(),
        })
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'correct-transcription',
          input: { text, context: 'chat', lang: dictLang || lang },
          output: { corrected: data.corrected },
          durationMs: Date.now() - t0,
        })
      } else {
        setNewMessage((prev) => prev ? prev + ' ' + text : text)
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'correct-transcription',
          input: { text, context: 'chat', lang: dictLang || lang },
          durationMs: Date.now() - t0,
          error: `HTTP ${res.status}`,
        })
      }
    } catch (err) {
      setNewMessage((prev) => prev ? prev + ' ' + text : text)
      logAI({
        householdId: profile?.household_id,
        profileId: profile?.id,
        endpoint: 'correct-transcription',
        input: { text, context: 'chat', lang: dictLang || lang },
        durationMs: Date.now() - t0,
        error: err?.message || 'Unknown error',
      })
    } finally {
      setDictationCorrecting(false)
    }
  }, [lang, messages, householdMembers, profile])

  const isMine = (msg) => msg.profile_id === profile.id

  // Reactions
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages])
  const { reactionsByMessageId, toggleReaction } = useMessageReactions(profile, messageIds)

  const handleMessageLongPress = useCallback((e) => {
    const messageId = e.currentTarget?.dataset?.messageId
    if (messageId) {
      const msg = messages.find((m) => m.id === messageId)
      setActionTarget({
        messageId,
        x: e.clientX,
        y: e.clientY,
        isMine: msg?.profile_id === profile?.id,
        isGif: msg?.message_type === 'gif',
        isAI: msg?.is_ai || false,
        content: msg?.content || '',
        isDeleted: !!msg?.deleted_at,
      })
    }
  }, [messages, profile?.id])

  const longPressHandlers = useLongPress(handleMessageLongPress)

  const handleDelete = useCallback(async (messageId) => {
    setActionTarget(null)
    const deletedAt = new Date().toISOString()
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, deleted_at: deletedAt } : m))
    )
    await supabase
      .from('messages')
      .update({ deleted_at: deletedAt })
      .eq('id', messageId)
      .eq('profile_id', profile.id)
  }, [profile?.id])

  const handleEdit = useCallback((messageId) => {
    setActionTarget(null)
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    setReplyTo(null)
    setEditingMessage({ id: messageId, originalContent: msg.content })
    setNewMessage(msg.content)
    setTimeout(() => {
      textareaRef.current?.focus()
      // Placer le curseur en fin de texte
      const el = textareaRef.current
      if (el) { el.selectionStart = el.selectionEnd = el.value.length }
    }, 50)
  }, [messages])

  const handleCopy = useCallback((messageId) => {
    setActionTarget(null)
    const msg = messages.find((m) => m.id === messageId)
    if (msg?.content) {
      navigator.clipboard.writeText(msg.content).catch(() => {})
    }
  }, [messages])

  const handleReply = useCallback((messageId) => {
    setActionTarget(null)
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return
    setEditingMessage(null)
    setReplyTo({
      id: messageId,
      content: msg.content,
      authorName: msg.is_ai ? 'Miam' : (msg.profiles?.display_name || '?'),
      isGif: msg.message_type === 'gif',
    })
    textareaRef.current?.focus()
  }, [messages])

  const renderMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let listItems = []
    let listType = null // 'ul' or 'ol'
    let key = 0

    const flushList = () => {
      if (listItems.length > 0) {
        const Tag = listType === 'ol' ? 'ol' : 'ul'
        const cls = listType === 'ol' ? 'list-decimal pl-4 mb-2' : 'list-disc pl-4 mb-2'
        elements.push(<Tag key={key++} className={cls}>{listItems}</Tag>)
        listItems = []
        listType = null
      }
    }

    const formatInline = (str) => {
      const parts = []
      const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
      let lastIndex = 0
      let match
      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) {
          parts.push(str.slice(lastIndex, match.index))
        }
        if (match[2]) {
          parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>)
        } else if (match[3]) {
          parts.push(<em key={match.index} className="italic">{match[3]}</em>)
        } else if (match[4]) {
          parts.push(<code key={match.index} className="bg-indigo-100 px-1 rounded text-xs">{match[4]}</code>)
        }
        lastIndex = regex.lastIndex
      }
      if (lastIndex < str.length) {
        parts.push(str.slice(lastIndex))
      }
      return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // Headings
      if (/^###\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-medium mb-1">{formatInline(trimmed.slice(4))}</p>)
      } else if (/^##\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-semibold mb-1">{formatInline(trimmed.slice(3))}</p>)
      } else if (/^#\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-bold text-base mb-1">{formatInline(trimmed.slice(2))}</p>)
      }
      // Unordered list
      else if (/^[-*]\s/.test(trimmed)) {
        if (listType !== 'ul') flushList()
        listType = 'ul'
        listItems.push(<li key={key++} className="mb-0.5">{formatInline(trimmed.slice(2))}</li>)
      }
      // Ordered list
      else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') flushList()
        listType = 'ol'
        listItems.push(<li key={key++} className="mb-0.5">{formatInline(trimmed.replace(/^\d+\.\s/, ''))}</li>)
      }
      // Empty line = paragraph break
      else if (trimmed === '') {
        flushList()
      }
      // Normal text
      else {
        flushList()
        elements.push(<p key={key++} className="mb-1.5 last:mb-0">{formatInline(trimmed)}</p>)
      }
    }
    flushList()
    return elements
  }

  // Calculer le nombre de messages non lus et la position du separateur
  const separatorLastReadAt = lastReadAtRef.current
  const unreadStartIndex = separatorLastReadAt
    ? messages.findIndex(
        (m) =>
          m.profile_id !== profile.id &&
          new Date(m.created_at) > new Date(separatorLastReadAt)
      )
    : -1

  const unreadCountForSeparator =
    unreadStartIndex >= 0
      ? messages.filter(
          (m, i) => i >= unreadStartIndex && m.profile_id !== profile.id
        ).length
      : 0

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-2xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <h1 className="hidden md:block text-xl font-bold text-gray-900 px-4 py-3 border-b border-gray-200 shrink-0">
        {t('chat.title')}
      </h1>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center mt-10 space-y-2">
            <p className="text-gray-400">{t('chat.noMessages')}</p>
            <p className="text-gray-400 text-sm">{t('chat.aiHint')}</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const mine = isMine(msg)
          const isAI = msg.is_ai
          const showSeparator = index === unreadStartIndex && unreadCountForSeparator > 0

          return (
            <div key={msg.id}>
              {showSeparator && (
                <div
                  ref={unreadSeparatorRef}
                  className="flex items-center gap-3 my-4"
                >
                  <div className="flex-1 h-px bg-orange-300" />
                  <span className="text-xs font-medium text-orange-500 whitespace-nowrap">
                    {t('chat.unreadMessages', { count: unreadCountForSeparator })}
                  </span>
                  <div className="flex-1 h-px bg-orange-300" />
                </div>
              )}

              {isAI ? (
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs shrink-0">
                    🤖
                  </div>
                  <div className="max-w-[75%] flex flex-col items-start">
                    <span className="text-xs text-indigo-500 mb-0.5 ml-1 font-medium">Miam</span>
                    <div
                      data-message-id={msg.id}
                      {...longPressHandlers}
                      className="px-3 py-2 rounded-2xl text-sm leading-relaxed bg-indigo-50 text-indigo-900 rounded-bl-md shadow-sm select-none"
                    >
                      {msg.reply_to_id && (() => {
                        const replied = messages.find((m) => m.id === msg.reply_to_id)
                        return (
                          <div className="border-l-2 border-indigo-300 pl-2 mb-2 opacity-75">
                            <span className="text-[10px] font-medium block text-indigo-600">
                              {replied?.is_ai ? 'Miam' : (replied?.profiles?.display_name || '?')}
                            </span>
                            <p className="text-[10px] text-indigo-700 line-clamp-2">
                              {replied?.deleted_at ? t('chat.messageDeleted') : (replied?.message_type === 'gif' ? '[GIF]' : replied?.content || '...')}
                            </p>
                          </div>
                        )
                      })()}
                      {msg.deleted_at ? (
                        <span className="text-xs italic opacity-50">{t('chat.messageDeleted')}</span>
                      ) : (
                        renderMarkdown(msg.content)
                      )}
                    </div>
                    {reactionsByMessageId[msg.id] && Object.keys(reactionsByMessageId[msg.id]).length > 0 && (
                      <ReactionBadges
                        reactions={reactionsByMessageId[msg.id]}
                        onTapReaction={(emoji) => toggleReaction(msg.id, emoji)}
                        isMine={false}
                      />
                    )}
                    <span className="text-[10px] text-gray-400 mt-0.5 ml-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    {!mine && (
                      <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {msg.profiles?.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}

                    <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!mine && (
                        <span className="text-xs text-gray-500 mb-0.5 ml-1">
                          {msg.profiles?.display_name || '?'}
                        </span>
                      )}
                      <div
                        data-message-id={msg.id}
                        {...longPressHandlers}
                        className={`rounded-2xl text-sm leading-relaxed select-none ${
                          msg.message_type === 'gif'
                            ? 'p-1 overflow-hidden'
                            : 'px-3 py-2'
                        } ${
                          mine
                            ? 'bg-orange-500 text-white rounded-br-md'
                            : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                        }`}
                      >
                        {msg.reply_to_id && (() => {
                          const replied = messages.find((m) => m.id === msg.reply_to_id)
                          return (
                            <div className={`border-l-2 pl-2 mb-2 opacity-80 ${mine ? 'border-white/50' : 'border-gray-300'}`}>
                              <span className={`text-[10px] font-medium block ${mine ? 'text-orange-100' : 'text-gray-500'}`}>
                                {replied?.is_ai ? 'Miam' : (replied?.profiles?.display_name || '?')}
                              </span>
                              <p className={`text-[10px] line-clamp-2 ${mine ? 'text-orange-100' : 'text-gray-400'}`}>
                                {replied?.deleted_at ? t('chat.messageDeleted') : (replied?.message_type === 'gif' ? '[GIF]' : replied?.content || '...')}
                              </p>
                            </div>
                          )
                        })()}
                        {msg.deleted_at ? (
                          <span className="text-xs italic opacity-60">{t('chat.messageDeleted')}</span>
                        ) : msg.message_type === 'gif' && msg.media_url ? (
                          <img
                            src={msg.media_url}
                            alt="GIF"
                            className="rounded-xl max-w-full"
                            style={{ maxHeight: '200px' }}
                            loading="lazy"
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                      {reactionsByMessageId[msg.id] && Object.keys(reactionsByMessageId[msg.id]).length > 0 && (
                        <ReactionBadges
                          reactions={reactionsByMessageId[msg.id]}
                          onTapReaction={(emoji) => toggleReaction(msg.id, emoji)}
                          isMine={mine}
                        />
                      )}
                      <div className={`flex items-center gap-1 mt-0.5 ${mine ? 'mr-1 flex-row-reverse' : 'ml-1'}`}>
                        <span className="text-[10px] text-gray-400">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.edited_at && !msg.deleted_at && (
                          <span className="text-[9px] text-gray-400 italic">{t('chat.messageEdited')}</span>
                        )}
                        {mine && readAvatarsByMessageId[msg.id] && (
                          <div className="flex -space-x-1">
                            {readAvatarsByMessageId[msg.id].map((reader) => (
                              <div
                                key={reader.profile_id}
                                title={reader.display_name}
                                className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center text-white text-[8px] font-bold ring-1 ring-white"
                              >
                                {reader.display_name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {actionTarget && (
        <MessageContextMenu
          messageId={actionTarget.messageId}
          position={{ x: actionTarget.x, y: actionTarget.y }}
          isMine={actionTarget.isMine}
          isGif={actionTarget.isGif}
          isAI={actionTarget.isAI}
          isDeleted={actionTarget.isDeleted}
          onSelectEmoji={(msgId, emoji) => {
            toggleReaction(msgId, emoji)
            setActionTarget(null)
          }}
          onOpenFullPicker={(msgId) => {
            setActionTarget(null)
            setEmojiPickerTarget(msgId)
          }}
          onReply={handleReply}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onEdit={handleEdit}
          onClose={() => setActionTarget(null)}
        />
      )}

      {emojiPickerTarget && (
        <EmojiPicker
          messageId={emojiPickerTarget}
          onSelectEmoji={(msgId, emoji) => {
            toggleReaction(msgId, emoji)
            setEmojiPickerTarget(null)
          }}
          onClose={() => setEmojiPickerTarget(null)}
        />
      )}

      {dictationTrace && (
        <div className="shrink-0 px-3 pt-2 md:px-4 bg-white border-t border-gray-100">
          <DictationTrace trace={dictationTrace} />
        </div>
      )}

      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
          messages={messages}
          profile={profile}
        />
      )}

      <form onSubmit={handleSend} className="shrink-0 border-t border-gray-200 bg-white">
        {/* Prévisualisation reply ou mode édition */}
        {(replyTo || editingMessage) && (
          <div className="flex items-start gap-2 px-3 pt-2 pb-1">
            <div className={`flex-1 min-w-0 border-l-2 pl-2 ${editingMessage ? 'border-amber-400' : 'border-orange-400'}`}>
              <span className={`text-xs font-medium ${editingMessage ? 'text-amber-500' : 'text-orange-500'}`}>
                {editingMessage
                  ? t('chat.editingMessage')
                  : t('chat.replyingTo', { name: replyTo.authorName })}
              </span>
              <p className="text-xs text-gray-400 truncate">
                {editingMessage
                  ? editingMessage.originalContent
                  : replyTo.isGif
                  ? '[GIF]'
                  : replyTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (editingMessage) {
                  setEditingMessage(null)
                  setNewMessage('')
                } else {
                  setReplyTo(null)
                }
              }}
              className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 mt-0.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        )}
        {/* Zone de texte avec bouton envoyer integre */}
        <div className="flex items-end gap-2 px-3 pt-2.5 pb-1.5 md:px-4">
          <div className="flex-1 min-w-0 flex items-end border rounded-2xl transition-colors border-gray-300 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent">
            <textarea
              ref={textareaRef}
              rows={1}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              placeholder={t('chat.placeholder')}
              className="flex-1 min-w-0 bg-transparent px-4 py-2.5 text-sm focus:outline-none resize-none leading-normal"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || dictationCorrecting}
              className="shrink-0 w-8 h-8 m-1 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-orange-500 hover:bg-orange-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95l14.095-5.637a.75.75 0 0 0 0-1.4L3.105 2.288Z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Barre d'actions */}
        <div className="flex items-center gap-1 px-3 pb-2.5 md:px-4">
          {/* Bouton GIF */}
          <button
            type="button"
            onClick={() => setShowGifPicker(!showGifPicker)}
            className={`shrink-0 h-8 px-2.5 rounded-full flex items-center justify-center text-xs font-bold transition-colors cursor-pointer ${
              showGifPicker
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            GIF
          </button>

          {/* Dictation */}
          <VoiceRecorder
            onResult={handleDictationResult}
            disabled={sending || dictationCorrecting}
            color="orange"
            popoverDirection="up"
          />
          {dictationCorrecting && (
            <span className="shrink-0 text-xs text-gray-400 animate-pulse">{t('dictation.correcting')}</span>
          )}
        </div>
      </form>
    </div>
  )
}
