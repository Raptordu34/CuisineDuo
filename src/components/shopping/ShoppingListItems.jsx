import { useLanguage } from '../../contexts/LanguageContext'

const CATEGORY_ORDER = [
  'fruits', 'vegetables', 'meat', 'fish', 'dairy', 'bakery',
  'grains', 'condiments', 'frozen', 'beverages', 'snacks', 'hygiene', 'household', 'other',
]

export default function ShoppingListItems({ items, onToggle, onRemove, profileId }) {
  const { t } = useLanguage()

  if (items.length === 0) {
    return (
      <p className="text-center text-gray-400 py-8">{t('shopping.empty')}</p>
    )
  }

  // Group by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  // Sort categories
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  // Split into unchecked and checked
  const uncheckedCategories = sortedCategories.filter((cat) =>
    grouped[cat].some((item) => !item.checked)
  )
  const checkedItems = items.filter((item) => item.checked)

  return (
    <div className="space-y-4">
      {uncheckedCategories.map((cat) => {
        const unchecked = grouped[cat].filter((item) => !item.checked)
        if (unchecked.length === 0) return null

        return (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {t(`category.${cat}`)}
            </h3>
            <div className="space-y-1">
              {unchecked.map((item) => (
                <ShoppingItem
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item.id, profileId)}
                  onRemove={() => onRemove(item.id)}
                  t={t}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Checked items at bottom */}
      {checkedItems.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            {t('shopping.checked')} ({checkedItems.length})
          </h3>
          <div className="space-y-1">
            {checkedItems.map((item) => (
              <ShoppingItem
                key={item.id}
                item={item}
                onToggle={() => onToggle(item.id, profileId)}
                onRemove={() => onRemove(item.id)}
                t={t}
                checked
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingItem({ item, onToggle, onRemove, t, checked }) {
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${checked ? 'opacity-50' : 'hover:bg-gray-50'}`}>
      <button onClick={onToggle} className="shrink-0 cursor-pointer">
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          checked ? 'bg-green-500 border-green-500' : 'border-gray-300'
        }`}>
          {checked && (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3 h-3">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </div>
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.name}
        </span>
        {(item.quantity || item.unit) && (
          <span className="text-xs text-gray-400 ml-1">
            {item.quantity}{item.unit ? ` ${item.unit}` : ''}
          </span>
        )}
        {item.recipe_name && (
          <span className="text-xs text-orange-400 ml-1.5">({item.recipe_name})</span>
        )}
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 text-gray-300 hover:text-red-400 cursor-pointer p-1"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
