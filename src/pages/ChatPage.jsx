import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import DictationButton from '../components/DictationButton'
import DictationTrace from '../components/DictationTrace'

export default function ChatPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [miamMode, setMiamMode] = useState(false)
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-resize textarea when content changes
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [newMessage])

  useEffect(() => {
    if (!profile?.household_id) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(display_name)')
        .eq('household_id', profile.household_id)
        .order('created_at', { ascending: true })
      if (data) setMessages(data)
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.household_id])

  useEffect(() => {
    scrollToBottom()
  }, [messages, aiLoading])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = newMessage.trim()
    if (!content || sending) return

    setSending(true)
    setNewMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    await supabase.from('messages').insert({
      household_id: profile.household_id,
      profile_id: profile.id,
      content,
    })

    // Fire-and-forget push notification
    fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        household_id: profile.household_id,
        sender_profile_id: profile.id,
        title: profile.display_name,
        body: content.length > 100 ? content.slice(0, 100) + '...' : content,
      }),
    }).catch(() => {})

    setSending(false)

    // Detect @Miam mention or Miam mode toggle
    if (miamMode || /@miam/i.test(content)) {
      setAiLoading(true)
      try {
        const historyForAI = messages.slice(-20).map(msg => ({
          content: msg.content,
          is_ai: msg.is_ai || false,
        }))

        const res = await fetch('/api/chat-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, history: historyForAI, lang }),
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

        // Fire-and-forget push notification for AI response
        fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

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

  const isMine = (msg) => msg.profile_id === profile.id

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

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-2xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <h1 className="hidden md:block text-xl font-bold text-gray-900 px-4 py-3 border-b border-gray-200 shrink-0">
        {t('chat.title')}
      </h1>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-10 space-y-2">
            <p className="text-gray-400">{t('chat.noMessages')}</p>
            <p className="text-gray-400 text-sm">{t('chat.aiHint')}</p>
          </div>
        )}

        {messages.map((msg) => {
          const mine = isMine(msg)
          const isAI = msg.is_ai

          if (isAI) {
            return (
              <div key={msg.id} className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs shrink-0">
                  🤖
                </div>
                <div className="max-w-[75%] flex flex-col items-start">
                  <span className="text-xs text-indigo-500 mb-0.5 ml-1 font-medium">Miam</span>
                  <div className="px-3 py-2 rounded-2xl text-sm leading-relaxed bg-indigo-50 text-indigo-900 rounded-bl-md shadow-sm">
                    {renderMarkdown(msg.content)}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 ml-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          }

          const initial = msg.profiles?.display_name?.charAt(0)?.toUpperCase() || '?'
          const name = msg.profiles?.display_name || '?'

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}
            >
              {!mine && (
                <div className="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initial}
                </div>
              )}

              <div className={`max-w-[75%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && (
                  <span className="text-xs text-gray-500 mb-0.5 ml-1">{name}</span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    mine
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
                <span className={`text-[10px] text-gray-400 mt-0.5 ${mine ? 'mr-1' : 'ml-1'}`}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          )
        })}

        {aiLoading && (
          <div className="flex items-end gap-2">
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

      {dictationTrace && (
        <div className="shrink-0 px-3 pt-2 md:px-4 bg-white border-t border-gray-100">
          <DictationTrace trace={dictationTrace} />
        </div>
      )}

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
    </div>
  )
}
