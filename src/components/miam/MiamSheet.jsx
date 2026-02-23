import { useState, useRef, useEffect, useCallback } from 'react'
import { useMiam } from '../../contexts/MiamContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'
import VoiceRecorder from '../VoiceRecorder'

function MiamBotIcon() {
  return (
    <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <MiamBotIcon />
      <div className="ml-2 flex gap-1">
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function ActionChip({ action, t }) {
  const labels = {
    navigate: t('miam.action.navigated', { page: action.args?.path }),
    openAddItem: t('miam.action.executed', { action: 'Ajouter article' }),
    openScanner: t('miam.action.executed', { action: 'Scanner' }),
    filterCategory: t('miam.action.executed', { action: 'Filtrer' }),
    sendChatMessage: t('miam.action.executed', { action: 'Message envoyé' }),
    editLastChatMessage: t('miam.action.executed', { action: 'Message modifié' }),
    deleteLastChatMessage: t('miam.action.executed', { action: 'Message supprimé' }),
    addInventoryItem: t('miam.action.executed', { action: `Ajouté : ${action.args?.name || ''}` }),
    updateInventoryItem: t('miam.action.executed', { action: `Mis à jour : ${action.args?.name || ''}` }),
    consumeInventoryItem:  t('miam.action.executed', { action: `Consommé : ${action.args?.name || ''}` }),
    deleteInventoryItem:   t('miam.action.executed', { action: `Supprimé : ${action.args?.name || ''}` }),
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs">
      {action.result?.success ? '✓' : '✗'} {labels[action.name] || action.name}
    </span>
  )
}

function MessageBubble({ msg, t }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-orange-500 text-white text-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 mb-3">
      <MiamBotIcon />
      <div className="max-w-[80%]">
        <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-indigo-50 text-gray-800 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
        {msg.actions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {msg.actions.map((action, i) => (
              <ActionChip key={i} action={action} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SuggestionChips({ currentPage, onSuggestion, t }) {
  const suggestions = {
    home: [
      { key: 'whatToCook', label: t('miam.suggest.whatToCook') },
      { key: 'scan', label: t('miam.suggest.scan') },
    ],
    inventory: [
      { key: 'scan', label: t('miam.suggest.scan') },
      { key: 'expiring', label: t('miam.suggest.expiring') },
      { key: 'addItem', label: t('miam.suggest.addItem') },
    ],
    chat: [
      { key: 'sendMessage', label: t('miam.suggest.sendMessage') },
    ],
  }

  const items = suggestions[currentPage] || suggestions.home

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      {items.map(s => (
        <button
          key={s.key}
          onClick={() => onSuggestion(s.label)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-600 text-xs font-medium hover:bg-indigo-50 transition-colors cursor-pointer"
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

export default function MiamSheet() {
  const {
    isSheetOpen, closeSheet,
    messages, sendMessage, clearConversation, isLoading,
    getCurrentPage,
    ttsEnabled, toggleTTS,
  } = useMiam()
  const { t } = useLanguage()

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { sheetStyle, handleProps, resetHeight } = useBottomSheetDrag({ onClose: closeSheet })

  // Reset la hauteur a chaque ouverture
  useEffect(() => {
    if (isSheetOpen) {
      resetHeight()
    }
  }, [isSheetOpen, resetHeight])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Focus input when sheet opens
  useEffect(() => {
    if (isSheetOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isSheetOpen])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
    setInput('')
  }, [input, isLoading, sendMessage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleSuggestion = useCallback((text) => {
    sendMessage(text)
  }, [sendMessage])

  const handleDictationResult = useCallback((text) => {
    if (text.trim()) {
      sendMessage(text.trim())
    }
  }, [sendMessage])

  if (!isSheetOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[55] bg-black/40 transition-opacity"
        onClick={closeSheet}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 inset-x-0 z-[60] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-[slideUp_0.3s_ease-out]"
        style={sheetStyle}
      >

        {/* Drag handle */}
        <div
          {...handleProps}
          className="flex items-center justify-center py-2 shrink-0"
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MiamBotIcon />
            <span className="font-semibold text-indigo-600">{t('miam.sheet.title')}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {getCurrentPage()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* TTS toggle */}
            <button
              onClick={toggleTTS}
              title={ttsEnabled ? t('miam.tts.disable') : t('miam.tts.enable')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                ttsEnabled ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            </button>
            {/* Clear */}
            <button
              onClick={clearConversation}
              title={t('miam.sheet.clear')}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={closeSheet}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MiamBotIcon />
              <p className="text-sm text-gray-500 mt-3">{t('miam.welcome')}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} t={t} />
          ))}
          {isLoading && <ThinkingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <SuggestionChips
            currentPage={getCurrentPage()}
            onSuggestion={handleSuggestion}
            t={t}
          />
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-100 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-end gap-2">
            <VoiceRecorder
              onResult={handleDictationResult}
              disabled={isLoading}
              color="indigo"
              popoverDirection="up"
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('miam.sheet.placeholder')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-xl bg-indigo-500 text-white disabled:opacity-40 hover:bg-indigo-600 transition-colors cursor-pointer flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
