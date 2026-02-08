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
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
      tools: [{ googleSearch: {} }],
      systemInstruction: `You are a meal planning assistant. Generate ${totalSuggestions} recipe suggestions for a household. Mix of existing favorites and new creative ideas.

Language: ${lang || 'fr'}. Respond in that language for name and description.

Meal types requested: ${mealTypesStr}
${tasteContext}${preferencesContext}${historyContext}${inventoryContext}${existingContext}

Rules:
1. Include some existing recipes (well-rated ones) — set is_existing=true and provide existing_recipe_id
2. Include creative new recipes — set is_existing=false, existing_recipe_id=null
3. Prioritize ingredients already in stock (especially soon-to-expire)
4. Avoid recipes recently cooked
5. Respect all household members' taste profiles and allergies
6. Vary categories (appetizer, main, dessert, soup, salad, etc.)
7. Search the web for trendy/seasonal recipe ideas

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
    const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(jsonStr)
    const suggestions = parsed.suggestions || []

    // Insert suggestions into swipe_session_recipes
    const inserts = suggestions.map((s, i) => ({
      session_id,
      recipe_id: s.existing_recipe_id || null,
      name: s.name,
      description: s.description || null,
      category: s.category || null,
      image_url: s.image_url || null,
      difficulty: s.difficulty || null,
      prep_time: s.prep_time || null,
      cook_time: s.cook_time || null,
      servings: s.servings || 4,
      is_existing_recipe: !!s.is_existing,
      sort_order: i,
    }))

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
      console.error('Failed to insert swipe recipes:', await insertResp.text())
    }

    // Update session status to 'voting'
    await fetch(
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

    // Try to find images for suggestions without image_url
    const insertedRecipes = insertResp.ok ? await insertResp.json() : []
    const needImages = insertedRecipes.filter(r => !r.image_url)

    // Fire and forget image fetching for up to 6 recipes
    for (const recipe of needImages.slice(0, 6)) {
      try {
        const imgResp = await fetch(
          `https://${req.headers.host}/api/generate-recipe-image`,
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
        }
      } catch {
        // Image fetch failed, continue
      }
    }

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
