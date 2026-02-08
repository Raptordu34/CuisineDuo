import { useLanguage } from '../../contexts/LanguageContext'
import { TASTE_PARAMS } from './TasteParamSliders'

export default function TasteProfileDisplay({ profile, mode = 'recipe' }) {
  const { t } = useLanguage()

  const color = mode === 'recipe' ? 'bg-orange-400' : 'bg-indigo-400'
  const bgColor = mode === 'recipe' ? 'bg-orange-100' : 'bg-indigo-100'

  const hasValues = TASTE_PARAMS.some(({ key }) => profile?.[key] != null)
  if (!hasValues) return null

  return (
    <div className="space-y-1.5">
      {TASTE_PARAMS.map(({ key, label }) => {
        const value = profile?.[key]
        if (value == null) return null
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 shrink-0 text-right">{t(label)}</span>
            <div className={`flex-1 h-2 ${bgColor} rounded-full overflow-hidden`}>
              <div
                className={`h-full ${color} rounded-full transition-all`}
                style={{ width: `${(value / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-4 text-center">{Math.round(value * 10) / 10}</span>
          </div>
        )
      })}
    </div>
  )
}
