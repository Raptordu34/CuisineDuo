import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const FIELD_LABELS = {
  name: 'inventory.name',
  brand: 'inventory.brand',
  quantity: 'inventory.quantity',
  unit: 'inventory.unit',
  price: 'inventory.price',
  price_per_kg: 'inventory.pricePerKg',
  price_estimated: 'inventory.priceEstimated',
  fill_level: 'inventory.fillLevel',
  category: 'inventory.category',
  store: 'inventory.store',
  notes: 'inventory.notes',
  estimated_expiry_date: 'inventory.expiryDate',
}

export default function InventoryUpdateConfirmModal({ updates, summary, items, onConfirm, onCancel }) {
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)

  const resolveItem = (itemId) => items.find((i) => i.id === itemId)

  const handleConfirm = async () => {
    if (saving) return
    setSaving(true)
    await onConfirm()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onCancel}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{t('inventory.confirmUpdates')}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-sm text-gray-600 italic">{summary}</p>
          </div>
        )}

        {/* Updates list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {updates.map((update, idx) => {
            const item = resolveItem(update.item_id)
            if (!item) return null

            const isConsumed = update.action === 'consumed'
            const displayName = item.brand ? `${item.name} (${item.brand})` : item.name

            return (
              <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{displayName}</span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isConsumed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isConsumed ? t('inventory.consumed') : t('inventory.edit')}
                  </span>
                </div>

                {!isConsumed && update.fields && (
                  <div className="space-y-1">
                    {Object.entries(update.fields).map(([key, value]) => {
                      const labelKey = FIELD_LABELS[key]
                      if (!labelKey) return null
                      let displayValue = value
                      if (key === 'fill_level') {
                        const levels = { 1: 'fillLevel.full', 0.75: 'fillLevel.threeQuarter', 0.5: 'fillLevel.half', 0.25: 'fillLevel.quarter' }
                        displayValue = levels[value] ? t(levels[value]) : value
                      } else if (key === 'category') {
                        displayValue = t(`category.${value}`) || value
                      } else if (key === 'unit') {
                        displayValue = t(`unit.${value}`) || value
                      }
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{t(labelKey)} :</span>
                          <span className="text-gray-900 font-medium">{String(displayValue)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('inventory.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {t('inventory.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
