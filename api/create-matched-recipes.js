import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { session_id, matched_recipe_ids, household_id, lang, taste_profiles } = req.body

  if (!session_id || !matched_recipe_ids?.length || !household_id) {
    return res.status(400).json({ error: 'session_id, matched_recipe_ids, and household_id required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  // Fetch session recipes that need full recipe creation
  const idsParam = matched_recipe_ids.map(id => `"${id}"`).join(',')
  const recipesResp = await fetch(
    `${supabaseUrl}/rest/v1/swipe_session_recipes?id=in.(${idsParam})&is_existing_recipe=eq.false&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  )

  if (!recipesResp.ok) {
    return res.status(500).json({ error: 'Failed to fetch session recipes' })
  }

  const newRecipes = await recipesResp.json()

  if (newRecipes.length === 0) {
    return res.status(200).json({ created: 0, message: 'No new recipes to create' })
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  let tasteContext = ''
  if (taste_profiles && taste_profiles.length > 0) {
    const lines = taste_profiles.map(p => {
      const prefs = Object.entries(p.tasteProfile || {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}/5`)
        .join(', ')
      return `- ${p.displayName}: ${prefs}`
    }).join('\n')
    tasteContext = `\nHousehold taste profiles:\n${lines}`
  }

  const createdRecipes = []

  for (const sr of newRecipes) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 2000 },
        systemInstruction: `You are a professional chef. Generate a complete recipe based on the name and description provided. Use Google Search for authentic versions.

Write the recipe in English. All text content (name, description, ingredient names, step instructions, tip texts, equipment names) MUST be in English.
${tasteContext}

Return JSON:
{
  "recipe": {
    "name": "Recipe name",
    "description": "1-2 sentences",
    "category": "appetizer|main|dessert|snack|drink|soup|salad|side|breakfast|other",
    "servings": 4,
    "prep_time": 15,
    "cook_time": 30,
    "difficulty": "easy|medium|hard",
    "equipment": [{ "name": "Equipment" }],
    "ingredients": [
      { "name": "Ingredient", "quantity": 200, "unit": "g|kg|ml|l|tsp|tbsp|cup|piece|pinch|bunch|slice|clove|can|pack|none", "optional": false }
    ],
    "steps": [
      { "instruction": "Step instruction", "duration": 5 }
    ],
    "tips": [{ "text": "Useful tip" }],
    "taste_params": {
      "sweetness": 3, "saltiness": 2, "spiciness": 1,
      "acidity": 2, "bitterness": 1, "umami": 4, "richness": 3
    }
  }
}
Return ONLY the JSON object, no markdown fences.`,
      })

      const prompt = sr.description
        ? `Generate a complete recipe for "${sr.name}". Description: ${sr.description}`
        : `Generate a complete recipe for "${sr.name}".`

      const result = await model.generateContent(prompt)
      const responseText = result.response.text().trim()
      const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(jsonStr)
      const recipe = parsed.recipe

      // Insert into recipes table
      const recipeInsert = {
        household_id,
        name: recipe.name || sr.name,
        description: recipe.description || sr.description,
        category: recipe.category || sr.category,
        servings: recipe.servings || sr.servings || 4,
        prep_time: recipe.prep_time || sr.prep_time,
        cook_time: recipe.cook_time || sr.cook_time,
        difficulty: recipe.difficulty || sr.difficulty,
        equipment: recipe.equipment || [],
        ingredients: (recipe.ingredients || []).map((ing, i) => ({ ...ing, order: i + 1 })),
        steps: (recipe.steps || []).map((step, i) => ({ ...step, order: i + 1 })),
        tips: recipe.tips || [],
        image_url: sr.image_url || null,
      }

      const insertResp = await fetch(
        `${supabaseUrl}/rest/v1/recipes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(recipeInsert),
        }
      )

      if (insertResp.ok) {
        const [created] = await insertResp.json()

        // Insert taste params
        if (recipe.taste_params) {
          await fetch(
            `${supabaseUrl}/rest/v1/recipe_taste_params`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ recipe_id: created.id, ...recipe.taste_params }),
            }
          )
        }

        // Update swipe_session_recipes.recipe_id
        await fetch(
          `${supabaseUrl}/rest/v1/swipe_session_recipes?id=eq.${sr.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ recipe_id: created.id }),
          }
        )

        createdRecipes.push(created)
      }
    } catch (err) {
      console.error(`Failed to create recipe "${sr.name}":`, err)
    }
  }

  // Update session status to completed
  await fetch(
    `${supabaseUrl}/rest/v1/swipe_sessions?id=eq.${session_id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ status: 'completed', updated_at: new Date().toISOString() }),
    }
  )

  return res.status(200).json({ created: createdRecipes.length, recipes: createdRecipes })
}
