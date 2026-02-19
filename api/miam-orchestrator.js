import { GoogleGenerativeAI } from '@google/generative-ai'

const MAX_OUTPUT_TOKENS = 500
const TEMPERATURE = 0.7

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
          enum: ['/', '/inventory', '/chat'],
          description: 'The route path: / for home, /inventory for inventory, /chat for chat',
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
        name:     { type: 'string', description: 'Product name' },
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
]

// Actions toujours disponibles, quel que soit l'onglet actif
const ALWAYS_AVAILABLE = ['navigate', 'sendChatMessage', 'editLastChatMessage', 'deleteLastChatMessage', 'addInventoryItem']

function buildSystemPrompt(lang, currentPage, context, availableActions) {
  const pageNames = { home: 'accueil/dashboard', inventory: 'inventaire alimentaire', chat: 'chat du foyer' }
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

  const prompts = {
    fr: `Tu es Miam, l'assistant culinaire intelligent de CuisineDuo.
Tu aides ${context.profileName || 'l\'utilisateur'} a gerer son inventaire alimentaire, trouver des idees de recettes, et naviguer dans l'application.

CONTEXTE ACTUEL:
- Page active: ${pageName}
${memberSection}${inventorySection}- Actions disponibles que tu peux executer:
${actionDescriptions}

INSTRUCTIONS:
- Sois concis et chaleureux.
- Utilise les actions (function calling) quand c'est pertinent pour repondre a la demande.
- Si l'utilisateur demande d'aller quelque part, utilise navigate.
- Si l'utilisateur est sur une page differente de celle ou se trouve la fonctionnalite, navigue d'abord puis execute l'action.
- Pour openScanner: utilise source="camera" par defaut. Utilise source="gallery" seulement si l'utilisateur dit explicitement "depuis ma galerie" ou "depuis mes photos".
- Pour editLastChatMessage/deleteLastChatMessage: utilise ces actions si Miam a envoye un message incorrect et l'utilisateur veut le corriger ou le supprimer.
- Pour les actions inventaire (addInventoryItem, updateInventoryItem, consumeInventoryItem): agis directement sans naviguer.
- Reponds toujours en francais.
- Si tu executes une action, explique brievement ce que tu fais.`,

    en: `You are Miam, CuisineDuo's smart culinary assistant.
You help ${context.profileName || 'the user'} manage their food inventory, find recipe ideas, and navigate the app.

CURRENT CONTEXT:
- Active page: ${pageName}
${memberSection}${inventorySection}- Available actions you can execute:
${actionDescriptions}

INSTRUCTIONS:
- Be concise and warm.
- Use actions (function calling) when relevant to fulfill the request.
- If the user asks to go somewhere, use navigate.
- If the user is on a different page from where the feature is, navigate first then execute the action.
- For openScanner: use source="camera" by default. Only use source="gallery" if user explicitly says "from gallery" or "from my photos".
- For editLastChatMessage/deleteLastChatMessage: use these if Miam sent an incorrect message and user wants to fix or remove it.
- For inventory actions (addInventoryItem, updateInventoryItem, consumeInventoryItem): act directly without navigating.
- Always respond in English.
- If you execute an action, briefly explain what you're doing.`,

    zh: `你是Miam，CuisineDuo的智能烹饪助手。
你帮助${context.profileName || '用户'}管理食物库存、寻找食谱创意和导航应用。

当前上下文:
- 活动页面: ${pageName}
${memberSection}${inventorySection}- 你可以执行的可用操作:
${actionDescriptions}

指示:
- 简洁而温暖。
- 在相关时使用操作（函数调用）来满足请求。
- 如果用户要求去某个地方，使用navigate。
- 如果用户在不同的页面，先导航然后执行操作。
- 对于openScanner：默认使用source="camera"。只有当用户明确说"从相册"时才使用source="gallery"。
- 对于库存操作：直接执行，无需导航。
- 始终用中文回复。
- 如果你执行了操作，简要说明你在做什么。`,
  }

  return prompts[lang] || prompts.fr
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: buildSystemPrompt(lang || 'fr', currentPage || 'home', safeContext, safeAvailableActions),
    tools: [{ functionDeclarations: filteredDeclarations }],
  })

  // Formater l'historique
  const safeHistory = Array.isArray(conversationHistory) ? conversationHistory : []
  const formattedHistory = safeHistory.slice(-10).map(msg => ({
    role: msg.role === 'miam' ? 'model' : 'user',
    parts: [{ text: msg.content || '' }],
  })).filter(msg => msg.parts[0].text)

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE },
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

    return res.status(200).json({
      response: responseText || (actions.length > 0 ? getDefaultActionMessage(actions, lang || 'fr') : ''),
      actions,
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
