import { GoogleGenerativeAI } from '@google/generative-ai'

const VALID_CATEGORIES = ['dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other']
const VALID_UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack']

const MAX_CORRECTION_RETRIES = 2

function cleanItems(rawItems, mode) {
  return rawItems
    .filter(item => item && typeof item.name === 'string' && item.name.trim())
    .map(item => ({
      name: item.name.trim(),
      brand: typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : null,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      unit: VALID_UNITS.includes(item.unit) ? item.unit : 'piece',
      price: typeof item.price === 'number' ? item.price : null,
      price_per_kg: typeof item.price_per_kg === 'number' ? item.price_per_kg : null,
      price_estimated: mode === 'photo' ? true : item.price_estimated === true,
      category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
      estimated_expiry_days: typeof item.estimated_expiry_days === 'number' ? item.estimated_expiry_days : null,
      store: typeof item.store === 'string' ? item.store.trim() : null,
    }))
}

function parseGeminiResponse(text) {
  let cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const parsed = JSON.parse(cleaned)

  // Handle both object {items, receipt_total} and legacy array format
  if (Array.isArray(parsed)) {
    return { items: parsed, receipt_total: null }
  }
  return {
    items: Array.isArray(parsed.items) ? parsed.items : (parsed.items ? [parsed.items] : []),
    receipt_total: typeof parsed.receipt_total === 'number' ? parsed.receipt_total : null,
  }
}

function computeTotal(items) {
  return items.reduce((sum, item) => sum + (item.price ?? 0), 0)
}

function buildCorrectionPrompt(items, receiptTotal, computedTotal, langInstruction) {
  return `You previously extracted these items from a receipt, but the individual prices don't add up to the receipt total.

Extracted items:
${JSON.stringify(items, null, 2)}

Computed total from items: ${computedTotal.toFixed(2)}
Actual receipt total: ${receiptTotal.toFixed(2)}

Re-analyze the receipt image carefully and correct the individual prices so they match the receipt total.
Keep the same items but fix the prices. Also return the receipt_total.

${langInstruction}

Return ONLY a valid JSON object with "items" (array) and "receipt_total" (number), no markdown, no explanation.`
}

