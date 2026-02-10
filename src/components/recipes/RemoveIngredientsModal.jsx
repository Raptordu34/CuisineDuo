import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatBaseQty } from '../../hooks/useInventoryMatch'

const UNIT_TO_ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 }
const UNIT_TO_G = { g: 1, kg: 1000 }
const NO_QTY_UNITS = new Set(['pinch', 'bunch', 'slice', 'clove', 'none', 'can', 'pack'])

function convertToBase(qty, unit) {
  if (!qty || !unit) return null
  const u = unit.toLowerCase()
  if (UNIT_TO_G[u] != null) return { value: qty * UNIT_TO_G[u], type: 'weight' }
  if (UNIT_TO_ML[u] != null) return { value: qty * UNIT_TO_ML[u], type: 'volume' }
  if (u === 'piece') return { value: qty, type: 'piece' }
  return null
}

function convertFromBase(value, baseType, targetUnit) {
  const u = targetUnit.toLowerCase()
  if (baseType === 'weight' && UNIT_TO_G[u] != null) return value / UNIT_TO_G[u]
  if (baseType === 'volume' && UNIT_TO_ML[u] != null) return value / UNIT_TO_ML[u]
  if (baseType === 'piece') return value
  return value
}

export default function RemoveIngredientsModal({ recipe, ingredients, matches, inventoryItems, onClose, onConfirm }) {
  const { t } = useLanguage()
  const [portions, setPortions] = useState(recipe.servings || 1)
  const [loading, setLoading] = useState(false)

  const ratio = (recipe.servings && recipe.servings > 0) ? portions / recipe.servings : 1

  // Build deduction plan for each ingredient
  const deductionPlan = useMemo(() => {
    return ingredients.map((ing, i) => {
      const match = matches[i]
      if (!match || match.status === 'missing' || match.inventoryItems.length === 0) {
        return { ingredient: ing, match, selected: false, disabled: true, actions: [] }
      }

      const ingUnit = (ing.unit || 'none').toLowerCase()
      const isNoQty = NO_QTY_UNITS.has(ingUnit) || !ing.quantity

      if (isNoQty) {
        // For no-qty units, just mark as "will consume" without quantity details
        return {
          ingredient: ing,
          match,
          selected: true,
          disabled: false,
          actions: match.inventoryItems.map(item => ({
            itemId: item.id,
            item,
            type: 'consume',
            deduction: null,
            remaining: null,
          })),
        }
      }

      const neededBase = convertToBase(ing.quantity * ratio, ingUnit)
      if (!neededBase) {
        return { ingredient: ing, match, selected: true, disabled: false, actions: [] }
      }

      // Sort matching items: oldest purchase_date first, then lowest fill_level
      const sortedItems = [...match.inventoryItems].sort((a, b) => {
        const dateA = a.purchase_date || '9999'
        const dateB = b.purchase_date || '9999'
        if (dateA !== dateB) return dateA.localeCompare(dateB)
        return (a.fill_level ?? 1) - (b.fill_level ?? 1)
      })

      let remaining = neededBase.value
      const actions = []

      for (const item of sortedItems) {
        if (remaining <= 0) break
        const itemUnit = (item.unit || 'piece').toLowerCase()
        const effectiveQty = (item.quantity || 0) * (item.fill_level ?? 1)
        const itemBase = convertToBase(effectiveQty, itemUnit)

        if (!itemBase || itemBase.type !== neededBase.type) continue

        if (remaining >= itemBase.value) {
          // Consume entirely
          actions.push({
            itemId: item.id,
            item,
            type: 'consume',
            deduction: itemBase.value,
            remaining: 0,
          })
          remaining -= itemBase.value
        } else {
          // Partial deduction
          const remainingInItem = itemBase.value - remaining
          const deductionInUnit = convertFromBase(remaining, neededBase.type, itemUnit)
          const remainingInUnit = convertFromBase(remainingInItem, neededBase.type, itemUnit)
          actions.push({
            itemId: item.id,
            item,
            type: 'reduce',
            deduction: remaining,
            deductionInUnit: Math.round(deductionInUnit * 100) / 100,
            remaining: remainingInItem,
            remainingInUnit: Math.round(remainingInUnit * 100) / 100,
          })
          remaining = 0
        }
      }

      return {
        ingredient: ing,
        match,
        selected: true,
        disabled: false,
        actions,
        baseType: neededBase.type,
      }
    })
  }, [ingredients, matches, ratio])

  const [selectedState, setSelectedState] = useState(() =>
    deductionPlan.map(d => d.selected)
  )

  const toggleSelect = (i) => {
    if (deductionPlan[i].disabled) return
    setSelectedState(prev => {
      const next = [...prev]
      next[i] = !next[i]
      return next
    })
  }

  const selectedCount = selectedState.filter((s, i) => s && !deductionPlan[i].disabled).length

  const handleConfirm = async () => {
    setLoading(true)
    const allActions = []
    for (let i = 0; i < deductionPlan.length; i++) {
      if (!selectedState[i] || deductionPlan[i].disabled) continue
      allActions.push(...deductionPlan[i].actions)
    }
    await onConfirm(allActions)
    setLoading(false)
    onClose()
  }

  const formatAction = (action, baseType) => {
    if (action.type === 'consume') {
      return t('recipes.willConsume')
    }
    const deducted = formatBaseQty(action.deduction, baseType)
    const remain = formatBaseQty(action.remaining, baseType)
    return `${deducted} → ${t('recipes.willRemain')} ${remain}`
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{t('recipes.removeIngredientsTitle')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Portions selector */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-center justify-center gap-4">
          <span className="text-sm text-gray-600">{t('recipes.servingsCooked')}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPortions(p => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer font-bold"
            >-</button>
            <span className="w-8 text-center font-semibold text-gray-900">{portions}</span>
            <button
              onClick={() => setPortions(p => p + 1)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 cursor-pointer font-bold"
            >+</button>
          </div>
        </div>

        {/* Ingredient list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {deductionPlan.map((plan, i) => (
            <label
              key={i}
              className={`flex items-start gap-2.5 p-2 rounded-lg transition-colors cursor-pointer ${
                plan.disabled ? 'opacity-40 cursor-not-allowed' : selectedState[i] ? 'bg-red-50' : 'bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedState[i] || false}
                onChange={() => toggleSelect(i)}
                disabled={plan.disabled}
                className="mt-0.5 rounded text-red-500 focus:ring-red-400"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {plan.ingredient.name}
                  {plan.ingredient.quantity && (
                    <span className="text-gray-500 font-normal">
                      {' '}{Math.round(plan.ingredient.quantity * ratio * 100) / 100}
                      {plan.ingredient.unit && plan.ingredient.unit !== 'none' ? ` ${plan.ingredient.unit}` : ''}
                    </span>
                  )}
                </div>
                {plan.disabled && (
                  <p className="text-xs text-gray-400">{t('recipes.notInStock')}</p>
                )}
                {!plan.disabled && plan.actions.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {plan.actions.map((action, j) => (
                      <p key={j} className="text-xs text-gray-500">
                        {action.item.name}
                        {action.item.brand ? ` (${action.item.brand})` : ''}
                        {' — '}
                        <span className={action.type === 'consume' ? 'text-red-500' : 'text-amber-600'}>
                          {formatAction(action, plan.baseType)}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0 || loading}
            className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? t('common.loading') : t('recipes.confirmRemoval', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
