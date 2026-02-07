import { useRef, useCallback, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { FillLevelIndicator } from '../FillLevelPicker'

export default function InventoryItemCard({
  item, onEdit, onConsume,
  selectionMode, selected, onLongPress, onToggleSelect,
}) {
  const { t } = useLanguage()
  const longPressTimer = useRef(null)
  const didLongPress = useRef(false)
  const pointerStart = useRef(null)

  const isExpired = item.estimated_expiry_date && new Date(item.estimated_expiry_date) < new Date()
  const isExpiringSoon = !isExpired && item.estimated_expiry_date &&
    (new Date(item.estimated_expiry_date) - new Date()) < 3 * 24 * 60 * 60 * 1000

  const fillLevel = item.fill_level ?? 1
  const effectiveQty = item.quantity * fillLevel

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString()
  }

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handlePointerDown = useCallback((e) => {
    if (selectionMode) return
    didLongPress.current = false
    pointerStart.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onLongPress?.(item)
    }, 500)
  }, [selectionMode, onLongPress, item])

  const handlePointerMove = useCallback((e) => {
    if (!pointerStart.current || !longPressTimer.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      cancelLongPress()
    }
  }, [cancelLongPress])

  const handlePointerUp = useCallback(() => {
    cancelLongPress()
    pointerStart.current = null
  }, [cancelLongPress])

  const handlePointerLeave = useCallback(() => {
    cancelLongPress()
    pointerStart.current = null
  }, [cancelLongPress])

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    if (selectionMode) {
      onToggleSelect?.(item.id)
    }
  }, [selectionMode, onToggleSelect, item.id])

  return (
    <div
      className={`bg-white rounded-xl border p-3 transition-colors select-none overflow-hidden ${
        isExpired ? 'border-red-300 bg-red-50' :
        isExpiringSoon ? 'border-yellow-300 bg-yellow-50' :
        selected ? 'border-orange-400 bg-orange-50' :
        'border-gray-200'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {selectionMode && (
            <div className="mb-1">
              <input
                type="checkbox"
                checked={!!selected}
                onChange={() => onToggleSelect?.(item.id)}
                className="accent-orange-500 cursor-pointer"
              />
            </div>
          )}
          <h3 className="font-medium text-gray-900 truncate">
            {item.brand && <span className="text-gray-400 font-normal">{item.brand} </span>}
            {item.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <FillLevelIndicator value={fillLevel} size="sm" />
            <span className="text-sm text-gray-500">
              ~{effectiveQty % 1 === 0 ? effectiveQty : effectiveQty.toFixed(2)} {item.unit ? t(`unit.${item.unit}`) : ''}
            </span>
            {item.price != null && (
              <span className={`text-sm ${item.price_estimated ? 'text-amber-500' : 'text-gray-400'}`}>
                {item.price_estimated ? '~' : ''}{item.price.toFixed(2)} &euro;
              </span>
            )}
            {item.price_per_kg != null && (
              <span className="text-sm text-gray-400">
                ({item.price_per_kg.toFixed(2)} &euro;/{item.unit === 'l' || item.unit === 'ml' ? 'L' : 'kg'})
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">
              {t(`category.${item.category || 'other'}`)}
            </span>
            {item.store && (
              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full">
                {item.store}
              </span>
            )}
            {isExpired && (
              <span className="inline-block px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-medium">
                {t('inventory.expired')}
              </span>
            )}
            {isExpiringSoon && (
              <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] rounded-full font-medium">
                {t('inventory.expires')} {formatDate(item.estimated_expiry_date)}
              </span>
            )}
          </div>
        </div>
        {!selectionMode && (
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => onConsume(item)}
              className="w-8 h-8 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors cursor-pointer"
              title={t('inventory.consume')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </button>
            <button
              onClick={() => onEdit(item)}
              className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
              title={t('inventory.edit')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