function buildPrompt(mode, langInstruction) {
  const commonSchema = `Each item must have:
- "name": product name (string, clean and human-readable — NOT the raw ticket abbreviation)
- "brand": brand name if identifiable (string or null). For store brands, use the full brand name (e.g. "Carrefour Bio", "Marque Repere")
- "quantity": number purchased (number, default 1). For weighed items, this is the actual weight (e.g. 0.543 for 543g)
- "unit": unit of measure (string, one of: "piece", "kg", "g", "l", "ml", "pack")
- "price": the TOTAL price actually paid for this line item in euros (number or null). For weighed items, this is quantity * price_per_kg. For regular items, this is the price on the receipt line.
- "price_per_kg": the per-kilogram (or per-liter for liquids) rate in euros (number or null). For weighed items, receipts usually show this. For regular items sold by piece, set to null.
- "price_estimated": boolean, true if the price is an estimate rather than from a receipt
- "category": one of: "dairy", "meat", "fish", "vegetables", "fruits", "grains", "bakery", "frozen", "beverages", "snacks", "condiments", "hygiene", "household", "other"
- "estimated_expiry_days": estimated days before expiry based on typical shelf life (number, e.g. milk=7, bread=5, canned=365, fresh meat=3, vegetables=7, frozen=90)
- "store": store name if visible (string or null)

IMPORTANT for receipts: Many items are sold by weight (fruits, vegetables, meat, cheese, deli). The receipt typically shows:
- The per-kg rate (e.g. "5.99 EUR/kg")
- The actual weight (e.g. "0.543 kg")
- The line total (e.g. "3.25 EUR")
You MUST set: quantity=0.543, unit="kg", price=3.25 (line total), price_per_kg=5.99`

  const itemExample = `{"name":"Semi-skimmed milk","brand":"Carrefour Bio","quantity":1,"unit":"l","price":1.29,"price_per_kg":null,"price_estimated":false,"category":"dairy","estimated_expiry_days":7,"store":"Carrefour"}`

  if (mode === 'receipt') {
    const example = `{"items":[${itemExample}],"receipt_total":12.50}`
    return `You are a receipt/grocery ticket scanner. Analyze this receipt image and extract all purchased items.

IMPORTANT: Receipt text often uses abbreviations (e.g. "CRF BIO LT DEMI-ECR 1L", "BLE D'OR PAIN MIE"). You MUST:
- Convert abbreviations into clean, readable product names (e.g. "Lait demi-ecreme 1L", "Pain de mie")
- Identify the brand from the abbreviation or store context (e.g. "CRF BIO" → "Carrefour Bio", "MDD" → store brand)
- Use the actual prices shown on the receipt (price_estimated: false)

Return a JSON object with "items" (array) and "receipt_total" (the total printed on the receipt as a number, or null if not visible).
${commonSchema}

${langInstruction}

IMPORTANT: Return ONLY a valid JSON object, no markdown, no explanation. Example:
${example}`
  }

  if (mode === 'photo') {
    const example = `{"items":[${itemExample.replace('"price_estimated":false', '"price_estimated":true')}],"receipt_total":null}`
    return `You are a product identifier. Analyze this photo of products (shelf, fridge, pantry, etc.) and identify all visible products.

For each product:
- Identify the product name and brand from labels, packaging, or visual cues
- Estimate a typical retail price in euros (price_estimated: true for ALL items since these are not from a receipt)
- Determine the category and typical shelf life

Return a JSON object with "items" (array) and "receipt_total" (always null for photos).
${commonSchema}

${langInstruction}

IMPORTANT: Return ONLY a valid JSON object, no markdown, no explanation. Example:
${example}`
  }

  // mode === 'auto'
  const example = `{"items":[${itemExample}],"receipt_total":12.50}`
  return `You are a smart grocery scanner. Analyze this image and determine if it is:
1. A receipt/grocery ticket → extract items with real prices (price_estimated: false), and include "receipt_total" (the total printed on the receipt)
2. A photo of products (shelf, fridge, pantry, etc.) → identify products and estimate prices (price_estimated: true), set "receipt_total" to null

For receipts, convert abbreviations into clean readable names and identify brands.
For photos, identify products from labels/packaging and estimate typical retail prices in euros.

Return a JSON object with "items" (array) and "receipt_total" (number or null).
${commonSchema}

${langInstruction}

IMPORTANT: Return ONLY a valid JSON object, no markdown, no explanation. Example:
${example}`
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { image, mimeType, lang, mode: rawMode } = req.body
  if (!image) return res.status(400).json({ error: 'Image required' })

  const mode = ['receipt', 'photo', 'auto'].includes(rawMode) ? rawMode : 'auto'

  const apiKey = process.env.GEMINI_SCAN_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const langInstruction = lang === 'zh' ? 'Respond with product names in Chinese.'
    : lang === 'en' ? 'Respond with product names in English.'
    : 'Respond with product names in French.'

  const prompt = buildPrompt(mode, langInstruction)

  const imageData = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: image,
    },
  }

  try {
    const result = await model.generateContent([{ text: prompt }, imageData])
    const text = result.response.text()

    let parsed
    try {
      parsed = parseGeminiResponse(text)
    } catch {
      return res.status(200).json({ items: [], receipt_total: null, raw: text })
    }

    let items = cleanItems(parsed.items, mode)
    let receiptTotal = parsed.receipt_total

    // Validation loop: if receipt_total exists and computed total doesn't match, retry
    if (receiptTotal != null) {
      let retries = 0
      while (retries < MAX_CORRECTION_RETRIES) {
        const computed = computeTotal(items)
        if (Math.abs(computed - receiptTotal) <= 0.50) break

        console.log(`[scan-receipt] Price mismatch: computed=${computed.toFixed(2)}, receipt=${receiptTotal.toFixed(2)}, retry ${retries + 1}/${MAX_CORRECTION_RETRIES}`)

        const correctionPrompt = buildCorrectionPrompt(items, receiptTotal, computed, langInstruction)
        const correctionResult = await model.generateContent([{ text: correctionPrompt }, imageData])
        const correctionText = correctionResult.response.text()

        try {
          const corrected = parseGeminiResponse(correctionText)
          items = cleanItems(corrected.items, mode)
          if (typeof corrected.receipt_total === 'number') {
            receiptTotal = corrected.receipt_total
          }
        } catch {
          console.log('[scan-receipt] Failed to parse correction response, keeping previous items')
          break
        }

        retries++
      }

      if (retries > 0) {
        const finalComputed = computeTotal(items)
        console.log(`[scan-receipt] After ${retries} correction(s): computed=${finalComputed.toFixed(2)}, receipt=${receiptTotal.toFixed(2)}, match=${Math.abs(finalComputed - receiptTotal) <= 0.50}`)
      }
    }

    return res.status(200).json({ items, receipt_total: receiptTotal })
  } catch (error) {
    console.error('Gemini scan error:', error)
    return res.status(500).json({ error: 'Scan failed' })
  }
}
