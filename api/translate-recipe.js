import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipe_id, recipe_data, lang } = req.body
  if (!lang || !['fr', 'zh'].includes(lang)) {
    return res.status(400).json({ error: 'lang must be fr or zh' })
  }
  if (!recipe_id && !recipe_data) {
    return res.status(400).json({ error: 'recipe_id or recipe_data required' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  // Check cache if recipe_id provided
  if (recipe_id && supabaseUrl && supabaseKey) {
    try {
      const cacheResp = await fetch(
        `${supabaseUrl}/rest/v1/recipe_translations?recipe_id=eq.${recipe_id}&lang=eq.${lang}&select=translated_data`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )
      if (cacheResp.ok) {
        const cached = await cacheResp.json()
        if (cached.length > 0) {
          return res.status(200).json({ translated_data: cached[0].translated_data, from_cache: true })
        }
      }
    } catch {
      // Cache miss, proceed with translation
    }
  }

  // Get recipe data to translate
  let dataToTranslate = recipe_data
  if (!dataToTranslate && recipe_id) {
    try {
      const recipeResp = await fetch(
        `${supabaseUrl}/rest/v1/recipes?id=eq.${recipe_id}&select=name,description,ingredients,steps,tips,equipment`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      )
      if (recipeResp.ok) {
        const recipes = await recipeResp.json()
        if (recipes.length > 0) dataToTranslate = recipes[0]
      }
    } catch {
      return res.status(500).json({ error: 'Failed to fetch recipe data' })
    }
  }

  if (!dataToTranslate) {
    return res.status(400).json({ error: 'No recipe data available to translate' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const langName = lang === 'fr' ? 'French' : 'Chinese (Simplified)'

  // Build the translation payload - only textual fields
  const translationInput = {
    name: dataToTranslate.name || '',
    description: dataToTranslate.description || '',
    ingredients: (dataToTranslate.ingredients || []).map(ing => ({ name: ing.name })),
    steps: (dataToTranslate.steps || []).map(step => ({ instruction: step.instruction })),
    tips: (dataToTranslate.tips || []).map(tip => ({ text: tip.text })),
    equipment: (dataToTranslate.equipment || []).map(eq => ({ name: eq.name })),
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: `You are a professional translator specializing in culinary content. Translate the following recipe data from English to ${langName}.

Translate ONLY the text fields provided. Keep the JSON structure identical.
- Translate: name, description, ingredients[].name, steps[].instruction, tips[].text, equipment[].name
- Do NOT add or remove any array items
- Do NOT translate quantities, units, or numeric values
- Use natural, appetizing culinary language in the target language

Return a JSON object with the same structure as the input.`,
    })

    const result = await model.generateContent(JSON.stringify(translationInput))
    const translatedData = JSON.parse(result.response.text())

    // Cache the result if recipe_id provided
    if (recipe_id && supabaseUrl && supabaseKey) {
      try {
        await fetch(
          `${supabaseUrl}/rest/v1/recipe_translations`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({
              recipe_id,
              lang,
              translated_data: translatedData,
            }),
          }
        )
      } catch {
        // Cache write failure is non-critical
      }
    }

    return res.status(200).json({ translated_data: translatedData, from_cache: false })
  } catch (error) {
    console.error('Translation error:', error)
    return res.status(500).json({ error: 'Translation failed' })
  }
}
