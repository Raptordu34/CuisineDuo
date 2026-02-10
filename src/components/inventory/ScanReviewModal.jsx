import { useState, useMemo, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import ScanReviewItemRow from './ScanReviewItemRow'
import DictationButton from '../DictationButton'
import DictationTrace from '../DictationTrace'

export default function ScanReviewModal({ items: initialItems, receiptTotal, onClose, onConfirm }) {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState(initialItems)
  const [checked, setChecked] = useState(() => initialItems.map(() => true))
  const [saving, setSaving] = useState(false)
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)

  const selectedCount = checked.filter(Boolean).length

  const stats = useMemo(() => {
    const total = items.reduce((sum, item, i) => {
      if (!checked[i]) return sum
      return sum + (item.price ?? 0)
    }, 0)
    const hasEstimated = items.some((item, i) => checked[i] && item.price_estimated)
    const stores = [...new Set(items.filter((item, i) => checked[i] && item.store).map(item => item.store))]
    return { total, hasEstimated, store: stores.join(', ') || null }
  }, [items, checked])

  const toggleItem = (index) => {
    setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  const toggleAll = () => {
    const allChecked = checked.every(Boolean)
    setChecked(checked.map(() => !allChecked))
  }

  const updateItem = (index, newItem) => {
    setItems((prev) => prev.map((item, i) => (i === index ? newItem : item)))
  }

  const handleDictationResult = useCallback(async (text, dictLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)
    try {
      const res = await fetch('/api/inventory-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct-transcription',
          text,
          context: 'scan-correction',
          lang: dictLang || lang,
          items,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.items && Array.isArray(data.items)) {
          setItems(data.items)
          setChecked(data.items.map(() => true))
        }
        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.changes || t('dictation.scanCorrectionApplied'),
          timestamp: Date.now(),
        })
      }
    } catch {
      // silently fail, keep current items
    } finally {
      setDictationCorrecting(false)
    }
  }, [lang, items])

  const handleConfirm = async () => {
    if (saving || selectedCount === 0) return
    setSaving(true)
    const selectedItems = items.filter((_, i) => checked[i])
    await onConfirm(selectedItems)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{t('inventory.scanReview')}</h2>
            <DictationButton
              onResult={handleDictationResult}
              disabled={saving || dictationCorrecting}
              color="orange"
            />
            {dictationCorrecting && (
              <span className="text-xs text-gray-400 animate-pulse">{t('dictation.correcting')}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Dictation trace */}
        {dictationTrace && (
          <div className="px-4 pt-2 shrink-0">
            <DictationTrace trace={dictationTrace} />
          </div>
        )}

        {/* Stats header */}
        <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {t('inventory.scanItemCount', { count: selectedCount })}
              {stats.store && <span className="ml-2 text-blue-600">{stats.store}</span>}
            </span>
            <div className="text-right">
              <span className="font-semibold text-gray-900">{stats.total.toFixed(2)} &euro;</span>
              {receiptTotal != null && (
                <span className="ml-2 text-xs text-gray-500">
                  ({t('inventory.receiptTotal')}: {receiptTotal.toFixed(2)} &euro;)
                </span>
              )}
            </div>
          </div>
          {receiptTotal != null && Math.abs(stats.total - receiptTotal) > 0.50 && (
            <p className="text-xs text-red-500">{t('inventory.totalMismatch')}</p>
          )}
          {stats.hasEstimated && (
            <p className="text-xs text-amber-600">{t('inventory.scanPricesEstimated')}</p>
          )}
        </div>

        <div className="px-4 py-2 border-b border-gray-100 shrink-0">
          <button
            onClick={toggleAll}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
          >
            {checked.every(Boolean) ? t('inventory.scanDeselectAll') : t('inventory.scanSelectAll')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.map((item, index) => (
            <ScanReviewItemRow
              key={index}
              item={item}
              index={index}
              checked={checked[index]}
              onToggle={toggleItem}
              onChange={updateItem}
            />
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('inventory.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || saving}
            className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {t('inventory.addScanned', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  )
}
