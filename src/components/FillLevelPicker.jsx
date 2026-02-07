import { useLanguage } from '../contexts/LanguageContext'

const LEVELS = [0.25, 0.5, 0.75, 1]

const LEVEL_LABELS = {
  1: 'fillLevel.full',
  0.75: 'fillLevel.threeQuarter',
  0.5: 'fillLevel.half',
  0.25: 'fillLevel.quarter',
}

function getColor(level) {
  if (level >= 0.75) return 'bg-green-500'
  if (level >= 0.5) return 'bg-amber-400'
  return 'bg-red-500'
}

export default function FillLevelPicker({ value, onChange, size = 'md' }) {
  const { t } = useLanguage()
  const sizeClasses = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8'
  const gapClass = size === 'sm' ? 'gap-1' : 'gap-1.5'

  return (
    <div className={`flex items-center ${gapClass}`}>
      {LEVELS.map((level) => {
        const isFilled = value >= level
        const isActive = value === level
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            title={t(LEVEL_LABELS[level])}
            className={`${sizeClasses} rounded cursor-pointer transition-all ${
              isFilled ? getColor(value) : 'bg-gray-200'
            } ${
              isActive ? 'ring-2 ring-orange-500 ring-offset-1' : ''
            }`}
          />
        )
      })}
    </div>
  )
}

export function FillLevelIndicator({ value, size = 'sm' }) {
  const sizeClasses = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  return (
    <div className="flex items-center gap-0.5">
      {LEVELS.map((level) => {
        const isFilled = value >= level
        return (
          <div
            key={level}
            className={`${sizeClasses} rounded-sm ${
              isFilled ? getColor(value) : 'bg-gray-200'
            }`}
          />
        )
      })}
    </div>
  )
}
