import { GoogleGenerativeAI } from '@google/generative-ai'

async function isImageAccessible(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch(url, { method: 'HEAD', signal: controller.signal })
    clearTimeout(timeout)
    const contentType = resp.headers.get('content-type') || ''
    return resp.ok && contentType.startsWith('image/')
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipeName, recipeDescription } = req.body
  if (!recipeName) return res.status(400).json({ error: 'Recipe name required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ googleSearch: {} }],
  })

  try {
    const prompt = `Search the web for a high-quality photo of the dish "${recipeName}"${recipeDescription ? ` (${recipeDescription})` : ''}.
I need a direct, publicly accessible image URL of this dish from a cooking website, food blog, or recipe site.
The URL must point directly to an image file (ending in .jpg, .jpeg, .png, or .webp).
Do NOT use images from stock photo sites that require authentication.
Return ONLY the URL, nothing else.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Extract URLs from response
    const urlMatch = text.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp)[^\s"'<>]*/i)
    const candidateUrl = urlMatch?.[0]

    if (candidateUrl && await isImageAccessible(candidateUrl)) {
      return res.status(200).json({ image_url: candidateUrl, found: true })
    }

    // Fallback: try any URL in the response
    const anyUrl = text.match(/https?:\/\/[^\s"'<>]+/i)
    if (anyUrl?.[0] && await isImageAccessible(anyUrl[0])) {
      return res.status(200).json({ image_url: anyUrl[0], found: true })
    }

    return res.status(200).json({ image_url: null, found: false })
  } catch (error) {
    console.error('Image search error:', error)
    return res.status(500).json({ error: 'Image search failed', found: false })
  }
}
