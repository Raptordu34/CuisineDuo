import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import EditRecipeModal from '../components/recipes/EditRecipeModal'
import RecipeImagePicker from '../components/recipes/RecipeImagePicker'
import RecipeComments from '../components/recipes/RecipeComments'
import RecipeChat from '../components/recipes/RecipeChat'
import RecipeRating from '../components/recipes/RecipeRating'
import StarRatingInline from '../components/recipes/StarRatingInline'
import TasteProfileDisplay from '../components/recipes/TasteProfileDisplay'
import { useTasteProfile } from '../hooks/useTasteProfile'
import { useShoppingList } from '../hooks/useShoppingList'
import { useRecipeTranslation } from '../hooks/useRecipeTranslation'
import { useInventoryMatch } from '../hooks/useInventoryMatch'
import IngredientAvailability from '../components/recipes/IngredientAvailability'
import RemoveIngredientsModal from '../components/recipes/RemoveIngredientsModal'

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [checkedIngredients, setCheckedIngredients] = useState(new Set())
  const [tasteParams, setTasteParams] = useState(null)
  const [addingToList, setAddingToList] = useState(false)
  const { householdTasteProfiles } = useTasteProfile(profile?.id, profile?.household_id)
  const { lists, activeList, createList, addItem } = useShoppingList(profile?.household_id)
  const { recipe: displayRecipe, isTranslating, showPrompt, translate } = useRecipeTranslation(recipe)
  const [showRemoveIngredients, setShowRemoveIngredients] = useState(false)

  const sortedIngredientsForMatch = [...(displayRecipe?.ingredients || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  const { matches: ingredientMatches, inventoryItems, loading: inventoryLoading } = useInventoryMatch(sortedIngredientsForMatch, profile?.household_id)

  const fetchRecipe = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setRecipe(data)
    // Fetch taste params
    const { data: tp } = await supabase
      .from('recipe_taste_params')
      .select('*')
      .eq('recipe_id', id)
      .maybeSingle()
    setTasteParams(tp || null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchRecipe()
  }, [fetchRecipe])

  const handleSave = async (recipeId, updates) => {
    const { _tasteParams, ...rest } = updates
    await supabase.from('recipes').update(rest).eq('id', recipeId)
    // Upsert taste params
    if (_tasteParams) {
      if (Object.values(_tasteParams).some(v => v != null)) {
        await supabase.from('recipe_taste_params').upsert({
          recipe_id: recipeId,
          ..._tasteParams,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recipe_id' })
      } else {
        await supabase.from('recipe_taste_params').delete().eq('recipe_id', recipeId)
      }
    }
    // Invalidate translation cache
    await supabase.from('recipe_translations').delete().eq('recipe_id', recipeId)
    setShowEdit(false)
    fetchRecipe()
  }

  const handleDelete = async (recipeId) => {
    await supabase.from('recipes').delete().eq('id', recipeId)
    navigate('/recipes')
  }

  const handleChatRecipeUpdate = async (updates) => {
    const { _tasteParams, ...rest } = updates
    if (Object.keys(rest).length > 0) {
      await supabase.from('recipes').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id)
    }
    if (_tasteParams) {
      if (Object.values(_tasteParams).some(v => v != null)) {
        await supabase.from('recipe_taste_params').upsert({
          recipe_id: id,
          ..._tasteParams,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recipe_id' })
      } else {
        await supabase.from('recipe_taste_params').delete().eq('recipe_id', id)
      }
    }
    // Invalidate translation cache
    await supabase.from('recipe_translations').delete().eq('recipe_id', id)
    fetchRecipe()
  }

  const handleImageChange = (url, source) => {
    setRecipe((prev) => prev ? { ...prev, image_url: url, image_source: source } : prev)
  }

  const toggleIngredient = (idx) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleRemoveIngredients = async (actions) => {
    for (const action of actions) {
      if (action.type === 'consume') {
        const item = action.item
        await supabase.from('consumed_items').insert({
          household_id: item.household_id,
          name: item.name,
          brand: item.brand || null,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          price_per_kg: item.price_per_kg ?? null,
          price_estimated: item.price_estimated === true,
          category: item.category,
          purchase_date: item.purchase_date,
          store: item.store,
          notes: item.notes,
          added_by: item.added_by,
          consumed_by: profile.id,
          fill_level: item.fill_level ?? 1,
        })
        await supabase.from('inventory_items').delete().eq('id', item.id)
      } else if (action.type === 'reduce') {
        const newQty = action.remainingInUnit
        await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', action.itemId)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-400">Recipe not found</p>
        <button
          onClick={() => navigate('/recipes')}
          className="text-orange-500 hover:text-orange-600 text-sm font-medium cursor-pointer"
        >{t('recipes.back')}</button>
      </div>
    )
  }

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const sortedIngredients = [...(displayRecipe.ingredients || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  const sortedSteps = [...(displayRecipe.steps || [])].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-3xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <div className="flex-1 overflow-y-auto">
        {/* Hero image */}
        <div className="relative aspect-[16/9] bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={displayRecipe.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">
              🍽️
            </div>
          )}

          {/* Back button */}
          <button
            onClick={() => navigate('/recipes')}
            className="absolute top-3 left-3 w-8 h-8 bg-black/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Edit button */}
          <button
            onClick={() => setShowEdit(true)}
            className="absolute top-3 right-3 w-8 h-8 bg-black/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </button>

          {/* Image change button */}
          <button
            onClick={() => setShowImagePicker(!showImagePicker)}
            className="absolute bottom-3 right-3 w-8 h-8 bg-black/30 backdrop-blur-sm text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-black/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </button>
        </div>

        {/* Image picker */}
        {showImagePicker && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <RecipeImagePicker
              recipeId={recipe.id}
              recipeName={recipe.name}
              recipeDescription={recipe.description}
              currentUrl={recipe.image_url}
              onImageChange={handleImageChange}
            />
          </div>
        )}

        {/* Translate banner */}
        {(showPrompt || isTranslating) && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-3">
            <p className="text-xs text-blue-700">{t('recipes.translatePrompt')}</p>
            <button
              onClick={translate}
              disabled={isTranslating}
              className="shrink-0 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTranslating ? t('recipes.translating') : t('recipes.translateButton')}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-4 py-4 space-y-6">
          {/* Title & metadata */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">{displayRecipe.name}</h1>
            {displayRecipe.description && (
              <p className="text-sm text-gray-500 mt-1">{displayRecipe.description}</p>
            )}

            {/* Metadata bar */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {recipe.category && (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-xs font-medium">
                  {t(`recipeCategory.${recipe.category}`)}
                </span>
              )}
              {recipe.difficulty && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || ''}`}>
                  {t(`difficulty.${recipe.difficulty}`)}
                </span>
              )}
              {recipe.servings && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  {recipe.servings}
                </span>
              )}
            </div>

            {/* Start cooking button */}
            {sortedSteps.length > 0 && (
              <button
                onClick={() => navigate(`/recipes/${recipe.id}/cook`)}
                className="w-full mt-3 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
                </svg>
                {t('recipes.startCooking')}
              </button>
            )}

            {/* Add to shopping list */}
            {sortedIngredients.length > 0 && (
              <button
                onClick={async () => {
                  if (addingToList) return
                  setAddingToList(true)
                  try {
                    let listToUse = activeList
                    if (!listToUse) {
                      listToUse = await createList(t('shopping.defaultListName'), profile.id)
                    }
                    if (listToUse) {
                      for (const ing of sortedIngredients) {
                        await addItem({
                          name: ing.name,
                          quantity: ing.quantity || null,
                          unit: ing.unit && ing.unit !== 'none' ? ing.unit : null,
                          category: 'other',
                          notes: recipe.name,
                        })
                      }
                    }
                  } finally {
                    setAddingToList(false)
                  }
                }}
                disabled={addingToList}
                className="w-full mt-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                {addingToList ? t('common.loading') : t('recipes.addToShoppingList')}
              </button>
            )}

            {/* Remove from inventory */}
            {sortedIngredients.length > 0 && ingredientMatches.some(m => m.status !== 'missing') && (
              <button
                onClick={() => setShowRemoveIngredients(true)}
                className="w-full mt-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
                {t('recipes.removeFromInventory')}
              </button>
            )}

            {/* Time info */}
            {totalTime > 0 && (
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {recipe.prep_time > 0 && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {t('recipes.prepTime')}: {recipe.prep_time} {t('recipes.min')}
                  </span>
                )}
                {recipe.cook_time > 0 && (
                  <span className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                    </svg>
                    {t('recipes.cookTime')}: {recipe.cook_time} {t('recipes.min')}
                  </span>
                )}
                {recipe.prep_time > 0 && recipe.cook_time > 0 && (
                  <span className="font-medium text-gray-700">
                    {t('recipes.totalTime')}: {totalTime} {t('recipes.min')}
                  </span>
                )}
              </div>
            )}

            {/* Rating - prominent placement */}
            <div className="mt-3">
              <RecipeRating recipeId={recipe.id} profileId={profile?.id} />
            </div>
          </div>

          {/* Equipment */}
          {displayRecipe.equipment?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.equipment')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {displayRecipe.equipment.map((eq, i) => (
                  <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                    {eq.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Ingredients */}
          {sortedIngredients.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-700">{t('recipes.ingredients')}</h2>
                {!inventoryLoading && ingredientMatches.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {t('recipes.ingredientsInStock', {
                      available: ingredientMatches.filter(m => m.status === 'available').length,
                      total: ingredientMatches.length,
                    })}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {sortedIngredients.map((ing, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-2 cursor-pointer ${checkedIngredients.has(i) ? 'opacity-40' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIngredients.has(i)}
                      onChange={() => toggleIngredient(i)}
                      className="rounded text-orange-500 focus:ring-orange-400"
                    />
                    <span className={`text-sm flex items-center ${checkedIngredients.has(i) ? 'line-through' : ''}`}>
                      <span className="font-medium">{ing.name}</span>
                      {ing.quantity && (
                        <span className="text-gray-500">
                          {' '}{ing.quantity}{ing.unit ? ` ${t(`recipeUnit.${ing.unit}`)}` : ''}
                        </span>
                      )}
                      {ing.optional && (
                        <span className="text-gray-400 text-xs ml-1">({t('recipes.optional')})</span>
                      )}
                      <IngredientAvailability match={ingredientMatches[i]} />
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Steps */}
          {sortedSteps.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.steps')}</h2>
              <div className="space-y-3">
                {sortedSteps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {step.order || i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{step.instruction}</p>
                      {step.duration && (
                        <span className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                          {step.duration} {t('recipes.min')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tips */}
          {displayRecipe.tips?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.tips')}</h2>
              <div className="space-y-2">
                {displayRecipe.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2 items-start bg-amber-50 rounded-lg px-3 py-2">
                    <span className="text-amber-500 shrink-0 mt-0.5">💡</span>
                    <p className="text-sm text-gray-700">{tip.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Taste profile */}
          {tasteParams && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.tasteProfile')}</h2>
              <TasteProfileDisplay profile={tasteParams} mode="recipe" />
            </section>
          )}

          {/* Comments */}
          <section className="border-t border-gray-200 pt-4">
            <RecipeComments recipeId={recipe.id} />
          </section>
        </div>
      </div>

      {/* Floating chat button */}
      <button
        onClick={() => setShowChat(true)}
        className="fixed bottom-20 right-4 md:bottom-8 w-12 h-12 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-colors z-30"
      >
        <span className="text-xl">🤖</span>
      </button>

      {/* Chat panel */}
      {showChat && (
        <RecipeChat recipe={recipe} onClose={() => setShowChat(false)} onRecipeUpdate={handleChatRecipeUpdate} householdTasteProfiles={householdTasteProfiles} tasteParams={tasteParams} />
      )}

      {/* Edit modal */}
      {showEdit && (
        <EditRecipeModal
          recipe={recipe}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          tasteParams={tasteParams}
        />
      )}

      {/* Remove ingredients modal */}
      {showRemoveIngredients && (
        <RemoveIngredientsModal
          recipe={recipe}
          ingredients={sortedIngredients}
          matches={ingredientMatches}
          inventoryItems={inventoryItems}
          onClose={() => setShowRemoveIngredients(false)}
          onConfirm={handleRemoveIngredients}
        />
      )}
    </div>
  )
}
