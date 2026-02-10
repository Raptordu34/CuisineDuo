import { GoogleGenerativeAI } from '@google/generative-ai'

const VALID_CATEGORIES = ['dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other']
const VALID_UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action } = req.body
  const apiKey = (action === 'scan') ? process.env.GEMINI_SCAN_API_KEY : process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })
  const genAI = new GoogleGenerativeAI(apiKey)

  try {
    switch (action) {
      case 'scan':
        return await handleScan(req, res, genAI)
      case 'refine-scan':
        return await handleRefineScan(req, res, genAI)
      case 'correct-transcription':
        return await handleCorrectTranscription(req, res, genAI)
      case 'generate-shopping-list':
        return await handleGenerateShoppingList(req, res, genAI)
      default:
        return res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error(`Inventory AI error (${action}):`, error)
    return res.status(500).json({ error: 'AI operation failed' })
  }
}

// Logic for handleScan (formerly scan-receipt.js)
async function handleScan(req, res, genAI) {
  const { image, mimeType, lang, mode: rawMode } = req.body
  const mode = ['receipt', 'photo', 'auto'].includes(rawMode) ? rawMode : 'auto'
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const langInstruction = lang === 'zh' ? 'Respond with product names in Chinese.' : lang === 'en' ? 'Respond with product names in English.' : 'Respond with product names in French.'
  
  const prompt = buildScanPrompt(mode, langInstruction)
  const imageData = { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } }
  
  const result = await model.generateContent([{ text: prompt }, imageData])
  const text = result.response.text()
  let parsed = parseGeminiScanResponse(text)
  let items = cleanScanItems(parsed.items, mode)
  let receiptTotal = parsed.receipt_total

  // Retry logic for mismatched totals (simplified port)
  if (receiptTotal != null) {
    const computed = items.reduce((sum, item) => sum + (item.price ?? 0), 0)
    if (Math.abs(computed - receiptTotal) > 0.50) {
      const corrPrompt = `Re-analyze the receipt carefully and correct individual prices to match total ${receiptTotal}. Current items: ${JSON.stringify(items)}. Return JSON {items:[], receipt_total:number}.`
      const corrResult = await model.generateContent([{ text: corrPrompt }, imageData])
      const corrParsed = parseGeminiScanResponse(corrResult.response.text())
      items = cleanScanItems(corrParsed.items, mode)
      receiptTotal = corrParsed.receipt_total || receiptTotal
    }
  }

  return res.status(200).json({ items, receipt_total: receiptTotal })
}

function buildScanPrompt(mode, langInstruction) {
  const commonSchema = `Each item must have: name, brand, quantity, unit (piece, kg, g, l, ml, pack), price, price_per_kg, price_estimated, category, estimated_expiry_days, store.`
  if (mode === 'receipt') return `Analyze receipt image. Extract all items. Return JSON { items: [], receipt_total: number }. ${commonSchema} ${langInstruction}`
  if (mode === 'photo') return `Identify products in photo. Estimate prices. Return JSON { items: [], receipt_total: null }. ${commonSchema} ${langInstruction}`
  return `Analyze image (receipt or photo). Return JSON { items: [], receipt_total: number/null }. ${commonSchema} ${langInstruction}`
}

function parseGeminiScanResponse(text) {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return { items: parsed, receipt_total: null }
    return { items: Array.isArray(parsed.items) ? parsed.items : [], receipt_total: parsed.receipt_total }
  } catch { return { items: [], receipt_total: null } }
}

function cleanScanItems(rawItems, mode) {
  return rawItems.filter(item => item && item.name).map(item => ({
    name: String(item.name).trim(),
    brand: item.brand ? String(item.brand).trim() : null,
    quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
    unit: VALID_UNITS.includes(item.unit) ? item.unit : 'piece',
    price: typeof item.price === 'number' ? item.price : null,
    price_per_kg: typeof item.price_per_kg === 'number' ? item.price_per_kg : null,
    price_estimated: mode === 'photo' ? true : !!item.price_estimated,
    category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
    estimated_expiry_days: typeof item.estimated_expiry_days === 'number' ? item.estimated_expiry_days : null,
    store: item.store ? String(item.store).trim() : null,
  }))
}

