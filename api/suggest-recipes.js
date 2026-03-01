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

  const { inventory, lang, preferences, inventoryCount, discoveryCount, existingRecipes, tasteProfile } = req.body
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

  // Build prompt sections
  const invCount = inventoryCount ?? 2
  const discCount = discoveryCount ?? 1
  const totalCount = invCount + discCount

  // Anti-duplicates section
  let antiDuplicateSection = ''
  if (Array.isArray(existingRecipes) && existingRecipes.length > 0) {
    const recipeList = existingRecipes.map(r => `- ${r.name} (${r.category})`).join('\n')
    antiDuplicateSection = `
ANTI-DOUBLON :
Le carnet de recettes contient deja ces plats :
${recipeList}
Tu ne dois PAS proposer de recettes identiques ou trop similaires (meme plat avec variante mineure, meme base avec garniture differente).
Privilegie la diversite culinaire.
`
  }

  // Taste profile section
  let tasteSection = ''
  if (tasteProfile) {
    const axisLabels = { sweetness: 'sucre', saltiness: 'sale', spiciness: 'epice', acidity: 'acidite', bitterness: 'amertume', umami: 'umami', richness: 'richesse' }
    const axes = Object.entries(axisLabels)
      .filter(([k]) => tasteProfile[k] != null)
      .map(([k, label]) => `- Tolerance ${label}: ${tasteProfile[k]}/5`)
      .join('\n')
    const banned = tasteProfile.banned_ingredients?.length
      ? `- Ingredients bannis: ${tasteProfile.banned_ingredients.join(', ')}`
      : ''
    const restrictions = tasteProfile.dietary_restrictions?.length
      ? `- Restrictions: ${tasteProfile.dietary_restrictions.join(', ')}`
      : ''
    const notes = tasteProfile.notes ? `- Notes: ${tasteProfile.notes}` : ''

    tasteSection = `
PROFIL GUSTATIF DU FOYER :
${axes}
${banned}
${restrictions}
${notes}

CONSIGNES PROFIL :
- Ne propose JAMAIS de recettes contenant des ingredients bannis.
- Respecte les restrictions alimentaires de TOUS les membres.
- Adapte les niveaux d'epices/acidite au profil le plus sensible du foyer.
- Si une recette contient un element sensible, propose une alternative ou une adaptation.
`
  }

  // Split section
  let splitSection = ''
  if (invCount > 0 && discCount > 0) {
    splitSection = `
REPARTITION :
- Genere ${invCount} recette(s) "inventaire" : realisables principalement avec les ingredients disponibles.
- Genere ${discCount} recette(s) "decouverte" : recettes creatives ou originales, qui peuvent utiliser ou non les ingredients disponibles, privilegiant la variete et la surprise.
`
  } else if (discCount === 0) {
    splitSection = `Genere exactement ${totalCount} recettes realisables principalement avec les ingredients disponibles.`
  } else {
    splitSection = `Genere exactement ${totalCount} recettes creatives et originales, sans contrainte d'ingredients disponibles.`
  }

  const prompt = `Tu es un chef cuisinier creatif. Voici les ingredients disponibles dans un foyer:

${ingredientList}

${preferences ? `Preferences: ${preferences}` : ''}
${antiDuplicateSection}${tasteSection}${splitSection}

Priorise les ingredients proches de la date de peremption pour les recettes inventaire.
Tu peux supposer la presence de condiments basiques: sel, poivre, huile, etc.

Reponds UNIQUEMENT en JSON valide (pas de markdown), sous ce format exact:
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
      "steps": [{"instruction": "Etape detaillee", "duration_minutes": 5}],
      "equipment": ["Four"],
      "tips": ["Astuce utile"],
      "translations": {
        "${otherLangs[0]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"],
          "equipment": ["Translated equipment"]
        },
        "${otherLangs[1]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"],
          "equipment": ["Translated equipment"]
        }
      }
    }
  ]
}

Genere exactement ${totalCount} recettes au total.
Les champs principaux (name, description, ingredients, steps, tips) sont en ${langLabel}.
Le champ "translations" contient les traductions en ${otherLangLabels}.
Pour les traductions d'ingredients, garde le meme ordre et nombre que le tableau principal, avec seulement le champ "name" traduit.
Pour les traductions de steps, garde le meme ordre avec seulement "instruction" traduit.
category, difficulty, prep_time, cook_time, servings restent identiques (pas besoin de les traduire).`

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
        equipment: r.equipment,
      }
      return { ...r, translations }
    })

    return res.status(200).json({ recipes })
  } catch (error) {
    console.error('Suggest recipes error:', error)
    return res.status(500).json({ error: 'Suggestion failed' })
  }
}
