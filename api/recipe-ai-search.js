import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, context, lang, recipes, description, householdTasteProfiles } = req.body
  if (!text) return res.status(400).json({ error: 'Text required' })
  if (!context) return res.status(400).json({ error: 'Context required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)

  let tasteContext = ''
  if (householdTasteProfiles && householdTasteProfiles.length > 0) {
    const profileLines = householdTasteProfiles.map(p => {
      const tp = p.tasteProfile
      const prefs = Object.entries(tp)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}/5`)
        .join(', ')
      return `- ${p.displayName} (${p.ratingsCount} recettes notees): ${prefs}`
    }).join('\n')
    tasteContext = `

Voici les profils gustatifs du foyer. Utilise-les pour ORIENTER tes suggestions (pas pour les restreindre). Tu peux proposer des choses nouvelles qui challengent les gouts, mais essaie de tenir compte des preferences generales. Mentionne si une suggestion correspond bien ou est un peu en dehors des gouts habituels.
${profileLines}`
  }

  try {
    if (context === 'recipe-search') {
      const recipeSummary = (recipes || []).map(r =>
        `- id:${r.id} | ${r.name} | ${r.category || ''} | ${r.description || ''} | ${r.ingredients_summary || ''}`
      ).join('\n')

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
        systemInstruction: `You are a recipe search assistant for a cooking app. The user describes what they want to cook or eat. Your job is:
1. Search through the existing recipes and find any that match the user's request
2. Suggest 3 new recipe ideas that match the request (not in the existing list)

The user speaks in "${lang || 'fr'}". Respond in the same language for the summary and relevance_reason fields.
IMPORTANT: Write suggestion "name" and "description" fields in English, regardless of the user's language.

Existing recipes:
${recipeSummary || 'No recipes yet.'}

Return a JSON object with this exact schema:
{
  "matching_recipes": [
    { "recipe_id": "uuid", "name": "Recipe name", "relevance_reason": "Brief explanation of why this matches" }
  ],
  "suggestions": [
    { "name": "New recipe name", "description": "Brief appealing description" }
  ],
  "summary": "Brief summary of what was found"
}

matching_recipes: only include recipes from the existing list that are relevant. Use the exact recipe_id from the list.
suggestions: always provide exactly 3 new ideas, creative and diverse. These should NOT be recipes already in the list.
${tasteContext}`,
      })

      const result = await model.generateContent(text)
      const parsed = JSON.parse(result.response.text())
      return res.status(200).json(parsed)
    }

    if (context === 'recipe-generate') {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are a professional chef and recipe creator. Generate a complete, detailed recipe based on the recipe name and description provided. Use Google Search to find authentic, well-reviewed versions of this dish.

Write the recipe in English. All text content (name, description, ingredient names, step instructions, tip texts, equipment names) MUST be in English.

Return a JSON object with this exact schema:
{
  "recipe": {
    "name": "Recipe name",
    "description": "Appealing description (1-2 sentences)",
    "category": "one of: appetizer, main, dessert, snack, drink, soup, salad, side, breakfast, other",
    "servings": 4,
    "prep_time": 15,
    "cook_time": 30,
    "difficulty": "one of: easy, medium, hard",
    "equipment": [{ "name": "Equipment name" }],
    "ingredients": [
      { "name": "Ingredient name", "quantity": 200, "unit": "one of: none, g, kg, ml, l, tsp, tbsp, cup, piece, pinch, bunch, slice, clove, can, pack", "optional": false }
    ],
    "steps": [
      { "instruction": "Step instruction", "duration": 5 }
    ],
    "tips": [{ "text": "Useful tip" }],
    "taste_params": {
      "sweetness": 3,
      "saltiness": 2,
      "spiciness": 1,
      "acidity": 2,
      "bitterness": 1,
      "umami": 4,
      "richness": 3
    }
  }
}

taste_params: Rate each flavor dimension from 1 (very low) to 5 (very high). All 7 values are required. Be accurate based on the recipe's actual flavor profile.
Be precise with quantities. Duration in minutes (null if not applicable). Include 2-3 tips. Make the recipe complete and easy to follow.
Return ONLY the JSON object, no markdown fences.
${tasteContext}`,
        tools: [{ googleSearch: {} }],
        generationConfig: { maxOutputTokens: 2000 },
      })

      const prompt = description
        ? `Generate a complete recipe for "${text}". Description: ${description}`
        : `Generate a complete recipe for "${text}".`

      const result = await model.generateContent(prompt)
      const responseText = result.response.text().trim()
      const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(jsonStr)
      return res.status(200).json(parsed)
    }

    return res.status(400).json({ error: 'Invalid context' })
  } catch (error) {
    console.error('Recipe AI search error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
