import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

function mergeTranslation(recipe, translatedData) {
  if (!recipe || !translatedData) return recipe

  const merged = { ...recipe }

  if (translatedData.name) merged.name = translatedData.name
  if (translatedData.description) merged.description = translatedData.description

  if (translatedData.ingredients && recipe.ingredients) {
    merged.ingredients = recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: translatedData.ingredients[i]?.name || ing.name,
    }))
  }

  if (translatedData.steps && recipe.steps) {
    merged.steps = recipe.steps.map((step, i) => ({
      ...step,
      instruction: translatedData.steps[i]?.instruction || step.instruction,
    }))
  }

  if (translatedData.tips && recipe.tips) {
    merged.tips = recipe.tips.map((tip, i) => ({
      ...tip,
      text: translatedData.tips[i]?.text || tip.text,
    }))
  }

  if (translatedData.equipment && recipe.equipment) {
    merged.equipment = recipe.equipment.map((eq, i) => ({
      ...eq,
      name: translatedData.equipment[i]?.name || eq.name,
    }))
  }

  return merged
}

export function useRecipeTranslation(recipe) {
  const { lang } = useLanguage()
  const [translatedRecipe, setTranslatedRecipe] = useState(recipe)
  const [isTranslating, setIsTranslating] = useState(false)
  const [isTranslated, setIsTranslated] = useState(false)

  // Whether the translate prompt should be shown
  const showPrompt = !!recipe && lang !== 'en' && !isTranslated && !isTranslating

  // Reset state when recipe or lang changes
  useEffect(() => {
    setTranslatedRecipe(recipe)
    setIsTranslated(false)
    setIsTranslating(false)
  }, [recipe?.id, recipe?.updated_at, lang])

  // Check cache silently on mount - if cached, apply directly without prompting
  useEffect(() => {
    if (!recipe?.id || lang === 'en') return

    let cancelled = false
    const checkCache = async () => {
      try {
        const { data } = await supabase
          .from('recipe_translations')
          .select('translated_data')
          .eq('recipe_id', recipe.id)
          .eq('lang', lang)
          .maybeSingle()

        if (!cancelled && data?.translated_data) {
          setTranslatedRecipe(mergeTranslation(recipe, data.translated_data))
          setIsTranslated(true)
        }
      } catch {
        // No cache, user will see the prompt
      }
    }
    checkCache()
    return () => { cancelled = true }
  }, [recipe?.id, recipe?.updated_at, lang])

  // Manual translate trigger
  const translate = useCallback(async () => {
    if (!recipe || lang === 'en' || isTranslating) return

    setIsTranslating(true)
    try {
      const body = recipe.id
        ? { action: 'translate', recipe_id: recipe.id, lang }
        : { action: 'translate', recipe_data: { name: recipe.name, description: recipe.description, ingredients: recipe.ingredients, steps: recipe.steps, tips: recipe.tips, equipment: recipe.equipment }, lang }

      const res = await fetch('/api/recipe-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const { translated_data } = await res.json()
        setTranslatedRecipe(mergeTranslation(recipe, translated_data))
        setIsTranslated(true)
      }
    } catch {
      // Translation failed, keep original
    } finally {
      setIsTranslating(false)
    }
  }, [recipe, lang, isTranslating])

  return { recipe: translatedRecipe, isTranslating, isTranslated, showPrompt, translate }
}
