import { useState, useRef, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useRecipeAIEdit } from '../../hooks/useRecipeAIEdit'
import DictationButton from '../DictationButton'
import RecipeEditConfirmModal from './RecipeEditConfirmModal'
import SearchConfirmDialog from '../inventory/SearchConfirmDialog'
import TasteParamSliders from './TasteParamSliders'

const RECIPE_CATEGORIES = [
  'appetizer', 'main', 'dessert', 'snack', 'drink',
  'soup', 'salad', 'side', 'breakfast', 'other',
]

const DIFFICULTIES = ['easy', 'medium', 'hard']

const RECIPE_UNITS = [
  'none', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup',
  'piece', 'pinch', 'bunch', 'slice', 'clove', 'can', 'pack',
]

function CollapsibleSection({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          {title}
          {count > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold">{count}</span>
          )}
        </h3>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="space-y-3 pb-1">{children}</div>}
    </section>
  )
}

export default function AddRecipeModal({ onClose, onAdd, initialData }) {
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || 'main',
    servings: initialData?.servings || 4,
    prep_time: initialData?.prep_time || '',
    cook_time: initialData?.cook_time || '',
    difficulty: initialData?.difficulty || 'medium',
  })
  const [equipment, setEquipment] = useState(
    (initialData?.equipment || []).map((e) => ({ name: e.name || '' }))
  )
  const [ingredients, setIngredients] = useState(
    (initialData?.ingredients || []).map((i) => ({
      name: i.name || '',
      quantity: i.quantity || '',
      unit: i.unit || 'none',
      optional: i.optional || false,
    }))
  )
  const [steps, setSteps] = useState(
    (initialData?.steps || []).map((s) => ({
      instruction: s.instruction || '',
      duration: s.duration || '',
    }))
  )
  const [tips, setTips] = useState(
    (initialData?.tips || []).map((tip) => ({ text: tip.text || '' }))
  )
  const [tasteParams, setTasteParams] = useState({
    sweetness: initialData?.taste_params?.sweetness || null,
    saltiness: initialData?.taste_params?.saltiness || null,
    spiciness: initialData?.taste_params?.spiciness || null,
    acidity: initialData?.taste_params?.acidity || null,
    bitterness: initialData?.taste_params?.bitterness || null,
    umami: initialData?.taste_params?.umami || null,
    richness: initialData?.taste_params?.richness || null,
  })
  const [imageUrl, setImageUrl] = useState('')
  const [searchingImage, setSearchingImage] = useState(false)
  const [imageSearchFailed, setImageSearchFailed] = useState(false)
  const fileInputRef2 = useRef(null)
  const cameraInputRef2 = useRef(null)

  // AI edit
  const [showAIInput, setShowAIInput] = useState(false)
  const [aiCommandText, setAiCommandText] = useState('')
  const aiInputRef = useRef(null)

  const {
    aiLoading, pendingAiUpdates, pendingSearch,
    handleAICommand, handleSearchConfirm, handleSearchCancel,
    applyAIUpdates, cancelAIUpdates,
  } = useRecipeAIEdit({ form, equipment, ingredients, steps, tips, setForm, setEquipment, setIngredients, setSteps, setTips })

  const handleAIDictation = useCallback(async (text, dictLang) => {
    await handleAICommand(text, dictLang)
  }, [handleAICommand])

  const handleAISubmit = useCallback(() => {
    if (!aiCommandText.trim()) return
    const text = aiCommandText.trim()
    setAiCommandText('')
    setShowAIInput(false)
    handleAICommand(text)
  }, [aiCommandText, handleAICommand])

  const toggleAIInput = useCallback(() => {
    setShowAIInput((prev) => {
      if (!prev) setTimeout(() => aiInputRef.current?.focus(), 50)
      return !prev
    })
  }, [])

  const aiBusy = aiLoading || !!pendingAiUpdates || !!pendingSearch

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    await onAdd({
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      servings: parseInt(form.servings) || null,
      prep_time: parseInt(form.prep_time) || null,
      cook_time: parseInt(form.cook_time) || null,
      difficulty: form.difficulty,
      equipment: equipment.filter((e) => e.name.trim()).map((e) => ({ name: e.name.trim() })),
      ingredients: ingredients.filter((i) => i.name.trim()).map((i, idx) => ({
        name: i.name.trim(),
        quantity: parseFloat(i.quantity) || null,
        unit: i.unit === 'none' ? null : i.unit,
        optional: i.optional,
        order: idx + 1,
      })),
      steps: steps.filter((s) => s.instruction.trim()).map((s, idx) => ({
        order: idx + 1,
        instruction: s.instruction.trim(),
        duration: parseInt(s.duration) || null,
      })),
      tips: tips.filter((tip) => tip.text.trim()).map((tip) => ({ text: tip.text.trim() })),
      image_url: imageUrl || null,
      image_source: imageUrl ? (imageUrl.startsWith('data:') ? 'user' : 'ai') : 'none',
      _tasteParams: tasteParams,
    })
    setSaving(false)
  }

  const handleSearchImage = async () => {
    if (!form.name.trim()) return
    setSearchingImage(true)
    setImageSearchFailed(false)
    try {
      const res = await fetch('/api/generate-recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeName: form.name,
          recipeDescription: form.description,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.found && data.image_url) {
          setImageUrl(data.image_url)
        } else {
          setImageSearchFailed(true)
        }
      } else {
        setImageSearchFailed(true)
      }
    } catch {
      setImageSearchFailed(true)
    } finally {
      setSearchingImage(false)
    }
  }

  const handleFileSelected = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageUrl(e.target.result)
      setImageSearchFailed(false)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 pb-16 md:pb-0" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10 space-y-2 shrink-0 sm:rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold text-gray-900">{t('recipes.addRecipe')}</h2>
              <DictationButton onResult={handleAIDictation} disabled={aiBusy} color="orange" popoverDirection="down" />
              <button
                type="button"
                onClick={toggleAIInput}
                disabled={aiBusy}
                className="p-1.5 text-gray-500 hover:text-orange-500 disabled:opacity-40 transition-colors cursor-pointer"
                title={t('recipes.aiEditHint')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </button>
              {aiLoading && (
                <span className="text-xs text-gray-400 animate-pulse shrink-0">{t('dictation.correcting')}</span>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">&times;</button>
          </div>

          {showAIInput && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAISubmit() }}
              className="flex gap-2 items-end"
            >
              <textarea
                ref={aiInputRef}
                value={aiCommandText}
                onChange={(e) => setAiCommandText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAISubmit()
                  }
                }}
                placeholder={t('recipes.aiEditHint')}
                rows={1}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                style={{ maxHeight: '80px' }}
              />
              <button
                type="submit"
                disabled={!aiCommandText.trim() || aiBusy}
                className="shrink-0 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {t('chat.send')}
              </button>
            </form>
          )}

          {pendingSearch && (
            <SearchConfirmDialog
              searchQuery={pendingSearch.search_query}
              searchReason={pendingSearch.search_reason}
              onConfirm={handleSearchConfirm}
              onCancel={handleSearchCancel}
            />
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* Basic info */}
          <CollapsibleSection title={t('recipes.basicInfo')} count={0} defaultOpen={true}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.name')} *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.category')}</label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                >
                  {RECIPE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`recipeCategory.${c}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.difficulty')}</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => update('difficulty', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{t(`difficulty.${d}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.servings')}</label>
                <input
                  type="number"
                  min="1"
                  value={form.servings}
                  onChange={(e) => update('servings', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Timing */}
          <CollapsibleSection title={t('recipes.timing')} count={0} defaultOpen={!!(form.prep_time || form.cook_time)}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.prepTime')}</label>
                <input
                  type="number"
                  min="0"
                  value={form.prep_time}
                  onChange={(e) => update('prep_time', e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipes.cookTime')}</label>
                <input
                  type="number"
                  min="0"
                  value={form.cook_time}
                  onChange={(e) => update('cook_time', e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Equipment */}
          <CollapsibleSection title={t('recipes.equipment')} count={equipment.filter(e => e.name.trim()).length} defaultOpen={equipment.length > 0}>
            {equipment.map((eq, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={eq.name}
                  onChange={(e) => {
                    const next = [...equipment]
                    next[i] = { ...next[i], name: e.target.value }
                    setEquipment(next)
                  }}
                  placeholder={t('recipes.equipmentName')}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 cursor-pointer text-lg"
                >&times;</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEquipment([...equipment, { name: '' }])}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
            >{t('recipes.addEquipment')}</button>
          </CollapsibleSection>

          {/* Ingredients */}
          <CollapsibleSection title={t('recipes.ingredients')} count={ingredients.filter(i => i.name.trim()).length} defaultOpen={ingredients.length > 0}>
            {ingredients.map((ing, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2.5 space-y-1.5">
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => {
                    const next = [...ingredients]
                    next[i] = { ...next[i], name: e.target.value }
                    setIngredients(next)
                  }}
                  placeholder={t('recipes.ingredientName')}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                />
                <div className="flex gap-1.5 items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={ing.quantity}
                    onChange={(e) => {
                      const next = [...ingredients]
                      next[i] = { ...next[i], quantity: e.target.value }
                      setIngredients(next)
                    }}
                    placeholder={t('recipes.ingredientQty')}
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => {
                      const next = [...ingredients]
                      next[i] = { ...next[i], unit: e.target.value }
                      setIngredients(next)
                    }}
                    className="w-20 border border-gray-300 rounded-lg px-1 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent bg-white"
                  >
                    {RECIPE_UNITS.map((u) => (
                      <option key={u} value={u}>{t(`recipeUnit.${u}`) || '-'}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ing.optional}
                      onChange={(e) => {
                        const next = [...ingredients]
                        next[i] = { ...next[i], optional: e.target.checked }
                        setIngredients(next)
                      }}
                      className="rounded"
                    />
                    {t('recipes.optional')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 cursor-pointer text-lg shrink-0 ml-auto"
                  >&times;</button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setIngredients([...ingredients, { name: '', quantity: '', unit: 'none', optional: false }])}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
            >{t('recipes.addIngredient')}</button>
          </CollapsibleSection>

          {/* Steps */}
          <CollapsibleSection title={t('recipes.steps')} count={steps.filter(s => s.instruction.trim()).length} defaultOpen={steps.length > 0}>
            {steps.map((step, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex gap-2 items-start">
                  <span className="text-xs text-gray-400 mt-2.5 font-bold shrink-0">{i + 1}.</span>
                  <textarea
                    value={step.instruction}
                    onChange={(e) => {
                      const next = [...steps]
                      next[i] = { ...next[i], instruction: e.target.value }
                      setSteps(next)
                    }}
                    placeholder={t('recipes.stepInstruction')}
                    rows={3}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 cursor-pointer text-lg mt-1"
                  >&times;</button>
                </div>
                <div className="ml-6 flex items-center gap-2">
                  <label className="text-xs text-gray-400">{t('recipes.stepDuration')}</label>
                  <input
                    type="number"
                    min="0"
                    value={step.duration}
                    onChange={(e) => {
                      const next = [...steps]
                      next[i] = { ...next[i], duration: e.target.value }
                      setSteps(next)
                    }}
                    placeholder="0"
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSteps([...steps, { instruction: '', duration: '' }])}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
            >{t('recipes.addStep')}</button>
          </CollapsibleSection>

          {/* Tips */}
          <CollapsibleSection title={t('recipes.tips')} count={tips.filter(tip => tip.text.trim()).length} defaultOpen={tips.length > 0}>
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={tip.text}
                  onChange={(e) => {
                    const next = [...tips]
                    next[i] = { ...next[i], text: e.target.value }
                    setTips(next)
                  }}
                  placeholder={t('recipes.tipText')}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setTips(tips.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 cursor-pointer text-lg"
                >&times;</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTips([...tips, { text: '' }])}
              className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
            >{t('recipes.addTip')}</button>
          </CollapsibleSection>

          {/* Taste params */}
          <CollapsibleSection title={t('recipes.tasteParams')} count={Object.values(tasteParams).filter(v => v != null).length} defaultOpen={Object.values(tasteParams).some(v => v != null)}>
            <TasteParamSliders values={tasteParams} onChange={setTasteParams} />
          </CollapsibleSection>

          {/* Image */}
          <CollapsibleSection title={t('recipes.image')} count={imageUrl ? 1 : 0} defaultOpen={!!imageUrl}>
            {imageUrl && (
              <div className="relative">
                <img src={imageUrl} alt="" className="w-full h-40 object-cover rounded-lg" onError={(e) => { e.target.style.display = 'none' }} />
                <button
                  type="button"
                  onClick={() => { setImageUrl(''); setImageSearchFailed(false) }}
                  className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-sm flex items-center justify-center cursor-pointer"
                >&times;</button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSearchImage}
                disabled={!form.name.trim() || searchingImage}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {searchingImage ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t('recipes.searchingImage')}
                  </span>
                ) : t('recipes.searchImage')}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef2.current?.click()}
                disabled={searchingImage}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {t('recipes.chooseFile')}
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef2.current?.click()}
                disabled={searchingImage}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {t('recipes.takePhoto')}
              </button>
            </div>

            {imageSearchFailed && !imageUrl && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                {t('recipes.noImageFound')} — {t('recipes.addPhotoManually')}
              </p>
            )}

            <input
              ref={fileInputRef2}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelected(e.target.files[0])
                e.target.value = ''
              }}
            />
            <input
              ref={cameraInputRef2}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelected(e.target.files[0])
                e.target.value = ''
              }}
            />
          </CollapsibleSection>
        </form>

        {/* Sticky action buttons */}
        <div className="shrink-0 p-4 border-t border-gray-200 bg-white sm:rounded-b-2xl">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('recipes.cancel')}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}
              disabled={!form.name.trim() || saving}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('recipes.save')}
            </button>
          </div>
        </div>
      </div>

      {/* AI edit confirm modal */}
      {pendingAiUpdates && (
        <RecipeEditConfirmModal
          updates={pendingAiUpdates.updates}
          summary={pendingAiUpdates.summary}
          onConfirm={applyAIUpdates}
          onCancel={cancelAIUpdates}
        />
      )}
    </div>
  )
}
