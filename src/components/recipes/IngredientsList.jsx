import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function IngredientsList({ ingredients, inventoryItems }) {
  const { t } = useLanguage()
  const [checked, setChecked] = useState(false)

  const checkInventory = () => setChecked(!checked)

  const getStatus = (ingredient) => {
    if (!checked || !inventoryItems?.length) return null
    const ingName = (ingredient.name || '').toLowerCase()
    const match = inventoryItems.find(inv => {
      const invName = inv.name.toLowerCase()
      return invName.includes(ingName) || ingName.includes(invName)
    })
    if (!match) return 'missing'
    // Simple quantity check
    if (ingredient.quantity && match.quantity) {
      if (match.quantity < ingredient.quantity) return 'insufficient'
    }
    return 'inStock'
  }

  const statusColors = {
    inStock: 'bg-green-50 border-green-200 text-green-700',
    insufficient: 'bg-orange-50 border-orange-200 text-orange-700',
    missing: 'bg-red-50 border-red-200 text-red-700',
  }

  const inStockCount = checked
    ? ingredients.filter(i => getStatus(i) !== 'missing').length
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">{t('recipes.ingredientsLabel')}</h2>
        <button
          onClick={checkInventory}
          className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
            checked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {checked ? t('recipes.inventoryChecked') : t('recipes.checkInventory')}
        </button>
      </div>

      {checked && inStockCount !== null && (
        <p className="text-xs text-gray-500 mb-2">
          {t('recipes.ingredientsInStock', { count: inStockCount, total: ingredients.length })}
        </p>
      )}

      <ul className="space-y-1.5">
        {ingredients.map((ing, i) => {
          const status = getStatus(ing)
          return (
            <li
              key={i}
              className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg border ${
                status ? statusColors[status] : 'border-gray-100 bg-white text-gray-700'
              }`}
            >
              <span className="flex-1">
                <span className="font-medium">{ing.name}</span>
                {(ing.quantity || ing.unit) && (
                  <span className="text-gray-400 ml-1">
                    {ing.quantity && ing.quantity}{ing.unit && ` ${ing.unit}`}
                  </span>
                )}
              </span>
              {status === 'inStock' && <span className="text-green-500 text-xs">✓</span>}
              {status === 'insufficient' && <span className="text-orange-500 text-xs">~</span>}
              {status === 'missing' && <span className="text-red-500 text-xs">✗</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
