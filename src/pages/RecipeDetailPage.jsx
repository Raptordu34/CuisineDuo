import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useMiamActions } from '../hooks/useMiamActions'
import { useMiam } from '../contexts/MiamContext'
import { getTranslatedRecipe } from '../lib/recipeTranslations'
import IngredientsList from '../components/recipes/IngredientsList'
import StepsList from '../components/recipes/StepsList'
import FloatingTimer from '../components/recipes/FloatingTimer'
import RatingSection from '../components/recipes/RatingSection'
import CommentsSection from '../components/recipes/CommentsSection'
import CookingHistory from '../components/recipes/CookingHistory'
import CookRecipeModal from '../components/recipes/CookRecipeModal'
import EditRecipeModal from '../components/recipes/EditRecipeModal'

const CATEGORY_COLORS = {
  appetizer: 'bg-amber-100 text-amber-700',
  main: 'bg-red-100 text-red-700',
  dessert: 'bg-pink-100 text-pink-700',
  snack: 'bg-purple-100 text-purple-700',
  drink: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
}

const DIFFICULTY_COLORS = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

export default function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const { registerContextProvider } = useMiam()

  const [recipe, setRecipe] = useState(null)
  const [ratings, setRatings] = useState([])
  const [comments, setComments] = useState([])
  const [history, setHistory] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [showCookModal, setShowCookModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [timer, setTimer] = useState(null) // { stepIndex, totalSeconds, remainingSeconds, paused }
  const [loading, setLoading] = useState(true)

  // Recette traduite selon la langue courante
  const tr = useMemo(() => recipe ? getTranslatedRecipe(recipe, lang) : null, [recipe, lang])

  // Miam actions
  useMiamActions({
    rateRecipe: {
      handler: async ({ rating }) => {
        if (!recipe) return
        await supabase.from('recipe_ratings').upsert({
          recipe_id: recipe.id,
          profile_id: profile.id,
          rating,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'recipe_id,profile_id' })
      },
      description: 'Rate this recipe',
    },
    addRecipeComment: {
      handler: async ({ content }) => {
        if (!recipe) return
        await supabase.from('recipe_comments').insert({
          recipe_id: recipe.id,
          profile_id: profile.id,
          content,
        })
      },
      description: 'Add comment to this recipe',
    },
    logCooking: {
      handler: () => setShowCookModal(true),
      description: 'Log cooking this recipe',
    },
  })

  // Provide recipe context to Miam
  useEffect(() => {
    if (!recipe) return
    return registerContextProvider('currentRecipe', () => ({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    }))
  }, [registerContextProvider, recipe])

  // Fetch recipe data
  const fetchRecipe = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
    if (data) setRecipe(data)
    setLoading(false)
  }, [id])

  const fetchRatings = useCallback(async () => {
    const { data } = await supabase
      .from('recipe_ratings')
      .select('*, profiles(display_name)')
      .eq('recipe_id', id)
    if (data) setRatings(data)
  }, [id])

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('recipe_comments')
      .select('*, profiles(display_name)')
      .eq('recipe_id', id)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }, [id])

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('cooking_history')
      .select('*, profiles(display_name)')
      .eq('recipe_id', id)
      .order('cooked_at', { ascending: false })
    if (data) setHistory(data)
  }, [id])

  useEffect(() => {
    fetchRecipe()
    fetchRatings()
    fetchComments()
    fetchHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Fetch inventory
  useEffect(() => {
    if (!profile?.household_id) return
    supabase
      .from('inventory_items')
      .select('name, quantity, unit')
      .eq('household_id', profile.household_id)
      .then(({ data }) => { if (data) setInventoryItems(data) })
  }, [profile?.household_id])

  // Realtime subscriptions
  useEffect(() => {
    const channels = [
      supabase.channel(`recipe_ratings:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_ratings', filter: `recipe_id=eq.${id}` }, () => fetchRatings())
        .subscribe(),
      supabase.channel(`recipe_comments:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_comments', filter: `recipe_id=eq.${id}` }, () => fetchComments())
        .subscribe(),
      supabase.channel(`cooking_history:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cooking_history', filter: `recipe_id=eq.${id}` }, () => fetchHistory())
        .subscribe(),
    ]
    return () => channels.forEach(c => supabase.removeChannel(c))
  }, [id, fetchRatings, fetchComments, fetchHistory])

  // Timer tick
  useEffect(() => {
    if (!timer || timer.paused || timer.remainingSeconds <= 0) return
    const interval = setInterval(() => {
      setTimer(prev => {
        if (!prev || prev.paused) return prev
        const next = prev.remainingSeconds - 1
        if (next <= 0) {
          // Play notification sound
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            osc.frequency.value = 880
            osc.connect(ctx.destination)
            osc.start()
            setTimeout(() => osc.stop(), 500)
          } catch { /* ignore */ }
          return { ...prev, remainingSeconds: 0 }
        }
        return { ...prev, remainingSeconds: next }
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.paused, !!timer])

  const handleStartTimer = (stepIndex, minutes) => {
    setTimer({ stepIndex, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, paused: false })
  }

  const handleRate = async (rating, comment) => {
    // Optimistic UI : mettre a jour l'affichage immediatement
    setRatings(prev => {
      const existing = prev.findIndex(r => r.profile_id === profile.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], rating }
        return updated
      }
      return [...prev, { id: crypto.randomUUID(), recipe_id: id, profile_id: profile.id, rating }]
    })

    await supabase.from('recipe_ratings').upsert({
      recipe_id: id,
      profile_id: profile.id,
      rating,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'recipe_id,profile_id' })

    // Sauvegarder le commentaire si fourni
    if (comment) {
      await supabase.from('recipe_comments').insert({
        recipe_id: id,
        profile_id: profile.id,
        content: comment,
      })
    }
  }

  const handleComment = async (content) => {
    await supabase.from('recipe_comments').insert({
      recipe_id: id,
      profile_id: profile.id,
      content,
    })
  }

  const handleEditComment = async (commentId, content) => {
    // Optimistic UI
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, content, edited_at: new Date().toISOString() } : c
    ))
    await supabase.from('recipe_comments').update({
      content,
      edited_at: new Date().toISOString(),
    }).eq('id', commentId)
  }

  const handleDeleteComment = async (commentId) => {
    // Optimistic UI
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('recipe_comments').delete().eq('id', commentId)
  }

  const handleCook = async ({ servingsCooked, notes, deductions }) => {
    // Log cooking
    await supabase.from('cooking_history').insert({
      recipe_id: id,
      household_id: profile.household_id,
      cooked_by: profile.id,
      servings_cooked: servingsCooked,
      notes,
    })

    // Deduct from inventory
    if (deductions?.length) {
      for (const ded of deductions) {
        if (ded.consume) {
          // Move to consumed_items and delete
          const item = inventoryItems.find(i => i.name.toLowerCase() === ded.name.toLowerCase())
          if (item) {
            const { data: fullItem } = await supabase
              .from('inventory_items')
              .select('*')
              .eq('household_id', profile.household_id)
              .ilike('name', ded.name)
              .limit(1)
              .single()
            if (fullItem) {
              await supabase.from('consumed_items').insert({
                household_id: fullItem.household_id,
                name: fullItem.name,
                brand: fullItem.brand,
                quantity: fullItem.quantity,
                unit: fullItem.unit,
                price: fullItem.price,
                category: fullItem.category,
                purchase_date: fullItem.purchase_date,
                store: fullItem.store,
                added_by: fullItem.added_by,
                consumed_by: profile.id,
              })
              await supabase.from('inventory_items').delete().eq('id', fullItem.id)
            }
          }
        }
      }
    }

    setShowCookModal(false)
  }

  const handleEditSave = async (recipeId, updates) => {
    await supabase.from('recipes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', recipeId)
    setShowEditModal(false)
    fetchRecipe()
  }

  const handleDeleteRecipe = async (recipeId) => {
    await supabase.from('recipes').delete().eq('id', recipeId)
    navigate('/recipes')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="text-center py-12 text-gray-400">
        {t('recipes.notFound')}
      </div>
    )
  }

  const avgRating = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null

  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <div className="fixed top-[74px] bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative">
          {recipe.image_url ? (
            <img src={recipe.image_url} alt={tr.name} className="w-full h-48 md:h-64 object-cover" />
          ) : (
            <div className={`w-full h-48 md:h-64 flex items-center justify-center ${CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.other}`}>
              <span className="text-6xl font-bold opacity-30">{tr.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <button
            onClick={() => navigate('/recipes')}
            className="absolute top-3 left-3 p-2 rounded-full bg-white/80 backdrop-blur text-gray-700 hover:bg-white transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-full bg-white/80 backdrop-blur text-gray-700 hover:bg-white transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
          </div>
        </div>

        {/* Title & info */}
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-xl font-bold text-gray-900">{tr.name}</h1>
          {tr.description && (
            <p className="text-sm text-gray-500 mt-1">{tr.description}</p>
          )}

          {/* Quick info */}
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.category && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[recipe.category] || CATEGORY_COLORS.other}`}>
                {t(`recipeCategory.${recipe.category}`)}
              </span>
            )}
            {recipe.difficulty && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[recipe.difficulty] || ''}`}>
                {t(`recipeDifficulty.${recipe.difficulty}`)}
              </span>
            )}
            {totalTime > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                ⏱ {totalTime} min
              </span>
            )}
            {recipe.servings && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                🍽 {recipe.servings} {t('recipes.servings')}
              </span>
            )}
            {avgRating && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">
                ★ {avgRating}
              </span>
            )}
          </div>

          {/* Time details */}
          {(recipe.prep_time || recipe.cook_time) && (
            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {recipe.prep_time > 0 && <span>{t('recipes.prepTime')}: {recipe.prep_time} min</span>}
              {recipe.cook_time > 0 && <span>{t('recipes.cookTime')}: {recipe.cook_time} min</span>}
            </div>
          )}
        </div>

        {/* Cook button */}
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowCookModal(true)}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            {t('recipes.cookedButton')}
          </button>
        </div>

        {/* Ingredients */}
        {tr.ingredients?.length > 0 && (
          <div className="px-4 pb-4">
            <IngredientsList
              ingredients={tr.ingredients}
              inventoryItems={inventoryItems}
              servings={recipe.servings}
            />
          </div>
        )}

        {/* Equipment */}
        {tr.equipment?.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.equipmentLabel')}</h2>
            <ul className="space-y-1">
              {tr.equipment.map((eq, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                  {typeof eq === 'string' ? eq : eq.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {tr.steps?.length > 0 && (
          <div className="px-4 pb-4">
            <StepsList
              steps={tr.steps}
              onStartTimer={handleStartTimer}
            />
          </div>
        )}

        {/* Tips */}
        {tr.tips?.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('recipes.tipsLabel')}</h2>
            <ul className="space-y-1">
              {tr.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-yellow-500 flex-shrink-0">💡</span>
                  {typeof tip === 'string' ? tip : tip.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ratings */}
        <div className="px-4 pb-4">
          <RatingSection
            ratings={ratings}
            comments={comments}
            currentUserId={profile?.id}
            onRate={handleRate}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
          />
        </div>

        {/* Comments */}
        <div className="px-4 pb-4">
          <CommentsSection
            comments={comments}
            currentUserId={profile?.id}
            onComment={handleComment}
            onEditComment={handleEditComment}
            onDeleteComment={handleDeleteComment}
          />
        </div>

        {/* Cooking History */}
        <div className="px-4 pb-8">
          <CookingHistory history={history} />
        </div>
      </div>

      {/* Floating timer */}
      {timer && timer.remainingSeconds >= 0 && (
        <FloatingTimer
          stepIndex={timer.stepIndex}
          remainingSeconds={timer.remainingSeconds}
          paused={timer.paused}
          onPause={() => setTimer(prev => prev ? { ...prev, paused: true } : null)}
          onResume={() => setTimer(prev => prev ? { ...prev, paused: false } : null)}
          onCancel={() => setTimer(null)}
        />
      )}

      {/* Cook modal */}
      {showCookModal && (
        <CookRecipeModal
          recipe={recipe}
          inventoryItems={inventoryItems}
          onClose={() => setShowCookModal(false)}
          onConfirm={handleCook}
        />
      )}

      {/* Edit modal */}
      {showEditModal && (
        <EditRecipeModal
          recipe={recipe}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditSave}
          onDelete={handleDeleteRecipe}
        />
      )}
    </div>
  )
}
