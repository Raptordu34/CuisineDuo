import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useSwipeSession } from '../hooks/useSwipeSession'
import { supabase } from '../lib/supabase'
import MatchedRecipeCard from '../components/swipe/MatchedRecipeCard'

export default function SwipeResultsPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t, lang } = useLanguage()

  const { session, recipes, matches, members, votes, loading } = useSwipeSession(
    sessionId,
    profile?.id,
    profile?.household_id
  )

  const [selected, setSelected] = useState(new Set())
  const [creating, setCreating] = useState(false)
  const [showNonMatched, setShowNonMatched] = useState(false)

  // Initialize selection with all matches
  useMemo(() => {
    if (matches.length > 0 && selected.size === 0) {
      setSelected(new Set(matches.map(m => m.id)))
    }
  }, [matches])

  const nonMatched = recipes.filter(r => !matches.find(m => m.id === r.id))

  const toggleRecipe = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateRecipesAndList = async () => {
    if (creating || selected.size === 0) return
    setCreating(true)

    try {
      const selectedRecipes = recipes.filter(r => selected.has(r.id))
      const newRecipes = selectedRecipes.filter(r => !r.is_existing_recipe)
      const existingRecipes = selectedRecipes.filter(r => r.is_existing_recipe)

      // Create new recipes via AI
      if (newRecipes.length > 0) {
        const { data: tasteProfiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .eq('household_id', profile.household_id)

        await fetch('/api/create-matched-recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            matched_recipe_ids: newRecipes.map(r => r.id),
            household_id: profile.household_id,
            lang,
            taste_profiles: tasteProfiles?.map(p => ({
              displayName: p.display_name,
              tasteProfile: {},
            })),
          }),
        })
      }

      // Generate shopping list
      const { data: inventory } = await supabase
        .from('inventory_items')
        .select('name, quantity, unit')
        .eq('household_id', profile.household_id)

      // Gather recipe_ids (existing ones that already have IDs)
      const recipeIds = existingRecipes
        .filter(r => r.recipe_id)
        .map(r => r.recipe_id)

      // For new recipes, fetch their data from session_recipes
      const recipesDataForNew = newRecipes.map(r => ({
        name: r.name,
        servings: r.servings || 4,
        ingredients: r.ai_recipe_data?.ingredients || [],
      }))

      await fetch('/api/generate-shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_ids: recipeIds,
          recipes_data: recipesDataForNew,
          household_id: profile.household_id,
          list_name: session?.title || t('swipe.shoppingListName'),
          session_id: sessionId,
          lang,
          inventory_items: inventory || [],
          created_by: profile.id,
        }),
      })

      // Send notification
      try {
        await fetch('/api/push-notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            household_id: profile.household_id,
            sender_profile_id: profile.id,
            title: 'CuisineDuo',
            body: t('swipe.recipesCreatedNotif'),
          }),
        })
      } catch {
        // Not critical
      }

      navigate('/shopping')
    } catch (err) {
      console.error('Error creating recipes/list:', err)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-400">{t('swipe.notFound')}</p>
        <button onClick={() => navigate('/')} className="text-orange-500 text-sm font-medium cursor-pointer">
          {t('recipes.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">{t('swipe.results')}</h1>
        <p className="text-sm text-gray-500">
          {t('swipe.matchCount', { count: matches.length, total: recipes.length })}
        </p>
      </div>

      {/* Matches */}
      {matches.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-green-600 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
            {t('swipe.matchesTitle')} ({matches.length})
          </h2>
          <div className="space-y-2">
            {matches.map(recipe => (
              <MatchedRecipeCard
                key={recipe.id}
                recipe={recipe}
                selected={selected.has(recipe.id)}
                onToggle={() => toggleRecipe(recipe.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 space-y-2">
          <div className="text-4xl">😢</div>
          <p className="text-gray-500">{t('swipe.noMatches')}</p>
        </div>
      )}

      {/* Non-matched (collapsible) */}
      {nonMatched.length > 0 && (
        <div>
          <button
            onClick={() => setShowNonMatched(!showNonMatched)}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-4 h-4 transition-transform ${showNonMatched ? 'rotate-90' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {t('swipe.nonMatched')} ({nonMatched.length})
          </button>

          {showNonMatched && (
            <div className="mt-2 space-y-2 opacity-60">
              {nonMatched.map(recipe => (
                <MatchedRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  selected={selected.has(recipe.id)}
                  onToggle={() => toggleRecipe(recipe.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      {selected.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-8 md:left-auto md:right-auto md:w-full md:max-w-3xl md:mx-auto md:px-4 z-30">
          <button
            onClick={handleCreateRecipesAndList}
            disabled={creating}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
          >
            {creating
              ? t('swipe.creatingRecipes')
              : t('swipe.createRecipesAndList', { count: selected.size })
            }
          </button>
        </div>
      )}
    </div>
  )
}
