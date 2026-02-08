import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, recipe, history, mode, currentStep, householdTasteProfiles, tasteParams } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

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

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `Tu es Miam, un assistant culinaire expert. Tu aides l'utilisateur avec des questions specifiques sur une recette.
${recipeContext}${cookingContext}${tasteContext}
Reponds de facon concise, precise et chaleureuse. Si l'utilisateur parle anglais ou chinois, reponds dans sa langue.
Tu peux suggerer des substitutions d'ingredients, des variantes, des astuces de cuisson, et repondre a toute question sur la recette.
${modificationInstructions}`,
  })

  const formattedHistory = (history || []).slice(-20).map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    })
    const result = await chat.sendMessage(message)
    const responseText = result.response.text().trim()

    // Try to parse as JSON (modification response)
    const tryParseModification = (text) => {
      try {
        const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
        const parsed = JSON.parse(cleaned)
        if (parsed.updates && parsed.response) return parsed
      } catch {
        // Try to extract JSON from mixed text+JSON response
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
  } catch (error) {
    console.error('Recipe AI chat error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
