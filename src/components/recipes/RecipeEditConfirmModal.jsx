import { useLanguage } from '../../contexts/LanguageContext'

const FIELD_LABELS = {
  name: 'recipes.name',
  description: 'recipes.description',
  category: 'recipes.category',
  servings: 'recipes.servings',
  prep_time: 'recipes.prepTime',
  cook_time: 'recipes.cookTime',
  difficulty: 'recipes.difficulty',
  equipment: 'recipes.equipment',
  ingredients: 'recipes.ingredients',
  steps: 'recipes.steps',
  tips: 'recipes.tips',
  _tasteParams: 'taste.title',
}

const TASTE_PARAM_KEYS = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']

export default function RecipeEditConfirmModal({ updates, summary, onConfirm, onCancel }) {
  const { t } = useLanguage()

  const scalarFields = ['name', 'description', 'category', 'servings', 'prep_time', 'cook_time', 'difficulty']
  const arrayFields = ['equipment', 'ingredients', 'steps', 'tips']

  const formatValue = (key, value) => {
    if (key === 'category') return t(`recipeCategory.${value}`) || value
    if (key === 'difficulty') return t(`difficulty.${value}`) || value
    if (value == null) return '-'
    return String(value)
  }

  const formatArrayItem = (key, item) => {
    if (key === 'equipment') return item.name
    if (key === 'ingredients') {
      let str = item.name
      if (item.quantity) str += ` (${item.quantity}${item.unit && item.unit !== 'none' ? ' ' + item.unit : ''})`
      if (item.optional) str += ` [opt.]`
      return str
    }
    if (key === 'steps') {
      let str = item.instruction
      if (item.duration) str += ` (${item.duration} min)`
      return str
    }
    if (key === 'tips') return item.text
    return JSON.stringify(item)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onCancel}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{t('recipes.confirmChanges')}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-sm text-gray-600 italic">{summary}</p>
          </div>
        )}

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Scalar fields */}
          {scalarFields.filter(key => updates[key] !== undefined).map(key => (
            <div key={key} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">{t(FIELD_LABELS[key])}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {t('inventory.edit')}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-1">{formatValue(key, updates[key])}</p>
            </div>
          ))}

          {/* Array fields */}
          {arrayFields.filter(key => updates[key] !== undefined).map(key => (
            <div key={key} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-gray-500">{t(FIELD_LABELS[key])}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  {updates[key].length} {t(FIELD_LABELS[key]).toLowerCase()}
                </span>
              </div>
              <div className="space-y-1">
                {updates[key].map((item, i) => (
                  <p key={i} className="text-xs text-gray-700">
                    {key === 'steps' && <span className="font-bold text-gray-400 mr-1">{i + 1}.</span>}
                    {formatArrayItem(key, item)}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* Taste params */}
          {updates._tasteParams && (
            <div className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-gray-500">{t('taste.title')}</span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {t('inventory.edit')}
                </span>
              </div>
              <div className="space-y-1">
                {TASTE_PARAM_KEYS.filter(k => updates._tasteParams[k] != null).map(k => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{t(`taste.${k}`)}</span>
                    <span className="font-medium text-gray-900">{updates._tasteParams[k]}/5</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {t('recipes.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('inventory.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
