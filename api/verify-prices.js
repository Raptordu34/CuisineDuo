import { GoogleGenerativeAI } from '@google/generative-ai'

const WEIGHT_CATEGORIES = ['meat', 'fish', 'vegetables', 'fruits', 'dairy']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { items, store } = req.body
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Filtrer les items vendus au poids dans les categories pertinentes
  const weightItems = items
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .filter(item =>
      item.unit === 'kg' &&
      WEIGHT_CATEGORIES.includes(item.category)
    )

  // Rien a verifier
  if (weightItems.length === 0 || !store) {
    return res.status(200).json({ items })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    })

    const itemList = weightItems
      .map((item, i) => `${i + 1}. "${item.name}" - prix actuel: ${item.price_per_kg ?? 'inconnu'} EUR/kg, quantite: ${item.quantity} kg, prix total: ${item.price ?? 'inconnu'} EUR`)
      .join('\n')

    const prompt = `Tu es un assistant de verification de prix de supermarche.
Voici des produits achetes au poids chez "${store}". Les prix au kilo ont ete extraits d'un ticket de caisse par OCR et peuvent etre incorrects (souvent le prix total est mis comme prix/kg par erreur).

Produits a verifier:
${itemList}

Pour chaque produit, recherche le prix au kilo reel chez "${store}" (ou prix moyen en France si pas trouve).
Reponds UNIQUEMENT en JSON valide, un tableau d'objets avec:
- index: numero du produit (1-based)
- corrected_price_per_kg: prix au kilo corrige (nombre)
- corrected_price: prix total corrige = corrected_price_per_kg * quantite (nombre)
- source: breve indication de la source

Exemple: [{"index": 1, "corrected_price_per_kg": 12.90, "corrected_price": 6.45, "source": "prix moyen poulet fermier"}]

Si tu ne trouves pas d'information fiable pour un produit, omets-le du tableau.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Extraire le JSON de la reponse
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return res.status(200).json({ items })
    }

    const corrections = JSON.parse(jsonMatch[0])
    const correctedItems = [...items]

    for (const correction of corrections) {
      const weightItem = weightItems[correction.index - 1]
      if (!weightItem) continue
      const idx = weightItem._originalIndex

      correctedItems[idx] = {
        ...correctedItems[idx],
        price_per_kg: correction.corrected_price_per_kg,
        price: correction.corrected_price,
        price_verified: true,
      }
    }

    return res.status(200).json({ items: correctedItems })
  } catch (error) {
    console.error('verify-prices error:', error)
    // Fallback gracieux : retourne les items originaux
    return res.status(200).json({ items })
  }
}
