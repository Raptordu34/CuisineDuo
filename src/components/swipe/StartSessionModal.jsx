import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const MEAL_TYPE_OPTIONS = ['breakfast', 'main', 'appetizer', 'dessert', 'snack', 'soup', 'salad']

export default function StartSessionModal({ onClose, onCreate }) {
  const { t } = useLanguage()
  const [mealCount, setMealCount] = useState(7)
  const [selectedTypes, setSelectedTypes] = useState(['main', 'appetizer', 'dessert'])
  const [creating, setCreating] = useState(false)

  const toggleType = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    await onCreate({ mealCount, mealTypes: selectedTypes })
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t('swipe.newSession')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        <div className="p-4 space-y-5">
          {/* Meal count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('swipe.mealCount')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="3"
                max="14"
                value={mealCount}
                onChange={(e) => setMealCount(parseInt(e.target.value))}
                className="flex-1 accent-orange-500"
              />
              <span className="text-lg font-bold text-orange-500 w-8 text-center">{mealCount}</span>
            </div>
          </div>

          {/* Meal types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('swipe.mealTypes')}
            </label>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                    selectedTypes.includes(type)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t(`recipeCategory.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('inventory.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || selectedTypes.length === 0}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {creating ? t('common.loading') : t('swipe.start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
