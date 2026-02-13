import { GoogleGenerativeAI } from '@google/generative-ai'

const HISTORY_LIMIT = 20
const MAX_OUTPUT_TOKENS = 500
const TEMPERATURE = 0.7

const SYSTEM_PROMPTS = {
  fr: "Tu es Miam, un assistant culinaire amical. Tu donnes des conseils de cuisine, idees de recettes, et aides a gerer le quotidien alimentaire. Reponds de facon concise et chaleureuse en francais.",
  en: "You are Miam, a friendly culinary assistant. You give cooking tips, recipe ideas, and help manage daily food needs. Respond concisely and warmly in English.",
  zh: "你是Miam，一个友好的烹饪助手。你提供烹饪建议、食谱想法，并帮助管理日常饮食需求。请用中文简洁而温暖地回复。",
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, history, lang } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.fr,
  })

  // Formater l'historique pour Gemini (user/model)
  const safeHistory = Array.isArray(history) ? history : []
  const formattedHistory = safeHistory.slice(-HISTORY_LIMIT).map(msg => ({
    role: msg.is_ai ? 'model' : 'user',
    parts: [{ text: (msg.content || '').replace(/@miam/gi, '').trim() }],
  })).filter(msg => msg.parts[0].text)

  const cleanedMessage = message.replace(/@miam/gi, '').trim()

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE },
    })
    const result = await chat.sendMessage(cleanedMessage)
    return res.status(200).json({ response: result.response.text() })
  } catch (error) {
    console.error('Gemini error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
