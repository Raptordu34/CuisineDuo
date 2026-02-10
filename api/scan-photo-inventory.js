import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, items, existingInventory, history, lang } = req.body
  if (!items) return res.status(400).json({ error: 'Items required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const inventoryContext = existingInventory && existingInventory.length > 0
    ? `\nProduits deja en stock dans l'inventaire :\n${existingInventory.map(i => `- ${i.name}${i.brand ? ` (${i.brand})` : ''}: ${i.quantity} ${i.unit}`).join('\n')}\n`
    : '\nL\'inventaire est actuellement vide.\n'

  const itemsContext = `\nItems proposes actuellement (issus du scan) :\n${JSON.stringify(items, null, 2)}\n`

  const systemInstruction = `Tu es un assistant d'inventaire cuisine intelligent. Tu aides l'utilisateur a affiner les resultats d'un scan photo de produits alimentaires.

${inventoryContext}
${itemsContext}

REGLES :
1. Tu connais les produits deja en stock (ci-dessus). Identifie les doublons parmi les items proposes.
2. Tu interpretes les commandes de l'utilisateur : "retire le lait", "change 2 yaourts en 3", "c'est pas du beurre c'est de la margarine", "ajoute des oeufs", etc.
3. Tu peux corriger les noms, quantites, unites, categories des items.
4. Tu dois TOUJOURS retourner un JSON valide (PAS de markdown, PAS de backticks) avec exactement cette structure :
{
  "response": "ton message en texte a l'utilisateur (dans la langue ${lang || 'fr'})",
  "items": [/* la liste COMPLETE des items mise a jour, meme format que les items d'entree */],
  "duplicates": [/* indices (0-based) des items qui sont des doublons avec l'inventaire existant */]
}

5. Chaque item dans "items" doit avoir : name, quantity, unit, category, price (peut etre null), estimated_expiry_days (peut etre null), brand (peut etre null)
6. Les unites valides sont : piece, kg, g, l, ml, pack
7. Les categories valides sont : dairy, meat, fish, vegetables, fruits, grains, bakery, frozen, beverages, snacks, condiments, hygiene, household, other
8. Si c'est l'appel initial (pas de message utilisateur), fais un resume de ce que tu as detecte et identifie les doublons.
9. Reponds dans la langue de l'utilisateur (${lang || 'fr'}).

IMPORTANT : Ne mets JAMAIS le JSON dans des blocs de code markdown. Retourne le JSON brut directement.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
  })

  const formattedHistory = (history || []).slice(-20).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.3 },
    })

    const userMessage = message || `Analyse les items proposes et identifie les doublons avec l'inventaire existant. Fais un resume.`
    const result = await chat.sendMessage(userMessage)
    const responseText = result.response.text().trim()

    // Parse the JSON response
    const tryParse = (text) => {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        const parsed = JSON.parse(cleaned)
        if (parsed.items && parsed.response != null) return parsed
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*"items"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            if (parsed.items && parsed.response != null) return parsed
          } catch { /* not valid JSON */ }
        }
      }
      return null
    }

    const parsed = tryParse(responseText)
    if (parsed) {
      return res.status(200).json({
        response: parsed.response,
        items: parsed.items || items,
        duplicates: parsed.duplicates || [],
      })
    }

    // Fallback: return original items with the text response
    return res.status(200).json({
      response: responseText,
      items,
      duplicates: [],
    })
  } catch (error) {
    console.error('Scan photo chat error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
