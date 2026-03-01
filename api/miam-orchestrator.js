import { GoogleGenerativeAI } from '@google/generative-ai'

const MAX_OUTPUT_TOKENS = 500
const TEMPERATURE = 0.3

// Toutes les declarations de fonctions disponibles
const ALL_TOOL_DECLARATIONS = [
  {
    name: 'navigate',
    description: 'Navigate to a different page in the application. Use this when the user asks to go to a specific section.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          enum: ['/', '/inventory', '/recipes', '/chat'],
          description: 'The route path: / for home, /inventory for inventory, /recipes for recipes, /chat for chat',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'openAddItem',
    description: 'Open the modal to manually add a new item to the food inventory. Use when user wants to add a product.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'openScanner',
    description: 'Open the scanner to scan a receipt/ticket or photo of products. Use source="camera" by default when user wants to scan in real time (most common for receipts). Use source="gallery" ONLY if user explicitly mentions gallery, library, or existing photos. Use mode="receipt" for paper shopping receipts, mode="photo" for product photos, mode="auto" to detect automatically.',
    parameters: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['camera', 'gallery'],
          description: 'Where to get the image from. Default: camera (most natural for scanning receipts).',
        },
        mode: {
          type: 'string',
          enum: ['receipt', 'photo', 'auto'],
          description: 'Scan mode. receipt = shopping ticket, photo = product photo, auto = let AI decide.',
        },
      },
    },
  },
  {
    name: 'filterCategory',
    description: 'Filter the inventory list by a specific food category.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other'],
          description: 'The category to filter by, or "all" to show everything',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'sendChatMessage',
    description: 'Send a message in the household chat on behalf of the user. Use when user asks to send/tell something to their household members.',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The message text to send in the chat',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'editLastChatMessage',
    description: 'Edit the last message Miam sent to the household chat. Use when the user asks to correct, change, or modify the last message that was sent.',
    parameters: {
      type: 'object',
      properties: {
        newContent: {
          type: 'string',
          description: 'The new content to replace the last Miam chat message with',
        },
      },
      required: ['newContent'],
    },
  },
  {
    name: 'deleteLastChatMessage',
    description: 'Delete the last message Miam sent to the household chat. Use when user asks to cancel, remove, or undo the last message sent.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'addInventoryItem',
    description: 'Add a new item directly to the household food inventory without scanning. Use when user describes a product they want to add.',
    parameters: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Product name (in the language of the user)' },
        name_translations: { type: 'object', description: 'Object containing translations of the product name in French (fr), English (en), and Chinese (zh). Example: {"fr":"Pomme","en":"Apple","zh":"苹果"}' },
        quantity: { type: 'number', description: 'Quantity (default: 1)' },
        unit:     { type: 'string', enum: ['piece', 'kg', 'g', 'l', 'ml', 'pack'], description: 'Unit of measurement' },
        category: {
          type: 'string',
          enum: ['dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other'],
          description: 'Food category',
        },
        brand: { type: 'string', description: 'Brand name (optional)' },
        store: { type: 'string', description: 'Store where purchased (optional)' },
      },
      required: ['name', 'quantity', 'unit', 'category'],
    },
  },
  {
    name: 'updateInventoryItem',
    description: 'Update fields of an existing inventory item by name (fuzzy match). Use when user wants to change quantity, fill level, brand, price, etc. of an item that already exists.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the item to update (fuzzy match against inventory)' },
        fields: {
          type: 'object',
          description: 'Fields to update. Allowed keys: name, brand, quantity, unit, price, fill_level (1=full, 0.75=3/4, 0.5=half, 0.25=quarter), category, store, notes',
        },
      },
      required: ['name', 'fields'],
    },
  },
  {
    name: 'consumeInventoryItem',
    description: 'Mark an inventory item as fully consumed and remove it from inventory. Records it in consumption history. Use when user says an item is finished, empty, used up, or consumed.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the item to consume (fuzzy match against inventory)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'deleteInventoryItem',
    description: 'Permanently delete an inventory item WITHOUT recording it in consumption history. Use only when user explicitly wants to remove/delete an item (not consume it). If the user says "finished" or "used up", prefer consumeInventoryItem instead.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the item to delete permanently (fuzzy match against inventory)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'updateScanItem',
    description: 'Update fields of a scanned item in the scan review list by its index. Use when user wants to change the name, price, quantity, category, etc. of a scanned item.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Zero-based index of the item in the scan list' },
        fields: {
          type: 'object',
          description: 'Fields to update. Allowed keys: name, brand, quantity, unit, price, price_per_kg, category, store',
        },
      },
      required: ['index', 'fields'],
    },
  },
  {
    name: 'removeScanItem',
    description: 'Remove a scanned item from the scan review list by its index. Use when user wants to delete/remove an item from the scan results.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Zero-based index of the item to remove from the scan list' },
      },
      required: ['index'],
    },
  },
  {
    name: 'addScanItem',
    description: 'Add a new item to the scan review list. Use when user wants to add a product that was missed by the scan.',
    parameters: {
      type: 'object',
      properties: {
        item: {
          type: 'object',
          description: 'The item to add with fields: name, quantity, unit, category, price (optional), brand (optional), store (optional)',
        },
      },
      required: ['item'],
    },
  },
  {
    name: 'addRecipe',
    description: 'Add a new recipe to the household cookbook. Use when user describes a recipe to add.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Recipe name' },
        description: { type: 'string', description: 'Short description of the recipe' },
        category: { type: 'string', enum: ['appetizer', 'main', 'dessert', 'snack', 'drink', 'other'], description: 'Recipe category' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Difficulty level' },
        prep_time: { type: 'number', description: 'Preparation time in minutes' },
        cook_time: { type: 'number', description: 'Cooking time in minutes' },
        servings: { type: 'number', description: 'Number of servings' },
        ingredients: { type: 'array', description: 'Array of {name, quantity, unit} objects', items: { type: 'object' } },
        steps: { type: 'array', description: 'Array of {instruction, duration_minutes?} objects', items: { type: 'object' } },
        equipment: { type: 'array', description: 'Array of equipment strings', items: { type: 'string' } },
        tips: { type: 'array', description: 'Array of tip strings', items: { type: 'string' } },
      },
      required: ['name', 'category', 'difficulty', 'ingredients', 'steps'],
    },
  },
  {
    name: 'deleteRecipe',
    description: 'Delete a recipe from the household cookbook by name (fuzzy match).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe to delete (fuzzy match)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'rateRecipe',
    description: 'Rate a recipe (1-5 stars). Use when user rates or scores a recipe.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe to rate (fuzzy match)' },
        rating: { type: 'number', description: 'Rating from 1 to 5' },
      },
      required: ['name', 'rating'],
    },
  },
  {
    name: 'addRecipeComment',
    description: 'Add a comment to a recipe. Use when user wants to leave a note or comment on a recipe.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe (fuzzy match)' },
        content: { type: 'string', description: 'The comment text' },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'updateRecipeStep',
    description: 'Update a specific step of a recipe. Use when user wants to change or improve a recipe instruction.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe (fuzzy match)' },
        stepIndex: { type: 'number', description: 'Zero-based index of the step to update' },
        newInstruction: { type: 'string', description: 'The new instruction text for this step' },
      },
      required: ['name', 'stepIndex', 'newInstruction'],
    },
  },
  {
    name: 'addRecipeTip',
    description: 'Add a tip or trick to a recipe. Use when user shares cooking advice for a recipe.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe (fuzzy match)' },
        tip: { type: 'string', description: 'The tip text to add' },
      },
      required: ['name', 'tip'],
    },
  },
  {
    name: 'updateRecipeInfo',
    description: 'Update general info of a recipe (name, description, category, difficulty, prep_time, cook_time, servings). Use when user wants to change recipe metadata.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the recipe to update (fuzzy match)' },
        fields: { type: 'object', description: 'Fields to update. Allowed keys: name, description, category, difficulty, prep_time, cook_time, servings' },
      },
      required: ['name', 'fields'],
    },
  },
  {
    name: 'suggestRecipes',
    description: 'Suggest recipes based on the current household inventory. Use when user asks for recipe ideas or what to cook.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'updateTasteProfile',
    description: 'Update the user\'s taste profile. Use when the user mentions taste preferences, spice tolerance, or rates a dish. Adjustments should be incremental (values 1-5).',
    parameters: {
      type: 'object',
      properties: {
        sweetness: { type: 'number', description: 'Sweetness tolerance (1-5)' },
        saltiness: { type: 'number', description: 'Saltiness tolerance (1-5)' },
        spiciness: { type: 'number', description: 'Spiciness tolerance (1-5)' },
        acidity: { type: 'number', description: 'Acidity tolerance (1-5)' },
        bitterness: { type: 'number', description: 'Bitterness tolerance (1-5)' },
        umami: { type: 'number', description: 'Umami affinity (1-5)' },
        richness: { type: 'number', description: 'Richness affinity (1-5)' },
      },
    },
  },
]

