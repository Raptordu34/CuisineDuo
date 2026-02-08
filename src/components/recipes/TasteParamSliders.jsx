import { useLanguage } from '../../contexts/LanguageContext'

const TASTE_PARAMS = [
  { key: 'sweetness', label: 'taste.sweetness' },
  { key: 'saltiness', label: 'taste.saltiness' },
  { key: 'spiciness', label: 'taste.spiciness' },
  { key: 'acidity', label: 'taste.acidity' },
  { key: 'bitterness', label: 'taste.bitterness' },
  { key: 'umami', label: 'taste.umami' },
  { key: 'richness', label: 'taste.richness' },
]

export { TASTE_PARAMS }

export default function TasteParamSliders({ values, onChange }) {
  const { t } = useLanguage()

  const handleClick = (key, value) => {
    const current = values[key]
    // Click same value to clear it
    onChange({ ...values, [key]: current === value ? null : value })
  }

  return (
    <div className="space-y-2.5">
      {TASTE_PARAMS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-20 shrink-0 text-right">{t(label)}</span>
          <div className="flex gap-1.5 flex-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => handleClick(key, v)}
                className={`w-7 h-7 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  values[key] === v
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 hover:bg-orange-100 hover:text-orange-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
