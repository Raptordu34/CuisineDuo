import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import DictationButton from '../DictationButton'

const CATEGORIES = [
  'dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains',
  'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other',
]
const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack']

export default function PhotoScanChatModal({ items: initialItems, existingInventory, onClose, onConfirm, lang }) {
  const { t } = useLanguage()
  const [items, setItems] = useState(initialItems)
  const [checkedItems, setCheckedItems] = useState(() => new Set(initialItems.map((_, i) => i)))
  const [duplicates, setDuplicates] = useState([])
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Initial AI call to detect duplicates and generate welcome message
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const res = await fetch('/api/inventory-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'refine-scan',
            message: null,
            items: initialItems,
            existingInventory: existingInventory.map(i => ({
              name: i.name, brand: i.brand, quantity: i.quantity, unit: i.unit,
            })),
            history: [],
            lang,
          }),
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setItems(data.items || initialItems)
          setDuplicates(data.duplicates || [])
          setCheckedItems(new Set((data.items || initialItems).map((_, i) => i)))
          const aiMsg = { role: 'assistant', content: data.response }
          setMessages([aiMsg])
          setHistory([{ role: 'assistant', content: data.response }])
        }
      } catch {
        // Silently fail, keep original items
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDictation = useCallback((text) => {
    setInput((prev) => prev ? prev + ' ' + text : text)
  }, [])

  const handleSend = async (e) => {
    e.preventDefault()
    const content = input.trim()
    if (!content || loading) return

    const userMsg = { role: 'user', content }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const newHistory = [...history, { role: 'user', content }]

    try {
      const res = await fetch('/api/inventory-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine-scan',
          message: content,
          items,
          existingInventory: existingInventory.map(i => ({
            name: i.name, brand: i.brand, quantity: i.quantity, unit: i.unit,
          })),
          history: newHistory,
          lang,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setItems(data.items || items)
        setDuplicates(data.duplicates || [])
        // Reset checked to all items after AI update
        setCheckedItems(new Set((data.items || items).map((_, i) => i)))
        const aiMsg = { role: 'assistant', content: data.response }
        setMessages(prev => [...prev, aiMsg])
        setHistory([...newHistory, { role: 'assistant', content: data.response }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: t('chat.aiError') }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: t('chat.aiError') }])
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (i) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const updateItem = (i, updated) => {
    setItems(prev => {
      const next = [...prev]
      next[i] = updated
      return next
    })
  }

  const selectedCount = checkedItems.size
  const selectedItems = items.filter((_, i) => checkedItems.has(i))

  const handleConfirm = () => {
    onConfirm(selectedItems)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded-t-2xl md:rounded-2xl flex flex-col" style={{ height: '90dvh', maxHeight: '90dvh' }}>
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-blue-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📷</span>
            <h3 className="font-semibold text-sm text-blue-900">{t('inventory.smartScan')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Items zone (top, scrollable) */}
        <div className="shrink-0 max-h-[40%] overflow-y-auto border-b border-gray-200">
          {initialLoading ? (
            <div className="p-4 text-center text-sm text-gray-400 animate-pulse">{t('common.loading')}</div>
          ) : (
            <div className="p-3 space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    checkedItems.has(i) ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={checkedItems.has(i)}
                      onChange={() => toggleItem(i)}
                      className="mt-1 shrink-0 accent-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(i, { ...item, name: e.target.value })}
                          className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        {duplicates.includes(i) && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full">
                            {t('inventory.alreadyInStock')}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, { ...item, quantity: parseFloat(e.target.value) || 1 })}
                          className="w-14 border border-gray-300 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(i, { ...item, unit: e.target.value })}
                          className="border border-gray-300 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
                        </select>
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(i, { ...item, category: e.target.value })}
                          className="border border-gray-300 rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat zone (middle, grows) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white rounded-br-md'
                  : 'bg-blue-50 text-blue-900 rounded-bl-md'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl text-sm rounded-bl-md bg-blue-50 text-blue-500">
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
        <form onSubmit={handleSend} className="shrink-0 px-3 py-2 border-t border-gray-200 flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('inventory.chatPlaceholder')}
            className="min-w-0 flex-1 border border-gray-300 rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <DictationButton
            onResult={handleDictation}
            disabled={loading}
            color="orange"
            popoverDirection="up"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t('inventory.addScanned', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
