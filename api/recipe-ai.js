import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })
  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    switch (action) {
      case 'chat':
        return await handleChat(req, res, genAI)
      case 'edit':
        return await handleEdit(req, res, genAI)
      case 'search':
        return await handleSearch(req, res, genAI)
      case 'generate':
        return await handleGenerate(req, res, genAI)
      case 'translate':
        return await handleTranslate(req, res, genAI)
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error(`Recipe AI error (${action}):`, error)
    return res.status(500).json({ error: 'AI operation failed' })
  }
}

async function handleChat(req, res, genAI) {
  const { message, recipe, history, mode, currentStep, householdTasteProfiles, tasteParams, lang } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const recipeContext = recipe ? `
Voici la recette sur laquelle l'utilisateur te pose des questions :
- Nom : ${recipe.name}
- Description : ${recipe.description || 'N/A'}
- Categorie : ${recipe.category || 'N/A'}
- Portions : ${recipe.servings || 'N/A'}
- Temps de preparation : ${recipe.prep_time ? recipe.prep_time + ' min' : 'N/A'}
- Temps de cuisson : ${recipe.cook_time ? recipe.cook_time + ' min' : 'N/A'}
- Difficulte : ${recipe.difficulty || 'N/A'}
- Equipement : ${JSON.stringify(recipe.equipment || [])}
- Ingredients : ${JSON.stringify(recipe.ingredients || [])}
- Etapes : ${JSON.stringify(recipe.steps || [])}
- Conseils : ${JSON.stringify(recipe.tips || [])}
- Profil gustatif actuel : ${tasteParams ? `Douceur: ${tasteParams.sweetness ?? 'non defini'}/5, Sale: ${tasteParams.saltiness ?? 'non defini'}/5, Epice: ${tasteParams.spiciness ?? 'non defini'}/5, Acide: ${tasteParams.acidity ?? 'non defini'}/5, Amer: ${tasteParams.bitterness ?? 'non defini'}/5, Umami: ${tasteParams.umami ?? 'non defini'}/5, Richesse: ${tasteParams.richness ?? 'non defini'}/5` : 'Non defini'}
` : ''

  let cookingContext = ''
  if (mode === 'cooking' && currentStep != null) {
    const step = recipe?.steps?.find(s => s.order === currentStep + 1) || recipe?.steps?.[currentStep]
    cookingContext = `
L'utilisateur est en MODE CUISINE en train de preparer cette recette. Il est actuellement a l'etape ${currentStep + 1}${step ? ` : "${step.instruction}"` : ''}.
IMPORTANT: Reponds de facon TRES CONCISE (2-3 phrases max). L'utilisateur cuisine activement, il a besoin de reponses rapides et pratiques.
Priorite securite : si la question concerne la cuisson, la temperature ou la manipulation d'aliments, sois precis.`
  }

  const modificationInstructions = `

IMPORTANT - DETECTION DE MODIFICATIONS :
Tu dois distinguer deux types de messages :

1) QUESTIONS / CONVERSATION PURE : l'utilisateur pose une question qui n'implique AUCUN changement a la recette. Exemples : "combien de temps ca prend ?", "c'est quoi le umami ?", "est-ce que je peux congeler ?".
   -> Reponds normalement en texte.

2) DEMANDES DE MODIFICATION : l'utilisateur utilise un verbe d'action impliquant un changement a la recette. VERBES DECLENCHEURS : ajoute, retire, supprime, remplace, modifie, change, mets, augmente, diminue, reduis, double, triple, enleve, insere, rajoute, adapte, transforme, convertis, ajuste.
   Exemples :
   - "ajoute un conseil" -> JSON avec tips mis a jour
   - "remplace le beurre par de l'huile" -> JSON avec ingredients mis a jour
   - "change le temps de cuisson a 30 min" -> JSON avec cook_time mis a jour
   - "ajoute une etape de marinade au debut" -> JSON avec steps mis a jour
   - "adapte pour 6 personnes" -> JSON avec servings et ingredients mis a jour
   - "mets a jour le profil gustatif" -> JSON avec _tasteParams deduits du contenu de la recette
   - "c'est une recette tres epicee" -> JSON avec _tasteParams (spiciness eleve)
   - "ajoute les parametres gustatifs" -> JSON avec _tasteParams deduits des ingredients et du type de plat

   -> Reponds OBLIGATOIREMENT avec un JSON valide (PAS de markdown, PAS de backticks, JSON BRUT uniquement) :
   {
     "response": "ton message de confirmation en texte",
     "updates": {
       // UNIQUEMENT les champs modifies.
       // Champs scalaires : name, description, category, servings, prep_time, cook_time, difficulty
       // Champs tableau (retourner le tableau COMPLET) :
       //   equipment: [{name}]
       //   ingredients: [{name, quantity, unit, optional}]
       //   steps: [{instruction, duration}]
       //   tips: [{text}]
       // Profil gustatif (objet, valeurs de 1 a 5 ou null si non applicable) :
       //   _tasteParams: { sweetness, saltiness, spiciness, acidity, bitterness, umami, richness }
     },
     "summary": "resume court des modifications"
   }

Pour _tasteParams : deduis les valeurs a partir des ingredients, du type de plat, et du contexte de la recette. Utilise une echelle de 1 (tres faible) a 5 (tres intense). Mets null pour les dimensions non pertinentes.

REGLE PAR DEFAUT : En cas de doute entre conversation et modification, retourne le JSON de modification. Il vaut mieux proposer une modification que l'utilisateur peut confirmer ou annuler, plutot que de simplement decrire ce qu'il faudrait faire.

IMPORTANT: All recipe content in updates (name, description, ingredient names, step instructions, tip texts, equipment names) MUST be written in English, regardless of the conversation language. Only the "response" and "summary" fields should be in the user's language.

IMPORTANT : Ne mets JAMAIS le JSON dans des blocs de code markdown. Retourne le JSON brut directement.`

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

PROFILS GUSTATIFS DU FOYER (informatif, pour contextualiser tes suggestions) :
${profileLines}
Utilise ces informations pour adapter tes suggestions si pertinent (ex: si quelqu'un n'aime pas le piquant, le mentionner).`
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `Tu es Miam, un assistant culinaire expert. Tu aides l'utilisateur avec des questions specifiques sur une recette.
${recipeContext}${cookingContext}${tasteContext}
Reponds de facon concise, precise et chaleureuse. Reponds dans la langue de l'utilisateur (${lang || 'fr'}).
Tu peux suggerer des substitutions d'ingredients, des variantes, des astuces de cuisson, et repondre a toute question sur la recette.
${modificationInstructions}`,
  })

  const formattedHistory = (history || []).slice(-20).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  const chat = model.startChat({
    history: formattedHistory,
    generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
  })
  const result = await chat.sendMessage(message)
  const responseText = result.response.text().trim()

  const tryParseModification = (text) => {
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      const parsed = JSON.parse(cleaned)
      if (parsed.updates && parsed.response) return parsed
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*"updates"\s*:\s*\{[\s\S]*\}[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.updates && parsed.response) return parsed
        } catch { /* not valid JSON */ }
      }
    }
    return null
  }

  const modification = tryParseModification(responseText)
  if (modification) {
    return res.status(200).json({
      response: modification.response,
      updates: modification.updates,
      summary: modification.summary || '',
    })
  }

  return res.status(200).json({ response: responseText })
}

async function handleEdit(req, res, genAI) {
  const { text, context, lang, recipe, useSearch } = req.body
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
    // ONLY include fields that changed.
  },
  "summary": "brief description of what was changed"
}

If you need information from the internet, return ONLY:
{ "search_needed": true, "search_query": "the search query to perform", "search_reason": "brief explanation" }`

  if (useSearch || context === 'recipe-edit-search') {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `${baseInstruction}
You have access to Google Search to look up information. Return ONLY the JSON object, no markdown fences.`,
      tools: [{ googleSearch: {} }],
    })
    const result = await model.generateContent(text)
    const responseText = result.response.text().trim()
    const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    return res.status(200).json(JSON.parse(jsonStr))
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `${baseInstruction}\n${jsonSchema}`,
  })
  const result = await model.generateContent(text)
  return res.status(200).json(JSON.parse(result.response.text()))
}

