import { useState, useCallback } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export function useRecipeAIEdit({ form, equipment, ingredients, steps, tips, setForm, setEquipment, setIngredients, setSteps, setTips }) {
  const { lang } = useLanguage()
  const [aiLoading, setAiLoading] = useState(false)
  const [pendingAiUpdates, setPendingAiUpdates] = useState(null)
  const [pendingSearch, setPendingSearch] = useState(null)

  const handleAICommand = useCallback(async (text, cmdLang) => {
    if (!text.trim()) return
    setAiLoading(true)

    const currentRecipe = {
      ...form,
      equipment: equipment.filter(e => e.name.trim()).map(e => ({ name: e.name.trim() })),
      ingredients: ingredients.filter(i => i.name.trim()).map((i, idx) => ({
        name: i.name.trim(),
        quantity: parseFloat(i.quantity) || null,
        unit: i.unit === 'none' ? null : i.unit,
        optional: i.optional,
        order: idx + 1,
      })),
      steps: steps.filter(s => s.instruction.trim()).map((s, idx) => ({
        order: idx + 1,
        instruction: s.instruction.trim(),
        duration: parseInt(s.duration) || null,
      })),
      tips: tips.filter(tip => tip.text.trim()).map(tip => ({ text: tip.text.trim() })),
    }

    try {
      const res = await fetch('/api/recipe-ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          lang: cmdLang || lang,
          recipe: currentRecipe,
        }),
      })

      if (res.ok) {
        const data = await res.json()

        if (data.search_needed) {
          setPendingSearch({
            text,
            lang: cmdLang || lang,
            recipe: currentRecipe,
            search_query: data.search_query,
            search_reason: data.search_reason,
          })
        } else if (data.updates && Object.keys(data.updates).length > 0) {
          setPendingAiUpdates({ updates: data.updates, summary: data.summary })
        }
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(false)
    }
  }, [form, equipment, ingredients, steps, tips, lang])

  const handleSearchConfirm = useCallback(async () => {
    if (!pendingSearch) return
    setAiLoading(true)
    setPendingSearch(null)

    try {
      const res = await fetch('/api/recipe-ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pendingSearch.text,
          context: 'recipe-edit-search',
          lang: pendingSearch.lang,
          recipe: pendingSearch.recipe,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.updates && Object.keys(data.updates).length > 0) {
          setPendingAiUpdates({ updates: data.updates, summary: data.summary })
        }
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(false)
    }
  }, [pendingSearch])

  const handleSearchCancel = useCallback(() => {
    setPendingSearch(null)
  }, [])

  const applyAIUpdates = useCallback(() => {
    if (!pendingAiUpdates) return
    const { updates } = pendingAiUpdates

    // Apply scalar fields
    const scalarFields = ['name', 'description', 'category', 'servings', 'prep_time', 'cook_time', 'difficulty']
    const formUpdates = {}
    for (const field of scalarFields) {
      if (updates[field] !== undefined) {
        formUpdates[field] = updates[field]
      }
    }
    if (Object.keys(formUpdates).length > 0) {
      setForm(prev => ({ ...prev, ...formUpdates }))
    }

    // Apply array fields
    if (updates.equipment) {
      setEquipment(updates.equipment.map(e => ({ name: e.name || '' })))
    }
    if (updates.ingredients) {
      setIngredients(updates.ingredients.map(i => ({
        name: i.name || '',
        quantity: i.quantity || '',
        unit: i.unit || 'none',
        optional: i.optional || false,
      })))
    }
    if (updates.steps) {
      setSteps(updates.steps.map(s => ({
        instruction: s.instruction || '',
        duration: s.duration || '',
      })))
    }
    if (updates.tips) {
      setTips(updates.tips.map(tip => ({ text: tip.text || '' })))
    }

    setPendingAiUpdates(null)
  }, [pendingAiUpdates, setForm, setEquipment, setIngredients, setSteps, setTips])

  const cancelAIUpdates = useCallback(() => {
    setPendingAiUpdates(null)
  }, [])

  return {
    aiLoading,
    pendingAiUpdates,
    pendingSearch,
    handleAICommand,
    handleSearchConfirm,
    handleSearchCancel,
    applyAIUpdates,
    cancelAIUpdates,
  }
}
