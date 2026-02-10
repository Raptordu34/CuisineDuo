import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useUnreadMessages } from '../hooks/useUnreadMessages'
import DictationButton from '../components/DictationButton'
import DictationTrace from '../components/DictationTrace'
import ChatMessage from '../components/chat/ChatMessage'
import ChatSuggestionChips from '../components/chat/ChatSuggestionChips'
import ChatActionMenu from '../components/chat/ChatActionMenu'
import ChatReplyPreview from '../components/chat/ChatReplyPreview'

export default function ChatPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const { markAsRead } = useUnreadMessages(profile)
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [miamMode, setMiamMode] = useState(false)
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [actionMenu, setActionMenu] = useState(null) // { msg, anchorEl }
  const [copiedToast, setCopiedToast] = useState(false)
  const [highlightedMsgId, setHighlightedMsgId] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [newMessage])

  // Mark as read on mount and when messages change
  useEffect(() => {
    markAsRead()
  }, [messages.length, markAsRead])

  // Fetch messages with reply_to
  useEffect(() => {
    if (!profile?.household_id) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(display_name), reply_to:reply_to_id(id, content, is_ai, profiles(display_name))')
        .eq('household_id', profile.household_id)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
    }

    const fetchReactions = async () => {
      const { data } = await supabase
        .from('message_reactions')
        .select('*')
        .in('message_id', (await supabase
          .from('messages')
          .select('id')
          .eq('household_id', profile.household_id)
        ).data?.map(m => m.id) || [])
      if (data) setReactions(data)
    }

    fetchMessages()
    fetchReactions().catch(() => {})

    // Subscribe to all message events (INSERT, DELETE)
    const msgChannel = supabase
      .channel(`messages:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `household_id=eq.${profile.household_id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data } = await supabase
              .from('messages')
              .select('*, profiles(display_name), reply_to:reply_to_id(id, content, is_ai, profiles(display_name))')
              .eq('id', payload.new.id)
              .single()
            if (data) {
              setMessages((prev) => {
                if (prev.some(m => m.id === data.id)) return prev
                return [...prev, data].sort((a, b) =>
                  new Date(a.created_at) - new Date(b.created_at)
                )
              })
              markAsRead()
            }
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter(m => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Subscribe to reactions
    const reactChannel = supabase
      .channel(`reactions:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          fetchReactions().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(reactChannel)
    }
  }, [profile?.household_id, markAsRead])

  useEffect(() => {
    scrollToBottom()
  }, [messages, aiLoading])

  // Fetch household context for AI
  const fetchHouseholdContext = useCallback(async () => {
    if (!profile?.household_id) return {}

    const [inventoryRes, recipesRes, listsRes] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('name, quantity, unit, expiry_date, fill_level')
        .eq('household_id', profile.household_id),
      supabase
        .from('recipes')
        .select('name, category')
        .eq('household_id', profile.household_id),
      supabase
        .from('shopping_lists')
        .select('id, name, shopping_list_items(name, checked)')
        .eq('household_id', profile.household_id)
        .eq('archived', false),
    ])

    return {
      inventory: inventoryRes.data || [],
      recipes: recipesRes.data || [],
      shoppingLists: (listsRes.data || []).map(l => ({
        name: l.name,
        items: l.shopping_list_items || [],
      })),
    }
  }, [profile?.household_id])

  const handleSend = async (e, chipText) => {
    if (e) e.preventDefault()
    const content = (chipText || newMessage).trim()
    if (!content || sending) return

    setSending(true)
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const insertData = {
      household_id: profile.household_id,
      profile_id: profile.id,
      content,
    }
    if (replyTo) {
      insertData.reply_to_id = replyTo.id
    }

    await supabase.from('messages').insert(insertData)
    setReplyTo(null)

    // Fire-and-forget push notification
    fetch('/api/push-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        household_id: profile.household_id,
        sender_profile_id: profile.id,
        title: profile.display_name,
        body: content.length > 100 ? content.slice(0, 100) + '...' : content,
      }),
    }).catch(() => {})

    setSending(false)

    // Detect @Miam mention or Miam mode
    if (miamMode || /@miam/i.test(content)) {
      setAiLoading(true)
      try {
        const historyForAI = messages.slice(-20).map(msg => ({
          content: msg.content,
          is_ai: msg.is_ai || false,
        }))

        const context = await fetchHouseholdContext()

        const res = await fetch('/api/chat-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            history: historyForAI,
            ...context,
          }),
        })

        if (!res.ok) throw new Error('AI request failed')

        const data = await res.json()
        const aiResponse = data.response

        await supabase.from('messages').insert({
          household_id: profile.household_id,
          profile_id: profile.id,
          content: aiResponse,
          is_ai: true,
        })

        // Push notification for AI response
        fetch('/api/push-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            household_id: profile.household_id,
            sender_profile_id: profile.id,
            title: 'Miam',
            body: aiResponse.length > 100 ? aiResponse.slice(0, 100) + '...' : aiResponse,
          }),
        }).catch(() => {})
      } catch {
        await supabase.from('messages').insert({
          household_id: profile.household_id,
          profile_id: profile.id,
          content: t('chat.aiError'),
          is_ai: true,
        })
      } finally {
        setAiLoading(false)
      }
    }
  }

  const handleChipSelect = (chipLabel) => {
    if (!miamMode) setMiamMode(true)
    handleSend(null, chipLabel)
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Date separator logic
  const getDateLabel = useCallback((dateStr) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()

    if (isSameDay(date, today)) return t('chat.today')
    if (isSameDay(date, yesterday)) return t('chat.yesterday')

    const locale = lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-US' : 'fr-FR'
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  }, [t, lang])

  // Check if two messages are in the same group (same author, within 5 min)
  const isGroupedWith = useCallback((msg, prevMsg) => {
    if (!prevMsg) return false
    if (msg.profile_id !== prevMsg.profile_id) return false
    if (msg.is_ai !== prevMsg.is_ai) return false
    const diff = new Date(msg.created_at) - new Date(prevMsg.created_at)
    return diff < 5 * 60 * 1000
  }, [])

  const handleDictationResult = useCallback(async (text, dictLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)
    try {
      const chatHistory = messages.slice(-20).map(msg => ({
        author: msg.is_ai ? 'Miam (AI assistant)' : (msg.profiles?.display_name || 'User'),
        content: msg.content,
      }))
      const res = await fetch('/api/correct-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: 'chat', lang: dictLang || lang, chatHistory }),
      })
      if (res.ok) {
        const data = await res.json()
        setNewMessage((prev) => prev ? prev + ' ' + data.corrected : data.corrected)
        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.corrected,
          timestamp: Date.now(),
        })
      } else {
        setNewMessage((prev) => prev ? prev + ' ' + text : text)
      }
    } catch {
      setNewMessage((prev) => prev ? prev + ' ' + text : text)
    } finally {
      setDictationCorrecting(false)
    }
  }, [lang, messages])

  const handleReply = useCallback((msg) => {
    setReplyTo(msg)
    setActionMenu(null)
    textareaRef.current?.focus()
  }, [])

  const handleLongPress = useCallback((msg, anchorEl) => {
    setActionMenu({ msg, anchorEl })
  }, [])

  const handleDoubleTap = useCallback(async (msg) => {
    // Double tap = heart reaction
    await toggleReaction(msg.id, '❤️')
  }, [])

  const toggleReaction = useCallback(async (messageId, emoji) => {
    const existing = reactions.find(
      r => r.message_id === messageId && r.profile_id === profile.id && r.emoji === emoji
    )
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
      setReactions(prev => prev.filter(r => r.id !== existing.id))
    } else {
      const { data } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, profile_id: profile.id, emoji })
        .select()
        .single()
      if (data) {
        setReactions(prev => [...prev, data])
      }
    }
  }, [reactions, profile?.id])

  const handleCopy = useCallback((content) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedToast(true)
      setTimeout(() => setCopiedToast(false), 2000)
    })
  }, [])

  const handleDelete = useCallback(async (msgId) => {
    await supabase.from('messages').delete().eq('id', msgId)
  }, [])

  const handleScrollToMessage = useCallback((msgId) => {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedMsgId(msgId)
      setTimeout(() => setHighlightedMsgId(null), 2000)
    }
  }, [])

  // Reactions grouped by message
  const reactionsByMessage = useMemo(() => {
    const map = {}
    reactions.forEach(r => {
      if (!map[r.message_id]) map[r.message_id] = []
      map[r.message_id].push(r)
    })
    return map
  }, [reactions])

  const renderMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let listItems = []
    let listType = null
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
      if (/^###\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-medium mb-1">{formatInline(trimmed.slice(4))}</p>)
      } else if (/^##\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-semibold mb-1">{formatInline(trimmed.slice(3))}</p>)
      } else if (/^#\s/.test(trimmed)) {
        flushList()
        elements.push(<p key={key++} className="font-bold text-base mb-1">{formatInline(trimmed.slice(2))}</p>)
      } else if (/^[-*]\s/.test(trimmed)) {
        if (listType !== 'ul') flushList()
        listType = 'ul'
        listItems.push(<li key={key++} className="mb-0.5">{formatInline(trimmed.slice(2))}</li>)
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') flushList()
        listType = 'ol'
        listItems.push(<li key={key++} className="mb-0.5">{formatInline(trimmed.replace(/^\d+\.\s/, ''))}</li>)
      } else if (trimmed === '') {
        flushList()
      } else {
        flushList()
        elements.push(<p key={key++} className="mb-1.5 last:mb-0">{formatInline(trimmed)}</p>)
      }
    }
    flushList()
    return elements
  }

  // Build message list with date separators
  const renderMessages = () => {
    const result = []
    let lastDateLabel = null

    messages.forEach((msg, i) => {
      const dateLabel = getDateLabel(msg.created_at)
      if (dateLabel !== lastDateLabel) {
        result.push(
          <div key={`date-${msg.id}`} className="flex justify-center my-4">
            <span className="px-3 py-1 bg-gray-200/70 text-gray-500 text-xs rounded-full">
              {dateLabel}
            </span>
          </div>
        )
        lastDateLabel = dateLabel
      }

      const prevMsg = i > 0 ? messages[i - 1] : null
      const grouped = isGroupedWith(msg, prevMsg) && getDateLabel(prevMsg?.created_at) === dateLabel
      const mine = msg.profile_id === profile.id && !msg.is_ai

      result.push(
        <div
          key={msg.id}
          className={`transition-colors duration-500 ${highlightedMsgId === msg.id ? 'bg-yellow-100/50 rounded-xl' : ''}`}
        >
          <ChatMessage
            msg={msg}
            isMine={mine}
            isGrouped={grouped}
            showAvatar={!grouped}
            onReply={handleReply}
            onLongPress={handleLongPress}
            onDoubleTap={handleDoubleTap}
            onScrollToMessage={handleScrollToMessage}
            reactions={reactionsByMessage[msg.id]}
            myProfileId={profile.id}
            onToggleReaction={toggleReaction}
            renderMarkdown={renderMarkdown}
            formatTime={formatTime}
            t={t}
          />
        </div>
      )
    })

    return result
  }

  const showSuggestions = messages.length === 0 || miamMode

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-2xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <h1 className="hidden md:block text-xl font-bold text-gray-900 px-4 py-3 border-b border-gray-200 shrink-0">
        {t('chat.title')}
      </h1>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center mt-10 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-100 flex items-center justify-center text-3xl">
              🤖
            </div>
            <p className="text-gray-700 font-medium">{t('chat.emptyTitle')}</p>
            <p className="text-gray-400 text-sm">{t('chat.emptySubtitle')}</p>
          </div>
        )}

        {messages.length === 0 && (
          <div className="mt-6">
            <ChatSuggestionChips onSelect={handleChipSelect} />
          </div>
        )}

        {renderMessages()}

        {aiLoading && (
          <div className="flex items-end gap-2 mt-3">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs shrink-0">
              🤖
            </div>
            <div className="px-3 py-2 rounded-2xl text-sm bg-indigo-50 text-indigo-500 rounded-bl-md shadow-sm">
              <span className="inline-flex items-center gap-1">
                {t('chat.aiThinking')}
                <span className="animate-bounce [animation-delay:0ms]">.</span>
                <span className="animate-bounce [animation-delay:150ms]">.</span>
                <span className="animate-bounce [animation-delay:300ms]">.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips when miam mode active (and has messages) */}
      {miamMode && messages.length > 0 && (
        <div className="shrink-0 px-3 py-2 bg-white border-t border-gray-100">
          <ChatSuggestionChips onSelect={handleChipSelect} />
        </div>
      )}

      {dictationTrace && (
        <div className="shrink-0 px-3 pt-2 md:px-4 bg-white border-t border-gray-100">
          <DictationTrace trace={dictationTrace} />
        </div>
      )}

      {/* Reply preview */}
      <ChatReplyPreview
        replyTo={replyTo}
        onCancel={() => setReplyTo(null)}
        t={t}
      />

      <form onSubmit={handleSend} className="shrink-0 px-3 py-2 md:px-4 md:py-3 border-t border-gray-200 bg-white flex items-end gap-2">
        <button
          type="button"
          onClick={() => setMiamMode(!miamMode)}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all cursor-pointer ${
            miamMode
              ? 'bg-indigo-500 text-white shadow-md scale-110'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          🤖
        </button>
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
          placeholder={miamMode ? t('chat.aiPlaceholder') : t('chat.placeholder')}
          className={`flex-1 min-w-0 border rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none leading-normal ${
            miamMode
              ? 'border-indigo-300 focus:ring-indigo-400 bg-indigo-50/50'
              : 'border-gray-300 focus:ring-orange-400'
          }`}
          style={{ maxHeight: '120px', overflowY: 'auto' }}
        />
        <DictationButton
          onResult={handleDictationResult}
          disabled={sending || dictationCorrecting}
          color={miamMode ? 'indigo' : 'orange'}
          popoverDirection="up"
        />
        {dictationCorrecting && (
          <span className="shrink-0 text-xs text-gray-400 animate-pulse">{t('dictation.correcting')}</span>
        )}
        <button
          type="submit"
          disabled={!newMessage.trim() || sending || dictationCorrecting}
          className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            miamMode
              ? 'bg-indigo-500 hover:bg-indigo-600'
              : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {t('chat.send')}
        </button>
      </form>

      {/* Action menu */}
      {actionMenu && (
        <ChatActionMenu
          msg={actionMenu.msg}
          anchorEl={actionMenu.anchorEl}
          isMine={actionMenu.msg.profile_id === profile.id && !actionMenu.msg.is_ai}
          onClose={() => setActionMenu(null)}
          onReply={handleReply}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onReact={toggleReaction}
          t={t}
        />
      )}

      {/* Copied toast */}
      {copiedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg z-[200] animate-fade-in">
          {t('chat.copied')}
        </div>
      )}
    </div>
  )
}
