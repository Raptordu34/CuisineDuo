import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, history, inventory, recipes, shoppingLists } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Build contextual system prompt
  let systemPrompt = `Tu es Miam, un assistant culinaire amical et expert pour un foyer. Tu donnes des conseils de cuisine, idees de recettes, et aides a gerer le quotidien alimentaire. Reponds de facon concise et chaleureuse. Adapte ta langue a celle de l'utilisateur (francais, anglais, chinois, etc.).`

  // Add inventory context
  if (inventory && inventory.length > 0) {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const expiringSoon = inventory.filter(item => {
      if (!item.expiry_date) return false
      return new Date(item.expiry_date) <= threeDaysFromNow
    })

    systemPrompt += `\n\n## Inventaire du foyer (${inventory.length} produits):\n`
    systemPrompt += inventory.map(item => {
      let line = `- ${item.name}`
      if (item.quantity) line += ` (${item.quantity}${item.unit ? ' ' + item.unit : ''})`
      if (item.fill_level) line += ` [niveau: ${item.fill_level}]`
      if (item.expiry_date) line += ` [expire: ${item.expiry_date}]`
      return line
    }).join('\n')

    if (expiringSoon.length > 0) {
      systemPrompt += `\n\n## ALERTE - Produits qui periment sous 3 jours:\n`
      systemPrompt += expiringSoon.map(item => `- ${item.name} (expire le ${item.expiry_date})`).join('\n')
      systemPrompt += `\nMentionne ces produits quand c'est pertinent et suggere de les utiliser en priorite.`
    }
  }

  // Add recipes context
  if (recipes && recipes.length > 0) {
    systemPrompt += `\n\n## Recettes du foyer (${recipes.length}):\n`
    systemPrompt += recipes.map(r => {
      let line = `- ${r.name}`
      if (r.category) line += ` [${r.category}]`
      return line
    }).join('\n')
  }

  // Add shopping lists context
  if (shoppingLists && shoppingLists.length > 0) {
    systemPrompt += `\n\n## Listes de courses actives:\n`
    shoppingLists.forEach(list => {
      systemPrompt += `- ${list.name || 'Sans titre'}:`
      if (list.items && list.items.length > 0) {
        systemPrompt += ' ' + list.items.map(i => i.name + (i.checked ? ' (fait)' : '')).join(', ')
      } else {
        systemPrompt += ' (vide)'
      }
      systemPrompt += '\n'
    })
  }

  systemPrompt += `\n\n## Regles:
- Suggere des recettes et repas en fonction de l'inventaire reel du foyer quand c'est pertinent
- Mentionne les produits qui periment bientot quand l'utilisateur demande quoi cuisiner
- Si l'utilisateur demande "quoi cuisiner", base tes suggestions sur ce qu'il a dans l'inventaire
- Reponds dans la langue de l'utilisateur
- Sois concis mais complet`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  })

  // Formater l'historique pour Gemini (user/model)
  const formattedHistory = (history || []).slice(-20).map(msg => ({
    role: msg.is_ai ? 'model' : 'user',
    parts: [{ text: msg.content.replace(/@miam/gi, '').trim() }],
  }))

  const cleanedMessage = message.replace(/@miam/gi, '').trim()

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    })
    const result = await chat.sendMessage(cleanedMessage)
    return res.status(200).json({ response: result.response.text() })
  } catch (error) {
    console.error('Gemini error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
