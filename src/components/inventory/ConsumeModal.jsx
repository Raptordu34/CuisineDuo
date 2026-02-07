import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import FillLevelPicker from '../FillLevelPicker'

export default function ConsumeModal({ item, onClose, onUpdateFillLevel, onConsumeAll }) {
  const { t } = useLanguage()
  const [newLevel, setNewLevel] = useState(item.fill_level ?? 1)
  const [saving, setSaving] = useState(false)

  const handleUpdateLevel = async () => {
    if (saving) return
    setSaving(true)
    await onUpdateFillLevel(item, newLevel)
    setSaving(false)
  }

  const handleConsumeAll = async () => {
    if (saving) return
    setSaving(true)
    await onConsumeAll(item)
    setSaving(false)
  }

  const effectiveQty = item.quantity * newLevel

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('inventory.consume')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="font-medium text-gray-900">{item.name}</p>
            <p className="text-sm text-gray-500">
              {item.quantity} {item.unit ? t(`unit.${item.unit}`) : ''}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">{t('inventory.fillLevel')}</label>
            <div className="flex items-center justify-center">
              <FillLevelPicker value={newLevel} onChange={setNewLevel} size="md" />
            </div>
            <p className="text-center text-sm text-gray-500">
              ~{effectiveQty % 1 === 0 ? effectiveQty : effectiveQty.toFixed(2)} {item.unit ? t(`unit.${item.unit}`) : ''}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConsumeAll}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-red-300 text-red-500 hover:bg-red-50 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('inventory.consumed')}
            </button>
            <button
              type="button"
              onClick={handleUpdateLevel}
              disabled={saving || newLevel === (item.fill_level ?? 1)}
              className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('inventory.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