async function handleSearch(req, res, genAI) {
  const { text, lang, recipes, householdTasteProfiles } = req.body
  
  let tasteContext = ''
  if (householdTasteProfiles && householdTasteProfiles.length > 0) {
    const profileLines = householdTasteProfiles.map(p => {
      const tp = p.tasteProfile
      const prefs = Object.entries(tp).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}/5`).join(', ')
      return `- ${p.displayName} (${p.ratingsCount} recettes notees): ${prefs}`
    }).join('\n')
    tasteContext = `\nPROFILS GUSTATIFS DU FOYER :\n${profileLines}`
  }

  const recipeSummary = (recipes || []).map(r =>
    `- id:${r.id} | ${r.name} | ${r.category || ''} | ${r.description || ''} | ${r.ingredients_summary || ''}`
  ).join('\n')

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `You are a recipe search assistant. User speaks in "${lang || 'fr'}". 
1. Search through existing recipes and find matches.
2. Suggest 3 new recipe ideas in English.
Existing recipes:
${recipeSummary || 'No recipes yet.'}
${tasteContext}
Return JSON: { matching_recipes: [], suggestions: [], summary: "" }`,
  })

  const result = await model.generateContent(text)
  return res.status(200).json(JSON.parse(result.response.text()))
}

async function handleGenerate(req, res, genAI) {
  const { text, description, householdTasteProfiles } = req.body
  
  let tasteContext = ''
  if (householdTasteProfiles && householdTasteProfiles.length > 0) {
    const profileLines = householdTasteProfiles.map(p => {
      const tp = p.tasteProfile
      const prefs = Object.entries(tp).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${Math.round(v * 10) / 10}/5`).join(', ')
      return `- ${p.displayName}: ${prefs}`
    }).join('\n')
    tasteContext = `\nHousehold taste profiles:\n${profileLines}`
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
    systemInstruction: `You are a professional chef. Generate a complete recipe in English. All fields must be in English.
Return JSON: { recipe: { name, description, category, servings, prep_time, cook_time, difficulty, equipment, ingredients, steps, tips, taste_params } }
${tasteContext}`,
  })

  const prompt = description ? `Generate recipe for "${text}". Description: ${description}` : `Generate recipe for "${text}".`
  const result = await model.generateContent(prompt)
  const responseText = result.response.text().trim()
  const jsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return res.status(200).json(JSON.parse(jsonStr))
}

