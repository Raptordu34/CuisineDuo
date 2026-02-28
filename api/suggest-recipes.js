import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { inventory, lang, preferences } = req.body
  if (!inventory || !Array.isArray(inventory)) {
    return res.status(400).json({ error: 'Inventory array required' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Format inventory list, prioritize items close to expiry
  const sorted = [...inventory].sort((a, b) => {
    if (!a.estimated_expiry_date) return 1
    if (!b.estimated_expiry_date) return -1
    return new Date(a.estimated_expiry_date) - new Date(b.estimated_expiry_date)
  })

  const ingredientList = sorted
    .slice(0, 30)
    .map(i => `${i.name} (${i.quantity} ${i.unit}${i.estimated_expiry_date ? ', expire: ' + i.estimated_expiry_date : ''})`)
    .join('\n')

  const langLabels = { fr: 'français', en: 'English', zh: '中文' }
  const langLabel = langLabels[lang] || 'français'
  const otherLangs = ['fr', 'en', 'zh'].filter(l => l !== lang)
  const otherLangLabels = otherLangs.map(l => `${l} (${langLabels[l]})`).join(', ')

  const prompt = `Tu es un chef cuisinier créatif. Voici les ingrédients disponibles dans un foyer:

${ingredientList}

${preferences ? `Préférences: ${preferences}` : ''}

Génère exactement 3 recettes réalisables principalement avec ces ingrédients (tu peux supposer la présence de condiments basiques: sel, poivre, huile, etc.).
Priorise les ingrédients proches de la date de péremption.

Réponds UNIQUEMENT en JSON valide (pas de markdown), sous ce format exact:
{
  "recipes": [
    {
      "name": "Nom de la recette",
      "description": "Description courte (1-2 phrases)",
      "category": "appetizer|main|dessert|snack|drink|other",
      "difficulty": "easy|medium|hard",
      "prep_time": 15,
      "cook_time": 30,
      "servings": 4,
      "ingredients": [{"name": "ingredient", "quantity": 200, "unit": "g"}],
      "steps": [{"instruction": "Étape détaillée", "duration_minutes": 5}],
      "equipment": ["Four"],
      "tips": ["Astuce utile"],
      "translations": {
        "${otherLangs[0]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"]
        },
        "${otherLangs[1]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"]
        }
      }
    }
  ]
}

Les champs principaux (name, description, ingredients, steps, tips) sont en ${langLabel}.
Le champ "translations" contient les traductions en ${otherLangLabels}.
Pour les traductions d'ingredients, garde le meme ordre et nombre que le tableau principal, avec seulement le champ "name" traduit.
Pour les traductions de steps, garde le meme ordre avec seulement "instruction" traduit.
category, difficulty, prep_time, cook_time, servings, equipment restent identiques (pas besoin de les traduire).`

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: text?.slice?.(0, 500) })
    }

    // Ajouter la langue courante dans les translations pour avoir les 3 langues
    const recipes = (parsed.recipes || []).map(r => {
      const translations = r.translations || {}
      // Ajouter la langue courante avec les champs principaux
      translations[lang] = {
        name: r.name,
        description: r.description,
        ingredients: r.ingredients?.map(i => ({ name: i.name })),
        steps: r.steps?.map(s => ({ instruction: s.instruction })),
        tips: r.tips,
      }
      return { ...r, translations }
    })

    return res.status(200).json({ recipes })
  } catch (error) {
    console.error('Suggest recipes error:', error)
    return res.status(500).json({ error: 'Suggestion failed' })
  }
}
