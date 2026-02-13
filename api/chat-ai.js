import { GoogleGenerativeAI } from '@google/generative-ai'

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { message, history } = req.body
  if (!message) return res.status(400).json({ error: 'Message required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: "Tu es Miam, un assistant culinaire amical. Tu donnes des conseils de cuisine, idees de recettes, et aides a gerer le quotidien alimentaire. Reponds de facon concise et chaleureuse. Si l'utilisateur parle anglais ou chinois, reponds dans sa langue.",
  })

  // Formater l'historique pour Gemini (user/model)
  const safeHistory = Array.isArray(history) ? history : []
  const formattedHistory = safeHistory.slice(-20).map(msg => ({
    role: msg.is_ai ? 'model' : 'user',
    parts: [{ text: (msg.content || '').replace(/@miam/gi, '').trim() }],
  })).filter(msg => msg.parts[0].text)

  const cleanedMessage = message.replace(/@miam/gi, '').trim()

  try {
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
    })
    const result = await chat.sendMessage(cleanedMessage)
    return res.status(200).json({ response: result.response.text() })
  } catch (error) {
    console.error('Gemini error:', error)
    return res.status(500).json({ error: 'AI generation failed' })
  }
}
