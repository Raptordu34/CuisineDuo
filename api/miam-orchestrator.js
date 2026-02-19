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
    description: 'Open the receipt scanner to scan a shopping receipt or photo of products and add them to inventory. Use when user mentions scanning, ticket, receipt, or photo of groceries.',
    parameters: { type: 'object', properties: {} },
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
]

// Actions toujours disponibles, quel que soit l'onglet actif
const ALWAYS_AVAILABLE = ['navigate', 'sendChatMessage']

function buildSystemPrompt(lang, currentPage, context, availableActions) {
  const pageNames = { home: 'accueil/dashboard', inventory: 'inventaire alimentaire', chat: 'chat du foyer' }
  const pageName = pageNames[currentPage] || currentPage

  const actionDescriptions = ALL_TOOL_DECLARATIONS
    .filter(t => ALWAYS_AVAILABLE.includes(t.name) || availableActions.includes(t.name))
    .map(t => `- ${t.name}: ${t.description}`)
    .join('\n')

  const prompts = {
    fr: `Tu es Miam, l'assistant culinaire intelligent de CuisineDuo.
Tu aides ${context.profileName || 'l\'utilisateur'} a gerer son inventaire alimentaire, trouver des idees de recettes, et naviguer dans l'application.

CONTEXTE ACTUEL:
- Page active: ${pageName}
- Actions disponibles que tu peux executer:
${actionDescriptions}

INSTRUCTIONS:
- Sois concis et chaleureux.
- Utilise les actions (function calling) quand c'est pertinent pour repondre a la demande.
- Si l'utilisateur demande d'aller quelque part, utilise navigate.
- Si l'utilisateur est sur une page differente de celle ou se trouve la fonctionnalite, navigue d'abord puis execute l'action.
- Reponds toujours en francais.
- Si tu executes une action, explique brievement ce que tu fais.`,

    en: `You are Miam, CuisineDuo's smart culinary assistant.
You help ${context.profileName || 'the user'} manage their food inventory, find recipe ideas, and navigate the app.

CURRENT CONTEXT:
- Active page: ${pageName}
- Available actions you can execute:
${actionDescriptions}

INSTRUCTIONS:
- Be concise and warm.
- Use actions (function calling) when relevant to fulfill the request.
- If the user asks to go somewhere, use navigate.
- If the user is on a different page from where the feature is, navigate first then execute the action.
- Always respond in English.
- If you execute an action, briefly explain what you're doing.`,

    zh: `你是Miam，CuisineDuo的智能烹饪助手。
你帮助${context.profileName || '用户'}管理食物库存、寻找食谱创意和导航应用。

当前上下文:
- 活动页面: ${pageName}
- 你可以执行的可用操作:
${actionDescriptions}

指示:
- 简洁而温暖。
- 在相关时使用操作（函数调用）来满足请求。
- 如果用户要求去某个地方，使用navigate。
- 如果用户在不同的页面，先导航然后执行操作。
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
