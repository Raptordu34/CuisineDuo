import { useLanguage } from '../../contexts/LanguageContext'

export default function StepsList({ steps, onStartTimer }) {
  const { t } = useLanguage()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.stepsLabel')}</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => {
          const instruction = typeof step === 'string' ? step : step.instruction
          const duration = typeof step === 'object' ? step.duration_minutes : null
          return (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{instruction}</p>
                {duration && (
                  <button
                    onClick={() => onStartTimer(i, duration)}
                    className="mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {duration} min — {t('recipes.startTimer')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
