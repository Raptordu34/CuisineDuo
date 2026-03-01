import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import { apiPost } from '../../lib/apiClient'

const CATEGORIES = ['appetizer', 'main', 'dessert', 'snack', 'drink', 'other']
const DIFFICULTIES = ['easy', 'medium', 'hard']
const UNITS = ['piece', 'g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup']

export default function EditRecipeModal({ recipe, isOffline, onClose, onSave, onDelete }) {
  const { t } = useLanguage()
  const [name, setName] = useState(recipe.name || '')
  const [description, setDescription] = useState(recipe.description || '')
  const [category, setCategory] = useState(recipe.category || 'main')
  const [difficulty, setDifficulty] = useState(recipe.difficulty || 'medium')
  const [prepTime, setPrepTime] = useState(recipe.prep_time?.toString() || '')
  const [cookTime, setCookTime] = useState(recipe.cook_time?.toString() || '')
  const [servings, setServings] = useState(recipe.servings?.toString() || '')
  const [ingredients, setIngredients] = useState(
    recipe.ingredients?.length ? recipe.ingredients.map(i => ({
      name: i.name || '',
      quantity: i.quantity?.toString() || '',
      unit: i.unit || 'piece',
    })) : [{ name: '', quantity: '', unit: 'piece' }]
  )
  const [equipment, setEquipment] = useState(
    recipe.equipment?.length ? recipe.equipment.map(e => typeof e === 'string' ? e : e.name || '') : ['']
  )
  const [steps, setSteps] = useState(
    recipe.steps?.length ? recipe.steps.map(s => ({
      instruction: s.instruction || (typeof s === 'string' ? s : ''),
      duration_minutes: s.duration_minutes?.toString() || '',
    })) : [{ instruction: '', duration_minutes: '' }]
  )
  const [tips, setTips] = useState(
    recipe.tips?.length ? recipe.tips.map(tp => typeof tp === 'string' ? tp : tp.text || '') : ['']
  )
  const [imageUrl, setImageUrl] = useState(recipe.image_url || null)
  const [imageSource, setImageSource] = useState(recipe.image_source || 'none')
  const [uploading, setUploading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imagePrompt, setImagePrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('recipe-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
        setImageUrl(data.publicUrl)
        setImageSource('upload')
      }
    } catch { /* ignore */ }
    finally { setUploading(false) }
  }

  const handleGenerateImage = async () => {
    if (generatingImage || !name) return
    setGeneratingImage(true)
    try {
      const res = await apiPost('/api/generate-recipe-image', {
        name,
        description,
        ingredients: ingredients.filter(i => i.name).map(i => i.name),
        ...(imagePrompt.trim() ? { styleHint: imagePrompt.trim() } : {}),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.imageUrl) {
          setImageUrl(data.imageUrl)
          setImageSource('ai')
        }
      }
    } catch { /* ignore */ }
    finally { setGeneratingImage(false) }
  }

  const addIngredient = () => setIngredients([...ingredients, { name: '', quantity: '', unit: 'piece' }])
  const removeIngredient = (i) => setIngredients(ingredients.filter((_, idx) => idx !== i))
  const updateIngredient = (i, field, value) => {
    const updated = [...ingredients]
    updated[i] = { ...updated[i], [field]: value }
    setIngredients(updated)
  }

  const addStep = () => setSteps([...steps, { instruction: '', duration_minutes: '' }])
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i))
  const updateStep = (i, field, value) => {
    const updated = [...steps]
    updated[i] = { ...updated[i], [field]: value }
    setSteps(updated)
  }

  const addEquipment = () => setEquipment([...equipment, ''])
  const removeEquipment = (i) => setEquipment(equipment.filter((_, idx) => idx !== i))

  const addTip = () => setTips([...tips, ''])
  const removeTip = (i) => setTips(tips.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (!name.trim() || saving) return
    const validIngredients = ingredients.filter(i => i.name.trim())
    const validSteps = steps.filter(s => s.instruction.trim()).map(s => ({
      instruction: s.instruction,
      duration_minutes: s.duration_minutes ? Number(s.duration_minutes) : null,
    }))
    if (validIngredients.length === 0 || validSteps.length === 0) return

    setSaving(true)
    await onSave(recipe.id, {
      name: name.trim(),
      description: description.trim() || null,
      category,
      difficulty,
      prep_time: prepTime ? Number(prepTime) : null,
      cook_time: cookTime ? Number(cookTime) : null,
      servings: servings ? Number(servings) : null,
      ingredients: validIngredients.map(i => ({
        name: i.name.trim(),
        quantity: i.quantity ? Number(i.quantity) : null,
        unit: i.unit,
      })),
      equipment: equipment.filter(e => e.trim()).map(e => e.trim()),
      steps: validSteps,
      tips: tips.filter(tp => tp.trim()).map(tp => tp.trim()),
      image_url: imageUrl,
      image_source: imageSource,
    })
    setSaving(false)
  }

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete(recipe.id)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{t('recipes.editRecipe')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form — same structure as AddRecipeModal */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isOffline && (
            <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700">
              {t('offline.editHint')}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.name')} *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.description')}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.categoryLabel')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400">
                {CATEGORIES.map(c => <option key={c} value={c}>{t(`recipeCategory.${c}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.difficultyLabel')}</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{t(`recipeDifficulty.${d}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.prepTime')}</label>
              <input type="number" min="0" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="min"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.cookTime')}</label>
              <input type="number" min="0" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="min"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.servingsLabel')}</label>
              <input type="number" min="1" value={servings} onChange={e => setServings(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400" />
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.image')}</label>
            {imageUrl && <img src={imageUrl} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />}
            <input
              type="text"
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              placeholder={t('recipes.imagePromptPlaceholder')}
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-indigo-400 mb-2"
            />
            <div className="flex gap-2">
              <label className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 cursor-pointer transition-colors">
                {uploading ? '...' : t('recipes.upload')}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <button onClick={handleGenerateImage} disabled={generatingImage || !name || isOffline}
                title={isOffline ? t('offline.featureDisabled') : undefined}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 rounded-lg text-xs font-medium text-indigo-600 cursor-pointer transition-colors">
                {generatingImage ? '...' : t('recipes.generateImage')}
              </button>
              {imageUrl && (
                <button onClick={() => { setImageUrl(null); setImageSource('none') }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium text-red-500 cursor-pointer transition-colors">
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.ingredientsLabel')} *</label>
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input type="text" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
                  placeholder={t('recipes.ingredientName')} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
                <input type="number" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                  placeholder={t('recipes.qty')} className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
                <select value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  className="w-20 px-1 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                {ingredients.length > 1 && (
                  <button onClick={() => removeIngredient(i)} className="text-red-400 hover:text-red-600 cursor-pointer px-1">×</button>
                )}
              </div>
            ))}
            <button onClick={addIngredient} className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer">
              + {t('recipes.addIngredient')}
            </button>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.equipmentLabel')}</label>
            {equipment.map((eq, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input type="text" value={eq} onChange={e => { const u = [...equipment]; u[i] = e.target.value; setEquipment(u) }}
                  placeholder={t('recipes.equipmentPlaceholder')} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
                {equipment.length > 1 && (
                  <button onClick={() => removeEquipment(i)} className="text-red-400 hover:text-red-600 cursor-pointer px-1">×</button>
                )}
              </div>
            ))}
            <button onClick={addEquipment} className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer">
              + {t('recipes.addEquipment')}
            </button>
          </div>

          {/* Steps */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.stepsLabel')} *</label>
            {steps.map((step, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <span className="text-xs text-gray-400 mt-2 w-5 shrink-0">{i + 1}.</span>
                <textarea value={step.instruction} onChange={e => updateStep(i, 'instruction', e.target.value)}
                  placeholder={t('recipes.stepInstruction')} rows={2}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400 resize-none" />
                <input type="number" value={step.duration_minutes} onChange={e => updateStep(i, 'duration_minutes', e.target.value)}
                  placeholder="min" className="w-14 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-600 cursor-pointer px-1">×</button>
                )}
              </div>
            ))}
            <button onClick={addStep} className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer">
              + {t('recipes.addStep')}
            </button>
          </div>

          {/* Tips */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('recipes.tipsLabel')}</label>
            {tips.map((tip, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <input type="text" value={tip} onChange={e => { const u = [...tips]; u[i] = e.target.value; setTips(u) }}
                  placeholder={t('recipes.tipPlaceholder')} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-orange-400" />
                {tips.length > 1 && (
                  <button onClick={() => removeTip(i)} className="text-red-400 hover:text-red-600 cursor-pointer px-1">×</button>
                )}
              </div>
            ))}
            <button onClick={addTip} className="text-xs text-orange-500 hover:text-orange-600 font-medium cursor-pointer">
              + {t('recipes.addTip')}
            </button>
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleDelete}
              className={`w-full py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                confirmDelete ? 'bg-red-500 text-white' : 'border border-red-200 text-red-500 hover:bg-red-50'
              }`}
            >
              {confirmDelete ? t('recipes.confirmDelete') : t('inventory.delete')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 cursor-pointer">
            {t('inventory.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !ingredients.some(i => i.name.trim()) || !steps.some(s => s.instruction.trim()) || saving}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium cursor-pointer transition-colors"
          >
            {saving ? '...' : t('recipes.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
