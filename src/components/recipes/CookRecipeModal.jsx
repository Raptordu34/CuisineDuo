import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function CookRecipeModal({ recipe, inventoryItems, onClose, onConfirm }) {
  const { t } = useLanguage()
  const [servingsCooked, setServingsCooked] = useState(recipe.servings?.toString() || '1')
  const [notes, setNotes] = useState('')
  const [deductions, setDeductions] = useState(() => {
    if (!recipe.ingredients?.length) return []
    return recipe.ingredients.map(ing => {
      const ingName = (ing.name || '').toLowerCase()
      const match = inventoryItems?.find(inv => {
        const invName = inv.name.toLowerCase()
        return invName.includes(ingName) || ingName.includes(invName)
      })
      return {
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        inStock: !!match,
        consume: !!match,
      }
    })
  })
  const [saving, setSaving] = useState(false)

  const toggleDeduction = (i) => {
    const updated = [...deductions]
    updated[i] = { ...updated[i], consume: !updated[i].consume }
    setDeductions(updated)
  }

  const handleConfirm = async () => {
    if (saving) return
    setSaving(true)
    await onConfirm({
      servingsCooked: servingsCooked ? Number(servingsCooked) : null,
      notes: notes.trim() || null,
      deductions: deductions.filter(d => d.consume),
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('recipes.cookRecipe')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Servings */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.servingsCooked')}</label>
            <input
              type="number"
              min="1"
              value={servingsCooked}
              onChange={e => setServingsCooked(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('inventory.notes')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('recipes.cookNotesPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>

          {/* Ingredient deductions */}
          {deductions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">{t('recipes.deductIngredients')}</label>
              <div className="space-y-1.5">
                {deductions.map((ded, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                      ded.inStock
                        ? ded.consume ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white'
                        : 'border-gray-100 bg-gray-50 opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={ded.consume}
                      onChange={() => toggleDeduction(i)}
                      disabled={!ded.inStock}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{ded.name}</span>
                    {ded.quantity && (
                      <span className="text-xs text-gray-400">
                        {ded.quantity} {ded.unit || ''}
                      </span>
                    )}
                    {!ded.inStock && (
                      <span className="text-[10px] text-red-400">{t('recipes.notInStock')}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 cursor-pointer">
            {t('inventory.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium cursor-pointer transition-colors"
          >
            {saving ? '...' : t('inventory.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