async function handleTranslate(req, res, genAI) {
  const { recipe_id, recipe_data, lang } = req.body
  if (!lang || !['fr', 'zh'].includes(lang)) return res.status(400).json({ error: 'lang must be fr or zh' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  let dataToTranslate = recipe_data

  if (recipe_id && supabaseUrl && supabaseKey) {
    try {
      const cacheResp = await fetch(`${supabaseUrl}/rest/v1/recipe_translations?recipe_id=eq.${recipe_id}&lang=eq.${lang}&select=translated_data`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      })
      if (cacheResp.ok) {
        const cached = await cacheResp.json()
        if (cached.length > 0) return res.status(200).json({ translated_data: cached[0].translated_data, from_cache: true })
      }
      
      const recipeResp = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${recipe_id}&select=name,description,ingredients,steps,tips,equipment`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      })
      if (recipeResp.ok) {
        const recipes = await recipeResp.json()
        if (recipes.length > 0) dataToTranslate = recipes[0]
      }
    } catch {}
  }

  if (!dataToTranslate) return res.status(400).json({ error: 'No recipe data' })

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `Translate recipe textual fields to ${lang === 'fr' ? 'French' : 'Chinese'}. Keep JSON structure.`
  })

  const translationInput = {
    name: dataToTranslate.name || '',
    description: dataToTranslate.description || '',
    ingredients: (dataToTranslate.ingredients || []).map(ing => ({ name: ing.name })),
    steps: (dataToTranslate.steps || []).map(step => ({ instruction: step.instruction })),
    tips: (dataToTranslate.tips || []).map(tip => ({ text: tip.text })),
    equipment: (dataToTranslate.equipment || []).map(eq => ({ name: eq.name })),
  }

  const result = await model.generateContent(JSON.stringify(translationInput))
  const translatedData = JSON.parse(result.response.text())

  if (recipe_id && supabaseUrl && supabaseKey) {
    fetch(`${supabaseUrl}/rest/v1/recipe_translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ recipe_id, lang, translated_data: translatedData })
    }).catch(() => {})
  }

  return res.status(200).json({ translated_data: translatedData, from_cache: false })
}