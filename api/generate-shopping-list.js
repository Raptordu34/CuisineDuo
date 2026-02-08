import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipe_ids, household_id, list_name, session_id, lang, inventory_items, recipes_data } = req.body

  if (!household_id) {
    return res.status(400).json({ error: 'household_id required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  // Build recipes context from provided data or fetch from Supabase
  let recipesContext = ''
  if (recipes_data && recipes_data.length > 0) {
    const lines = recipes_data.map(r => {
      const ings = (r.ingredients || []).map(i =>
        `${i.name}: ${i.quantity || ''}${i.unit && i.unit !== 'none' ? ' ' + i.unit : ''}`
      ).join(', ')
      return `- ${r.name} (${r.servings} servings): ${ings}`
    }).join('\n')
    recipesContext = lines
  } else if (recipe_ids && recipe_ids.length > 0) {
    const idsParam = recipe_ids.map(id => `"${id}"`).join(',')
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/recipes?id=in.(${idsParam})&select=name,servings,ingredients`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
    if (resp.ok) {
      const recipes = await resp.json()
      const lines = recipes.map(r => {
        const ings = (r.ingredients || []).map(i =>
          `${i.name}: ${i.quantity || ''}${i.unit && i.unit !== 'none' ? ' ' + i.unit : ''}`
        ).join(', ')
        return `- ${r.name} (${r.servings} servings): ${ings}`
      }).join('\n')
      recipesContext = lines
    }
  }

  let inventoryContext = ''
  if (inventory_items && inventory_items.length > 0) {
    const lines = inventory_items.map(i => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n')
    inventoryContext = `\nItems already in stock (subtract from needed quantities):\n${lines}`
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: `You are a smart shopping list generator. Given recipes and current inventory, create a merged shopping list.

Language: ${lang || 'fr'}. Write item names in that language.

Rules:
1. Merge identical ingredients across recipes (e.g., 200g butter + 50g butter = 250g butter)
2. Subtract quantities already in stock from the inventory
3. If an item is fully covered by inventory, DO NOT include it
4. Categorize items by grocery aisle: fruits, vegetables, meat, fish, dairy, bakery, grains, condiments, frozen, beverages, snacks, hygiene, household, other
5. Use reasonable standard units (g, kg, ml, L, piece)

Return JSON:
{
  "items": [
    {
      "name": "Item name",
      "quantity": 500,
      "unit": "g",
      "category": "dairy",
      "recipe_name": "Recipe that needs this (or 'Multiple' if several)"
    }
  ]
}`,
    })

    const prompt = `Create a shopping list for these recipes:\n${recipesContext || 'No specific recipes provided.'}${inventoryContext}`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()
    const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(jsonStr)
    const listItems = parsed.items || []

    // Create shopping list
    const listResp = await fetch(
      `${supabaseUrl}/rest/v1/shopping_lists`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          household_id,
          name: list_name || `Courses ${new Date().toLocaleDateString(lang || 'fr')}`,
          session_id: session_id || null,
          created_by: req.body.created_by || household_id,
        }),
      }
    )

    if (!listResp.ok) {
      console.error('Failed to create shopping list:', await listResp.text())
      return res.status(500).json({ error: 'Failed to create shopping list' })
    }

    const [list] = await listResp.json()

    // Insert items
    if (listItems.length > 0) {
      const itemInserts = listItems.map((item, i) => ({
        list_id: list.id,
        name: item.name,
        quantity: item.quantity || null,
        unit: item.unit || null,
        category: item.category || 'other',
        recipe_name: item.recipe_name || null,
        sort_order: i,
      }))

      await fetch(
        `${supabaseUrl}/rest/v1/shopping_list_items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(itemInserts),
        }
      )
    }

    return res.status(200).json({ list, items_count: listItems.length })
  } catch (error) {
    console.error('Generate shopping list error:', error)
    return res.status(500).json({ error: 'Shopping list generation failed' })
  }
}
