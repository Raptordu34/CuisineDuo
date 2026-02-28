import { useLanguage } from '../../contexts/LanguageContext'

export default function CookingHistory({ history }) {
  const { t } = useLanguage()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.cookingHistory')}</h2>

      {history.length === 0 ? (
        <p className="text-xs text-gray-400">{t('recipes.neverCooked')}</p>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-2">
            {t('recipes.cookedCount', { count: history.length })}
          </p>
          <div className="space-y-1.5">
            {history.slice(0, 5).map(h => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-700">{h.profiles?.display_name}</span>
                <span className="text-gray-400">—</span>
                <span className="text-gray-500">{new Date(h.cooked_at).toLocaleDateString()}</span>
                {h.servings_cooked && (
                  <span className="text-gray-400">({h.servings_cooked} {t('recipes.servings')})</span>
                )}
                {h.notes && (
                  <span className="text-gray-400 truncate max-w-[150px]">{h.notes}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
