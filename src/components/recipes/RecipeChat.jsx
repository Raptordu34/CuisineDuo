import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import DictationButton from '../DictationButton'
import RecipeEditConfirmModal from './RecipeEditConfirmModal'

export default function RecipeChat({ recipe, onClose, mode, currentStep, onRecipeUpdate, householdTasteProfiles, tasteParams }) {
  const { t, lang } = useLanguage()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleDictation = useCallback((text) => {
    setInput((prev) => prev ? prev + ' ' + text : text)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || loading) return

    const userMsg = { role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/recipe-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          message: content,
          recipe,
          history: messages,
          mode,
          currentStep,
          householdTasteProfiles,
          tasteParams,
          lang,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMsg = { role: 'assistant', content: data.response }
        if (data.updates && onRecipeUpdate) {
          assistantMsg.hasUpdates = true
          setMessages((prev) => [...prev, assistantMsg])
          setPendingUpdates({ updates: data.updates, summary: data.summary })
        } else {
          setMessages((prev) => [...prev, assistantMsg])
        }
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.aiError') }])
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chat.aiError') }])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmUpdates = () => {
    if (pendingUpdates && onRecipeUpdate) {
      onRecipeUpdate(pendingUpdates.updates)
    }
    setPendingUpdates(null)
  }

  const handleCancelUpdates = () => {
    setPendingUpdates(null)
  }

  const renderMarkdown = (text) => {
    const lines = text.split('\n')
    const elements = []
    let key = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (/^[-*]\s/.test(trimmed)) {
        elements.push(<li key={key++} className="ml-4 list-disc text-sm mb-0.5">{formatInline(trimmed.slice(2))}</li>)
      } else if (/^\d+\.\s/.test(trimmed)) {
        elements.push(<li key={key++} className="ml-4 list-decimal text-sm mb-0.5">{formatInline(trimmed.replace(/^\d+\.\s/, ''))}</li>)
      } else if (/^###?\s/.test(trimmed)) {
        elements.push(<p key={key++} className="font-semibold text-sm mb-1">{formatInline(trimmed.replace(/^#+\s/, ''))}</p>)
      } else {
        elements.push(<p key={key++} className="text-sm mb-1 last:mb-0">{formatInline(trimmed)}</p>)
      }
    }
    return elements
  }

  const formatInline = (str) => {
    const parts = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) parts.push(str.slice(lastIndex, match.index))
      if (match[2]) parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>)
      else if (match[3]) parts.push(<em key={match.index} className="italic">{match[3]}</em>)
      lastIndex = regex.lastIndex
    }
    if (lastIndex < str.length) parts.push(str.slice(lastIndex))
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
  }

  const isCooking = mode === 'cooking'

  return createPortal(
    <div className={`fixed flex flex-col bg-white ${
      isCooking
        ? 'z-50 inset-x-0 bottom-0 h-[50dvh] rounded-t-2xl shadow-xl border-t border-gray-200'
        : 'z-[60] inset-x-0 bottom-0 h-[50dvh] rounded-t-2xl shadow-xl border-t border-gray-200 md:z-50 md:inset-auto md:bottom-4 md:right-4 md:w-96 md:h-[500px] md:rounded-2xl md:shadow-xl md:border md:border-gray-200'
    }`}>
      {/* Header */}
      <div className={`shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between ${
        isCooking ? 'bg-green-50 rounded-t-2xl' : 'bg-indigo-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <div>
            <h3 className={`font-semibold text-sm ${isCooking ? 'text-green-900' : 'text-indigo-900'}`}>{t('recipes.chatWithAI')}</h3>
            <p className={`text-[10px] truncate max-w-48 ${isCooking ? 'text-green-500' : 'text-indigo-500'}`}>{recipe.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl"
        >&times;</button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm">{t('recipes.chatPlaceholder')}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-br-md'
                : isCooking
                  ? 'bg-green-50 text-green-900 rounded-bl-md'
                  : 'bg-indigo-50 text-indigo-900 rounded-bl-md'
            }`}>
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              {msg.hasUpdates && (
                <div className={`mt-1.5 pt-1.5 border-t text-xs font-medium flex items-center gap-1 ${
                  isCooking ? 'border-green-200 text-green-600' : 'border-indigo-200 text-indigo-600'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                  </svg>
                  {t('recipes.pendingChanges')}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className={`px-3 py-2 rounded-2xl text-sm rounded-bl-md ${isCooking ? 'bg-green-50 text-green-500' : 'bg-indigo-50 text-indigo-500'}`}>
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

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-gray-200 flex gap-2 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('recipes.chatPlaceholder')}
          className={`min-w-0 flex-1 border border-gray-300 rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${isCooking ? 'focus:ring-green-400' : 'focus:ring-indigo-400'}`}
        />
        <DictationButton
          onResult={handleDictation}
          disabled={loading}
          color={isCooking ? 'green' : 'indigo'}
          popoverDirection="up"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className={`shrink-0 w-9 h-9 flex items-center justify-center text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${isCooking ? 'bg-green-500 hover:bg-green-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </form>

      {/* Recipe edit confirm modal */}
      {pendingUpdates && (
        <RecipeEditConfirmModal
          updates={pendingUpdates.updates}
          summary={pendingUpdates.summary}
          onConfirm={handleConfirmUpdates}
          onCancel={handleCancelUpdates}
        />
      )}
    </div>,
    document.body
  )
}