// Logic for handleRefineScan (formerly scan-photo-inventory.js)
async function handleRefineScan(req, res, genAI) {
  const { message, items, existingInventory, history, lang } = req.body
  const inventoryContext = existingInventory?.length ? `Stock: ${existingInventory.map(i => i.name).join(', ')}` : ''
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `Inventory assistant. Refine scanned items list based on user message. Return JSON { response: "", items: [], duplicates: [indices] }. ${inventoryContext}`
  })
  const formattedHistory = (history || []).map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }))
  const chat = model.startChat({ history: formattedHistory })
  const result = await chat.sendMessage(message || "Analyze items")
  const responseText = result.response.text().trim()
  const cleaned = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return res.status(200).json(JSON.parse(cleaned))
}

// Logic for handleCorrectTranscription (formerly correct-transcription.js)
async function handleCorrectTranscription(req, res, genAI) {
  const { text, context, lang, items, chatHistory } = req.body
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  
  if (context === 'chat') {
    model.systemInstruction = `Speech-to-text correction for chat. Language ${lang}. Keep meaning, fix errors. Reply with corrected text ONLY.`
    const result = await model.generateContent(text)
    return res.status(200).json({ corrected: result.response.text().trim() })
  }

  if (context === 'scan-correction' || context === 'inventory-update' || context === 'inventory-update-search') {
    const config = (context === 'inventory-update-search') ? { tools: [{ googleSearch: {} }] } : { generationConfig: { responseMimeType: 'application/json' } }
    const instr = context === 'scan-correction' 
      ? `Command interpreter for grocery scan. Return JSON { items: [], changes: "" }.` 
      : `Command interpreter for inventory update. Return JSON { updates: [], summary: "" }.`
    
    const m = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', ...config, systemInstruction: instr })
    const result = await m.generateContent(`Context: ${context}, Language: ${lang}, Items: ${JSON.stringify(items)}. Command: ${text}`)
    const respText = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    return res.status(200).json(JSON.parse(respText))
  }

  return res.status(400).json({ error: 'Invalid context' })
}

// Logic for handleGenerateShoppingList (formerly generate-shopping-list.js)
async function handleGenerateShoppingList(req, res, genAI) {
  const { recipe_ids, household_id, list_name, session_id, lang, inventory_items, recipes_data, created_by } = req.body
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  let recipesContext = recipes_data?.map(r => `${r.name}: ${JSON.stringify(r.ingredients)}`).join('\n') || ''
  if (!recipesContext && recipe_ids?.length) {
    const resp = await fetch(`${supabaseUrl}/rest/v1/recipes?id=in.(${recipe_ids.map(id => `"${id}"`).join(',')})&select=name,servings,ingredients`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    })
    if (resp.ok) {
      const recipes = await resp.json()
      recipesContext = recipes.map(r => `${r.name}: ${JSON.stringify(r.ingredients)}`).join('\n')
    }
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' },
    systemInstruction: `Smart shopping list generator. Language ${lang}. Merge ingredients, subtract inventory. Return JSON { items: [{name, quantity, unit, category, recipe_name}] }.`
  })

  const result = await model.generateContent(`Recipes: ${recipesContext}. Inventory: ${JSON.stringify(inventory_items)}`)
  const parsed = JSON.parse(result.response.text())
  const listItems = parsed.items || []

  // Create list and insert items
  const listResp = await fetch(`${supabaseUrl}/rest/v1/shopping_lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'return=representation' },
    body: JSON.stringify({ household_id, name: list_name || 'Courses', session_id: session_id || null, created_by: created_by || household_id })
  })

  if (listResp.ok) {
    const [list] = await listResp.json()
    if (listItems.length > 0) {
      const itemInserts = listItems.map((item, i) => ({ list_id: list.id, name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, recipe_name: item.recipe_name, sort_order: i }))
      await fetch(`${supabaseUrl}/rest/v1/shopping_list_items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify(itemInserts)
      })
    }
    return res.status(200).json({ list, items_count: listItems.length })
  }
  return res.status(500).json({ error: 'Failed to create list' })
}