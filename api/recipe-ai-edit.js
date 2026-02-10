import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, context, lang, recipe } = req.body
  if (!text) return res.status(400).json({ error: 'Text required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)

  const recipeJson = JSON.stringify(recipe || {}, null, 2)

  const baseInstruction = `You are a voice command interpreter for a recipe editing app. The user dictated voice instructions to modify a recipe being edited. Interpret their instructions and return ONLY the fields that need to change.

The user speaks in "${lang || 'fr'}". Return all text content (names, instructions, descriptions, tips) in English regardless of the user's language.

Possible instructions include:
- Changing scalar fields: name, description, category, servings, prep_time, cook_time, difficulty
- Adding/removing/modifying equipment items
- Adding/removing/modifying ingredients (name, quantity, unit, optional)
- Adding/removing/modifying steps (instruction, duration)
- Adding/removing/modifying tips
- Any combination of the above

Valid categories: appetizer, main, dessert, snack, drink, soup, salad, side, breakfast, other
Valid difficulties: easy, medium, hard
Valid ingredient units: none, g, kg, ml, l, tsp, tbsp, cup, piece, pinch, bunch, slice, clove, can, pack

Current recipe state:
${recipeJson}

IMPORTANT rules for arrays (equipment, ingredients, steps, tips):
- When modifying an array, return the COMPLETE updated array (not a diff)
- For ingredients: each item has { name, quantity, unit, optional }
- For steps: each item has { instruction, duration }
- For equipment: each item has { name }
- For tips: each item has { text }`

  const jsonSchema = `
Return a JSON object with this exact schema:
{
  "updates": {
    // ONLY include fields that changed. Examples:
    // "name": "New name",
    // "servings": 6,
    // "ingredients": [{ "name": "...", "quantity": 200, "unit": "g", "optional": false }, ...],
    // "steps": [{ "instruction": "...", "duration": 5 }, ...],
  },
  "summary": "brief description of what was changed"
}

If you need information from the internet to properly fulfill the request (e.g., authentic ingredient quantities, cooking temperatures, techniques), return ONLY:
{ "search_needed": true, "search_query": "the search query to perform", "search_reason": "brief explanation" }
Do NOT combine search_needed with updates in the same response.`

  try {
    const effectiveContext = context || 'recipe-edit'

    if (effectiveContext === 'recipe-edit-search') {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `${baseInstruction}

You have access to Google Search to look up information needed for the modifications.

Return a JSON object with this exact schema:
{
  "updates": {
    // ONLY include fields that changed
  },
  "summary": "brief description of what was changed, including any information found via search"
}

Return ONLY the JSON object, no markdown fences.`,
        tools: [{ googleSearch: {} }],
      })

      const result = await model.generateContent(text)
      const responseText = result.response.text().trim()
      const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(jsonStr)
      return res.status(200).json(parsed)
    }

    // Default: recipe-edit (no search)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
      systemInstruction: `${baseInstruction}
${jsonSchema}`,
    })

    const result = await model.generateContent(text)
    const parsed = JSON.parse(result.response.text())
    return res.status(200).json(parsed)
  } catch (error) {
    console.error('Recipe AI edit error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