// Actions toujours disponibles, quel que soit l'onglet actif
const ALWAYS_AVAILABLE = ['navigate', 'sendChatMessage', 'editLastChatMessage', 'deleteLastChatMessage', 'addInventoryItem', 'updateInventoryItem', 'consumeInventoryItem', 'deleteInventoryItem', 'addRecipe', 'deleteRecipe', 'rateRecipe', 'addRecipeComment', 'updateRecipeStep', 'addRecipeTip', 'updateRecipeInfo', 'suggestRecipes', 'updateTasteProfile']

function buildSystemPrompt(lang, currentPage, context, availableActions) {
  const pageNames = { home: 'accueil/dashboard', inventory: 'inventaire alimentaire', recipes: 'recettes du foyer', chat: 'chat du foyer' }
  const pageName = pageNames[currentPage] || currentPage

  const actionDescriptions = ALL_TOOL_DECLARATIONS
    .filter(t => ALWAYS_AVAILABLE.includes(t.name) || availableActions.includes(t.name))
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n')

  // Sections contextuelles
  const memberSection = context.householdMembers?.length
    ? `- Membres du foyer: ${context.householdMembers.map(m => m.display_name).join(', ')}\n`
    : ''

  const inventorySection = context.inventoryItems?.length
    ? `- Inventaire (${context.inventoryItems.length} articles): ${context.inventoryItems.slice(0, 20).map(i => `${i.name}${i.brand ? ' (' + i.brand + ')' : ''}`).join(', ')}${context.inventoryItems.length > 20 ? '...' : ''}\n`
    : ''

  const recipesSection = context.recipes?.length
    ? `- Recettes du foyer (${context.recipes.length}): ${context.recipes.slice(0, 15).map(r => r.name).join(', ')}${context.recipes.length > 15 ? '...' : ''}\n`
    : ''

  const tasteProfileSection = context.tasteProfile
    ? `- Profil gustatif: ${Object.entries(context.tasteProfile).filter(([k, v]) => v != null && !['banned_ingredients', 'dietary_restrictions', 'notes', 'additional_notes'].includes(k)).map(([k, v]) => `${k}: ${v}/5`).join(', ')}${context.tasteProfile.banned_ingredients?.length ? ` | Bannis: ${context.tasteProfile.banned_ingredients.join(', ')}` : ''}${context.tasteProfile.dietary_restrictions?.length ? ` | Restrictions: ${context.tasteProfile.dietary_restrictions.join(', ')}` : ''}\n`
    : ''

  const scanReviewSection = context.scanReviewItems?.mode === 'scanReview'
    ? `\nMODE VERIFICATION SCAN ACTIF — L'utilisateur verifie des articles scannes. Tu peux utiliser updateScanItem, removeScanItem, addScanItem pour modifier la liste.\nArticles scannes:\n${context.scanReviewItems.items.map((item, i) => `  [${i}] ${item.name}${item.brand ? ' (' + item.brand + ')' : ''} — ${item.quantity} ${item.unit}, ${item.price != null ? item.price + ' EUR' : 'prix inconnu'}, cat: ${item.category}${item.checked ? '' : ' (deselectionne)'}`).join('\n')}\n`
    : ''

  const categoryGuide = `
CORRESPONDANCES CATEGORIE (a utiliser pour les suppositions):
- Laitier/dairy: yaourt, fromage, lait, beurre, creme, oeuf
- Viande/meat: poulet, boeuf, porc, agneau, veau, dinde, jambon, saucisse
- Poisson/fish: saumon, thon, cabillaud, crevette, moule
- Legumes/vegetables: tomate, carotte, poireau, courgette, salade, oignon, ail, brocoli, poivron
- Fruits/fruits: pomme, banane, orange, fraise, raisin, peche, poire
- Feculent/grains: riz, pates, farine, pain, cereales, avoine, lentille, pois
- Boulangerie/bakery: pain, baguette, brioche, croissant, gateau, biscuit
- Surgele/frozen: pizza, glace, surimi
- Boisson/beverages: eau, jus, soda, biere, vin, cafe, the
- Snack/snacks: chips, bonbon, chocolat, noix, graine
- Condiment/condiments: sel, sucre, huile, vinaigre, sauce, mayonnaise, moutarde, ketchup, epice
- Autre/other: tout le reste`

  const prompts = {
    fr: `Tu es Miam, l'assistant culinaire intelligent de CuisineDuo.
Tu aides ${context.profileName || 'l\'utilisateur'} a gerer son inventaire alimentaire, trouver des idees de recettes, et naviguer dans l'application.

CONTEXTE ACTUEL:
- Page active: ${pageName}
${memberSection}${inventorySection}${recipesSection}${tasteProfileSection}${scanReviewSection}
ACTIONS DISPONIBLES:
${actionDescriptions}

REGLES ABSOLUES — NE JAMAIS ENFREINDRE:
1. AGIS TOUJOURS IMMEDIATEMENT via function calling. Ne dis JAMAIS que tu vas faire quelque chose sans appeler la fonction correspondante dans le meme message. "J'ajoute les yaourts" sans appeler addInventoryItem = INTERDIT.
2. Ne pose JAMAIS de question de confirmation avant d'agir (pas de "Es-tu sur ?", "De quelle categorie ?", etc.).
3. Si des infos manquent (categorie, unite, quantite), fais des suppositions intelligentes immediatement. Exemple: "yaourt" → dairy, piece; "lait" → dairy, l; "pates" → grains, pack. Ne bloque jamais sur une info manquante.
4. Pour supprimer/consommer un item: agis directement. Si ambigu entre delete et consume, prefere consumeInventoryItem.
5. Sois tres concis dans ta reponse texte (1 phrase max). L'action parle d'elle-meme.
${categoryGuide}

AUTRES INSTRUCTIONS:
- Si l'utilisateur demande d'aller quelque part, utilise navigate.
- Pour openScanner: source="camera" par defaut, source="gallery" seulement si explicitement demande.
- Reponds toujours en francais.`,

    en: `You are Miam, CuisineDuo's smart culinary assistant.
You help ${context.profileName || 'the user'} manage their food inventory, find recipe ideas, and navigate the app.

CURRENT CONTEXT:
- Active page: ${pageName}
${memberSection}${inventorySection}${recipesSection}${tasteProfileSection}${scanReviewSection}
AVAILABLE ACTIONS:
${actionDescriptions}

ABSOLUTE RULES — NEVER BREAK THESE:
1. ALWAYS ACT IMMEDIATELY via function calling. NEVER say you will do something without calling the corresponding function in the same message. Saying "I'll add the yogurts" without calling addInventoryItem = FORBIDDEN.
2. NEVER ask confirmation questions before acting (no "Are you sure?", "What category?", etc.).
3. If info is missing (category, unit, quantity), make smart assumptions immediately. Example: "yogurt" → dairy, piece; "milk" → dairy, l; "pasta" → grains, pack. Never block on missing info.
4. For delete/consume: act directly. When ambiguous between delete and consume, prefer consumeInventoryItem.
5. Keep your text response very short (1 sentence max). The action speaks for itself.
${categoryGuide}

OTHER INSTRUCTIONS:
- If the user asks to go somewhere, use navigate.
- For openScanner: use source="camera" by default, source="gallery" only if explicitly asked.
- Always respond in English.`,

    zh: `你是Miam，CuisineDuo的智能烹饪助手。
你帮助${context.profileName || '用户'}管理食物库存、寻找食谱创意和导航应用。

当前上下文:
- 活动页面: ${pageName}
${memberSection}${inventorySection}${recipesSection}${tasteProfileSection}${scanReviewSection}
可用操作:
${actionDescriptions}

绝对规则 — 永远不要违反:
1. 始终通过函数调用立即行动。永远不要说你会做某事而不在同一条消息中调用相应的函数。
2. 行动前永远不要问确认问题。
3. 如果信息缺失（类别、单位、数量），立即做出智能假设。例如："酸奶" → dairy, piece；"牛奶" → dairy, l。
4. 对于删除/消费：直接行动。模糊时优先使用consumeInventoryItem。
5. 文本回复非常简短（最多1句话）。
${categoryGuide}

其他指示:
- 如果用户要求去某个地方，使用navigate。
- 对于openScanner：默认source="camera"。
- 始终用中文回复。`,
  }

  return prompts[lang] || prompts.fr
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verification auth basique
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { message, lang, currentPage, availableActions, conversationHistory, context } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const safeAvailableActions = Array.isArray(availableActions) ? availableActions : []
  const safeContext = context || {}

  // Filtrer les tools selon les actions disponibles
  const filteredDeclarations = ALL_TOOL_DECLARATIONS.filter(
    t => ALWAYS_AVAILABLE.includes(t.name) || safeAvailableActions.includes(t.name)
  )

  const systemPrompt = buildSystemPrompt(lang || 'fr', currentPage || 'home', safeContext, safeAvailableActions)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: filteredDeclarations }],
  })

  // Formater l'historique en respectant le format Gemini pour le function calling.
  // Un tour Miam avec actions doit être décomposé en :
  //   1. model[functionCall parts]
  //   2. user[functionResponse parts]   ← requis par l'API Gemini
  //   3. model[text]                     ← réponse textuelle (si présente)
  const safeHistory = Array.isArray(conversationHistory) ? conversationHistory : []
  const formattedHistory = []
  for (const msg of safeHistory.slice(-20)) {
    if (msg.role === 'miam' || msg.role === 'model') {
      const hasActions = Array.isArray(msg.actions) && msg.actions.length > 0
      if (hasActions) {
        // Turn 1 : appels de fonction du modèle
        formattedHistory.push({
          role: 'model',
          parts: msg.actions.map(a => ({
            functionCall: { name: a.name, args: a.args || {} },
          })),
        })
        // Turn 2 : réponses des fonctions (côté "user" dans le protocole Gemini)
        formattedHistory.push({
          role: 'user',
          parts: msg.actions.map(a => ({
            functionResponse: {
              name: a.name,
              response: a.result || { success: true },
            },
          })),
        })
        // Turn 3 : réponse textuelle du modèle (si présente)
        if (msg.content) {
          formattedHistory.push({ role: 'model', parts: [{ text: msg.content }] })
        }
      } else if (msg.content) {
        formattedHistory.push({ role: 'model', parts: [{ text: msg.content }] })
      }
    } else {
      // Message utilisateur
      if (msg.content) {
        formattedHistory.push({ role: 'user', parts: [{ text: msg.content }] })
      }
    }
  }
  // Gemini exige que l'historique commence par un tour "user" et alterne user/model
  // On retire les éventuels tours model en tête de liste
  while (formattedHistory.length > 0 && formattedHistory[0].role !== 'user') {
    formattedHistory.shift()
  }

  const generationConfig = { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE }

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig,
    })

    const result = await chat.sendMessage(message)
    const response = result.response

    // Extraire les appels de fonction et le texte
    const actions = []
    const textParts = []

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.functionCall) {
          actions.push({
            name: part.functionCall.name,
            args: part.functionCall.args || {},
          })
        }
        if (part.text) {
          textParts.push(part.text)
        }
      }
    }

    const responseText = textParts.join('\n').trim()

    // Debug data for logging
    const debug = {
      systemPrompt,
      toolDeclarations: filteredDeclarations.map(d => d.name),
      conversationHistory: formattedHistory,
      model: 'gemini-2.0-flash',
      generationConfig,
      rawResponse: response.candidates || [],
      userMessage: message,
    }

    return res.status(200).json({
      response: responseText || (actions.length > 0 ? getDefaultActionMessage(actions, lang || 'fr') : ''),
      actions,
      debug,
    })
  } catch (error) {
    console.error('Miam orchestrator error:', error)
    return res.status(500).json({ error: 'Orchestrator failed' })
  }
}

function getDefaultActionMessage(actions, lang) {
  const messages = {
    fr: 'C\'est fait !',
    en: 'Done!',
    zh: '完成！',
  }
  return messages[lang] || messages.fr
}
