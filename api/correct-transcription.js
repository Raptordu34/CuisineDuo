import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, context, lang, items, chatHistory } = req.body
  if (!text) return res.status(400).json({ error: 'Text required' })
  if (!context) return res.status(400).json({ error: 'Context required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    if (context === 'chat') {
      let historyContext = ''
      if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) {
        historyContext = `\n\nHere is the recent conversation for context (use it to better understand ambiguous words, names, topics being discussed, but do NOT include any of this in your response):\n${chatHistory.map(m => `${m.author}: ${m.content}`).join('\n')}`
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are a speech-to-text correction assistant. The user dictated a message via voice recognition in "${lang || 'fr'}". Fix any speech recognition errors, add proper punctuation and capitalization, but keep the original meaning and tone intact. Do NOT translate. Do NOT add or remove content. Just clean up the transcription. Reply with ONLY the corrected text, nothing else.${historyContext}`,
      })

      const result = await model.generateContent(text)
      return res.status(200).json({ corrected: result.response.text().trim() })
    }

    if (context === 'scan-correction') {
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required for scan-correction' })
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
        systemInstruction: `You are a voice command interpreter for a grocery inventory app. The user dictated voice corrections about scanned grocery items. Interpret their instructions and return the updated items list.

The user speaks in "${lang || 'fr'}". Possible instructions include:
- Changing an item's brand, name, price, quantity, unit, category, store
- Removing/deleting an item (by name or position like "the third one")
- Adding a new item
- Any combination of the above

Current items (JSON array):
${JSON.stringify(items, null, 2)}

Each item has these possible fields: name, brand, quantity, unit, price (total line price), price_per_kg (per-kg rate or null), price_estimated, category, store, purchase_date, expiry_date.
Valid categories: dairy, meat, fish, vegetables, fruits, grains, bakery, frozen, beverages, snacks, condiments, hygiene, household, other.
Valid units: piece, kg, g, l, ml, pack.

Return a JSON object with this exact schema:
{
  "items": [/* the full updated items array */],
  "changes": "brief description of what was changed"
}

Apply ALL the user's instructions. If you can't understand an instruction, skip it and mention it in "changes".`,
      })

      const result = await model.generateContent(text)
      const parsed = JSON.parse(result.response.text())
      return res.status(200).json(parsed)
    }

    if (context === 'inventory-update') {
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required for inventory-update' })
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
        systemInstruction: `You are a voice command interpreter for a grocery inventory app. The user dictated voice instructions to update their inventory items. Interpret their instructions and return the updates to apply.

The user speaks in "${lang || 'fr'}". Possible instructions include:
- Changing ANY field of an item: name, brand, quantity, unit, price, price_per_kg, fill_level, category, store, notes, estimated_expiry_date
- Marking an item as consumed/finished (e.g., "the butter is finished", "le beurre est terminé")
- Recalculating quantity from price and price_per_kg: if the user provides a price_per_kg value, compute the correct quantity using: quantity = price / price_per_kg. Example: if an item costs 1.32€ and the user says "le prix au kilo est 8.95", then quantity = 1.32 / 8.95 ≈ 0.148 kg (148g). Choose the most appropriate unit (kg or g) for readability.
- Any combination of the above

Fill levels: 1 (full/plein), 0.75 (3/4), 0.5 (half/moitié), 0.25 (quarter/quart)
Valid units: piece, kg, g, l, ml, pack
Valid categories: dairy, meat, fish, vegetables, fruits, grains, bakery, frozen, beverages, snacks, condiments, hygiene, household, other

Each item includes: item_id, name, brand, quantity, unit, price (total item price), price_per_kg (price per kilogram), fill_level, category.

Current inventory items in scope (JSON array):
${JSON.stringify(items, null, 2)}

If you need information from the internet to properly fulfill the request (e.g., typical expiry dates, nutritional info, product details), return ONLY:
{ "search_needed": true, "search_query": "the search query to perform", "search_reason": "brief explanation of why search is needed" }
Do NOT combine search_needed with updates in the same response.

Otherwise, return a JSON object with this exact schema:
{
  "updates": [
    { "item_id": "uuid", "action": "update", "fields": { "fill_level": 0.5 } },
    { "item_id": "uuid", "action": "update", "fields": { "quantity": 0.148, "unit": "kg", "price_per_kg": 8.95 } },
    { "item_id": "uuid", "action": "update", "fields": { "name": "New name", "brand": "New brand" } },
    { "item_id": "uuid", "action": "consumed" }
  ],
  "summary": "brief description of what was changed"
}

For "update" action: include ONLY the fields that change in "fields". Valid field keys: name, brand, quantity, unit, price, price_per_kg, price_estimated, fill_level, category, store, notes, estimated_expiry_date.

Match item names flexibly (e.g., "lait" matches "Lait demi-écrémé"). Apply ALL the user's instructions. If you can't understand an instruction, skip it and mention it in "summary".`,
      })

      const result = await model.generateContent(text)
      const parsed = JSON.parse(result.response.text())
      return res.status(200).json(parsed)
    }

    if (context === 'inventory-update-search') {
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array required for inventory-update-search' })
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: `You are a voice command interpreter for a grocery inventory app. The user dictated voice instructions to update their inventory items. You have access to Google Search to look up information if needed. Interpret their instructions and return the updates to apply.

The user speaks in "${lang || 'fr'}". Possible instructions include:
- Changing ANY field of an item: name, brand, quantity, unit, price, price_per_kg, fill_level, category, store, notes, estimated_expiry_date
- Marking an item as consumed/finished (e.g., "the butter is finished", "le beurre est terminé")
- Recalculating quantity from price and price_per_kg: if the user provides a price_per_kg value, compute the correct quantity using: quantity = price / price_per_kg. Example: if an item costs 1.32€ and the user says "le prix au kilo est 8.95", then quantity = 1.32 / 8.95 ≈ 0.148 kg (148g). Choose the most appropriate unit (kg or g) for readability.
- Any combination of the above

Fill levels: 1 (full/plein), 0.75 (3/4), 0.5 (half/moitié), 0.25 (quarter/quart)
Valid units: piece, kg, g, l, ml, pack
Valid categories: dairy, meat, fish, vegetables, fruits, grains, bakery, frozen, beverages, snacks, condiments, hygiene, household, other

Each item includes: item_id, name, brand, quantity, unit, price (total item price), price_per_kg (price per kilogram), fill_level, category.

Current inventory items in scope (JSON array):
${JSON.stringify(items, null, 2)}

Return a JSON object with this exact schema:
{
  "updates": [
    { "item_id": "uuid", "action": "update", "fields": { "fill_level": 0.5 } },
    { "item_id": "uuid", "action": "update", "fields": { "quantity": 0.148, "unit": "kg", "price_per_kg": 8.95 } },
    { "item_id": "uuid", "action": "update", "fields": { "name": "New name", "brand": "New brand" } },
    { "item_id": "uuid", "action": "consumed" }
  ],
  "summary": "brief description of what was changed, including any information found via search"
}

For "update" action: include ONLY the fields that change in "fields". Valid field keys: name, brand, quantity, unit, price, price_per_kg, price_estimated, fill_level, category, store, notes, estimated_expiry_date.

Match item names flexibly (e.g., "lait" matches "Lait demi-écrémé"). Apply ALL the user's instructions. If you can't understand an instruction, skip it and mention it in "summary".
Return ONLY the JSON object, no markdown fences or other text.`,
        tools: [{ googleSearch: {} }],
      })

      const result = await model.generateContent(text)
      const responseText = result.response.text().trim()
      // Strip markdown fences if present (googleSearch may disable responseMimeType)
      const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(jsonStr)
      return res.status(200).json(parsed)
    }

    return res.status(400).json({ error: 'Invalid context' })
  } catch (error) {
    console.error('Transcription correction error:', error)
    return res.status(500).json({ error: 'Correction failed' })
  }
}
