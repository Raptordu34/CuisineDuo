import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CookingCompleteModal({ recipe, onClose, onSave }) {
  const { t } = useLanguage()
  const [notes, setNotes] = useState('')
  const [servings, setServings] = useState(recipe?.servings || 4)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    await onSave({ notes: notes.trim(), servingsCooked: servings })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-lg font-bold text-gray-900">{t('cooking.complete')}</h2>
          <p className="text-sm text-gray-500">{t('cooking.completeDesc')}</p>

          <div className="text-left space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cooking.servingsCooked')}
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('cooking.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('cooking.notesPlaceholder')}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('cooking.skip')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? t('common.loading') : t('cooking.saveHistory')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
