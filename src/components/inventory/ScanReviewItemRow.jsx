import { useLanguage } from '../../contexts/LanguageContext'

const CATEGORIES = [
  'dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains',
  'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other',
]

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack']

export default function ScanReviewItemRow({ item, index, checked, onToggle, onChange }) {
  const { t } = useLanguage()

  const update = (field, value) => {
    onChange(index, { ...item, [field]: value })
  }

  return (
    <div className={`p-3 rounded-lg border transition-colors ${checked ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(index)}
          className="mt-1 shrink-0 accent-orange-500 cursor-pointer"
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={item.brand || ''}
              onChange={(e) => update('brand', e.target.value)}
              placeholder={t('inventory.brandPlaceholder')}
              className="w-1/3 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <input
              type="text"
              value={item.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-2/3 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={item.quantity}
              onChange={(e) => update('quantity', parseFloat(e.target.value) || 1)}
              className="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <select
              value={item.unit}
              onChange={(e) => update('unit', e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{t(`unit.${u}`)}</option>
              ))}
            </select>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.price ?? ''}
                onChange={(e) => update('price', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder={t('inventory.price')}
                className={`w-20 border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 ${
                  item.price_estimated ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                }`}
              />
              {item.price_estimated && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center" title={t('inventory.priceEstimated')}>
                  ~
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={item.price_per_kg ?? ''}
              onChange={(e) => update('price_per_kg', e.target.value ? parseFloat(e.target.value) : null)}
              placeholder={t('inventory.pricePerKg')}
              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            />
            <select
              value={item.category}
              onChange={(e) => update('category', e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </select>
          </div>
        </div>
        {item.quantity > 1 && (
          <p className="text-xs text-orange-500 mt-1">
            {t('inventory.willSplit', { count: Math.floor(item.quantity) })}
          </p>
        )}
      </div>
    </div>
  )
}
