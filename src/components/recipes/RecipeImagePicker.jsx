import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'

export default function RecipeImagePicker({ recipeId, recipeName, recipeDescription, currentUrl, onImageChange }) {
  const { t } = useLanguage()
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleSearchImage = async () => {
    if (!recipeName) return
    setSearching(true)
    setSearchFailed(false)
    try {
      const res = await fetch('/api/generate-recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeName, recipeDescription }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.found && data.image_url) {
          await supabase.from('recipes').update({
            image_url: data.image_url,
            image_source: 'ai',
          }).eq('id', recipeId)
          onImageChange(data.image_url, 'ai')
        } else {
          setSearchFailed(true)
        }
      } else {
        setSearchFailed(true)
      }
    } catch {
      setSearchFailed(true)
    } finally {
      setSearching(false)
    }
  }

  const handleFileUpload = async (file) => {
    if (!file || !recipeId) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${recipeId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('recipe-images').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
      await supabase.from('recipes').update({
        image_url: publicUrl,
        image_source: 'user',
      }).eq('id', recipeId)
      onImageChange(publicUrl, 'user')
    } catch {
      // silently fail
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    await supabase.from('recipes').update({
      image_url: null,
      image_source: 'none',
    }).eq('id', recipeId)
    onImageChange(null, 'none')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSearchImage}
          disabled={searching || uploading}
          className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {searching ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {t('recipes.searchingImage')}
            </span>
          ) : t('recipes.searchImage')}
        </button>

        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={searching || uploading}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {t('recipes.takePhoto')}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={searching || uploading}
          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {uploading ? t('recipes.uploadingImage') : t('recipes.chooseFile')}
        </button>

        {currentUrl && (
          <button
            onClick={handleRemoveImage}
            className="text-xs px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-full font-medium transition-colors cursor-pointer"
          >
            {t('recipes.removeImage')}
          </button>
        )}
      </div>

      {searchFailed && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          {t('recipes.noImageFound')} — {t('recipes.addPhotoManually')}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
          e.target.value = ''
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
