import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const {
    session_id,
    household_id,
    meal_count,
    meal_types,
    lang,
    existing_recipes,
    household_taste_profiles,
    taste_preferences,
    cooking_history,
    inventory_items,
  } = req.body

  if (!session_id || !household_id) {
    return res.status(400).json({ error: 'session_id and household_id required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  const genAI = new GoogleGenerativeAI(apiKey)

  // Build context sections
  let tasteContext = ''
  if (household_taste_profiles && household_taste_profiles.length > 0) {
    const lines = household_taste_profiles.map(p => {
      const prefs = Object.entries(p.tasteProfile || {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}/5`)
        .join(', ')
      return `- ${p.displayName}: ${prefs}`
    }).join('\n')
    tasteContext = `\nHousehold taste profiles:\n${lines}`
  }

  let preferencesContext = ''
  if (taste_preferences && taste_preferences.length > 0) {
    const lines = taste_preferences.map(p => `- ${p.displayName}: ${p.notes || 'No notes'}`).join('\n')
    preferencesContext = `\nPersonal preferences/allergies:\n${lines}`
  }

  let historyContext = ''
  if (cooking_history && cooking_history.length > 0) {
    const lines = cooking_history.slice(0, 20).map(h => `- ${h.recipe_name} (${h.cooked_at})`).join('\n')
    historyContext = `\nRecently cooked (avoid repeating):\n${lines}`
  }

  let inventoryContext = ''
  if (inventory_items && inventory_items.length > 0) {
    const lines = inventory_items.slice(0, 50).map(i => {
      const exp = i.estimated_expiry_date ? ` (expires: ${i.estimated_expiry_date})` : ''
      return `- ${i.name}: ${i.quantity} ${i.unit}${exp}`
    }).join('\n')
    inventoryContext = `\nItems currently in stock (prioritize using these, especially soon-to-expire items):\n${lines}`
  }

  let existingContext = ''
  if (existing_recipes && existing_recipes.length > 0) {
    const lines = existing_recipes.slice(0, 30).map(r =>
      `- id:${r.id} | ${r.name} | ${r.category || ''} | avg_rating:${r.avg_rating || 'none'}`
    ).join('\n')
    existingContext = `\nExisting recipes in the cookbook (can suggest well-rated ones):\n${lines}`
  }

  const totalSuggestions = Math.max((meal_count || 7) + 5, 12)
  const mealTypesStr = (meal_types || []).join(', ') || 'any'

  try {
    console.log(`[generate-swipe-recipes] Starting generation for session ${session_id}, ${totalSuggestions} suggestions`)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: `You are a meal planning assistant. Generate ${totalSuggestions} recipe suggestions for a household. Mix of existing favorites and new creative ideas.

Language: English. Write name and description in English.

Meal types requested: ${mealTypesStr}
${tasteContext}${preferencesContext}${historyContext}${inventoryContext}${existingContext}

Rules:
1. Include some existing recipes (well-rated ones) — set is_existing=true and provide existing_recipe_id
2. Include creative new recipes — set is_existing=false, existing_recipe_id=null
3. Prioritize ingredients already in stock (especially soon-to-expire)
4. Avoid recipes recently cooked
5. Respect all household members' taste profiles and allergies
6. Vary categories (appetizer, main, dessert, soup, salad, etc.)
7. Include trendy/seasonal recipe ideas

Return JSON:
{
  "suggestions": [
    {
      "name": "Recipe name",
      "description": "1-2 sentence appealing description",
      "category": "main|appetizer|dessert|snack|soup|salad|side|breakfast|drink|other",
      "difficulty": "easy|medium|hard",
      "prep_time": 15,
      "cook_time": 30,
      "servings": 4,
      "image_url": null,
      "is_existing": false,
      "existing_recipe_id": null
    }
  ]
}`,
    })

    const result = await model.generateContent(
      `Generate ${totalSuggestions} recipe suggestions for ${meal_count || 7} meals. Types: ${mealTypesStr}.`
    )

    const responseText = result.response.text().trim()
    console.log(`[generate-swipe-recipes] Gemini response length: ${responseText.length}`)
    const parsed = JSON.parse(responseText)
    const suggestions = parsed.suggestions || []
    console.log(`[generate-swipe-recipes] Parsed ${suggestions.length} suggestions`)

    // Build a map of existing recipe images
    const existingImageMap = {}
    if (existing_recipes) {
      for (const r of existing_recipes) {
        if (r.id && r.image_url) existingImageMap[r.id] = r.image_url
      }
    }

    // Insert suggestions into swipe_session_recipes
    const inserts = suggestions.map((s, i) => {
      // Reuse image from existing recipe if available
      const existingImage = s.existing_recipe_id ? existingImageMap[s.existing_recipe_id] : null
      return {
        session_id,
        recipe_id: s.existing_recipe_id || null,
        name: s.name,
        description: s.description || null,
        category: s.category || null,
        image_url: existingImage || null,
        difficulty: s.difficulty || null,
        prep_time: s.prep_time || null,
        cook_time: s.cook_time || null,
        servings: s.servings || 4,
        is_existing_recipe: !!s.is_existing,
        sort_order: i,
      }
    })

    // Insert via Supabase REST API
    const insertResp = await fetch(
      `${supabaseUrl}/rest/v1/swipe_session_recipes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(inserts),
      }
    )

    if (!insertResp.ok) {
      const errText = await insertResp.text()
      console.error(`[generate-swipe-recipes] Failed to insert recipes (${insertResp.status}):`, errText)
      throw new Error(`Insert failed: ${errText}`)
    }

    const insertedRecipes = await insertResp.json()
    console.log(`[generate-swipe-recipes] Inserted ${insertedRecipes.length} recipes into DB`)

    // Generate ALL images BEFORE switching to 'voting'
    const protocol = req.headers.host?.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${req.headers.host}`
    const needImages = insertedRecipes.filter(r => !r.image_url)

    // Process images in batches of 3 for speed
    const BATCH_SIZE = 3
    for (let i = 0; i < needImages.length; i += BATCH_SIZE) {
      const batch = needImages.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async (recipe) => {
          const imgResp = await fetch(
            `${baseUrl}/api/generate-recipe-image`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipeName: recipe.name, recipeDescription: recipe.description }),
            }
          )
          const imgData = await imgResp.json()
          if (imgData.found && imgData.image_url) {
            await fetch(
              `${supabaseUrl}/rest/v1/swipe_session_recipes?id=eq.${recipe.id}`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ image_url: imgData.image_url }),
              }
            )
            console.log(`[generate-swipe-recipes] Image ${i + batch.indexOf(recipe) + 1}/${needImages.length}: "${recipe.name}" OK`)
          } else {
            console.log(`[generate-swipe-recipes] Image ${i + batch.indexOf(recipe) + 1}/${needImages.length}: "${recipe.name}" no image`)
          }
        })
      )
    }
    console.log(`[generate-swipe-recipes] All images processed`)

    // NOW update session status to 'voting' (all images ready)
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/swipe_sessions?id=eq.${session_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ status: 'voting', updated_at: new Date().toISOString() }),
      }
    )
    console.log(`[generate-swipe-recipes] Session status update: ${patchResp.status}`)

    return res.status(200).json({ suggestions: insertedRecipes, count: suggestions.length })
  } catch (error) {
    console.error('Generate swipe recipes error:', error)

    // Update session status back on error
    await fetch(
      `${supabaseUrl}/rest/v1/swipe_sessions?id=eq.${session_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
      }
    )

    return res.status(500).json({ error: 'Recipe generation failed' })
  }
}
