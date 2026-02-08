import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import CategoryFilter from '../components/inventory/CategoryFilter'
import InventoryList from '../components/inventory/InventoryList'
import AddItemModal from '../components/inventory/AddItemModal'
import EditItemModal from '../components/inventory/EditItemModal'
import ConsumeModal from '../components/inventory/ConsumeModal'
import ScanReceiptButton from '../components/inventory/ScanReceiptButton'
import ScanReviewModal from '../components/inventory/ScanReviewModal'
import DictationButton from '../components/DictationButton'
import DictationTrace from '../components/DictationTrace'
import InventoryUpdateConfirmModal from '../components/inventory/InventoryUpdateConfirmModal'
import SearchConfirmDialog from '../components/inventory/SearchConfirmDialog'

function toKg(q, u) {
  if (u === 'kg' || u === 'l') return q
  if (u === 'g' || u === 'ml') return q / 1000
  return null
}

function autoPriceCalc(row) {
  const qtyKg = toKg(row.quantity, row.unit)
  if (!qtyKg || qtyKg <= 0) return row
  if (row.price != null && row.price > 0 && row.price_per_kg == null) {
    return { ...row, price_per_kg: Math.round((row.price / qtyKg) * 100) / 100 }
  }
  if (row.price_per_kg != null && row.price_per_kg > 0 && row.price == null) {
    return { ...row, price: Math.round((row.price_per_kg * qtyKg) * 100) / 100 }
  }
  return row
}

export default function InventoryPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const [items, setItems] = useState([])
  const [category, setCategory] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [consumingItem, setConsumingItem] = useState(null)
  const [scanResults, setScanResults] = useState(null)
  const [receiptTotal, setReceiptTotal] = useState(null)

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)

  // Confirmation flow
  const [pendingUpdates, setPendingUpdates] = useState(null)

  // Search flow
  const [pendingSearch, setPendingSearch] = useState(null)

  // Text command input
  const [showCommandInput, setShowCommandInput] = useState(false)
  const [commandText, setCommandText] = useState('')
  const commandInputRef = useRef(null)

  // Ref to always have latest items (avoids stale closures in applyUpdates)
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  const fetchItems = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })
    if (data) {
      setItems(data)
      // Patch existing items missing price_per_kg or price
      for (const item of data) {
        const patched = autoPriceCalc(item)
        if (patched.price_per_kg !== (item.price_per_kg ?? null) || patched.price !== (item.price ?? null)) {
          const updates = {}
          if (patched.price_per_kg !== (item.price_per_kg ?? null)) updates.price_per_kg = patched.price_per_kg
          if (patched.price !== (item.price ?? null)) updates.price = patched.price
          supabase.from('inventory_items').update(updates).eq('id', item.id).then()
        }
      }
    }
  }, [profile?.household_id])

  useEffect(() => {
    if (!profile?.household_id) return

    fetchItems()

    const channel = supabase
      .channel(`inventory:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
          filter: `household_id=eq.${profile.household_id}`,
        },
        () => fetchItems()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.household_id, fetchItems])

  const handleAdd = async (itemData) => {
    await supabase.from('inventory_items').insert({
      ...itemData,
      household_id: profile.household_id,
      added_by: profile.id,
      purchase_date: new Date().toISOString().split('T')[0],
    })
    setShowAddModal(false)
  }

  const handleEdit = async (id, updates) => {
    await supabase.from('inventory_items').update(updates).eq('id', id)
    setEditingItem(null)
  }

  const handleDelete = async (id) => {
    await supabase.from('inventory_items').delete().eq('id', id)
    setEditingItem(null)
  }

  // Fill-level handlers
  const handleUpdateFillLevel = async (item, newLevel) => {
    await supabase
      .from('inventory_items')
      .update({ fill_level: newLevel })
      .eq('id', item.id)
    setConsumingItem(null)
  }

  const handleConsumeAll = async (item) => {
    const consumedData = {
      household_id: item.household_id,
      name: item.name,
      brand: item.brand || null,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      price_per_kg: item.price_per_kg ?? null,
      price_estimated: item.price_estimated === true,
      category: item.category,
      purchase_date: item.purchase_date,
      store: item.store,
      notes: item.notes,
      added_by: item.added_by,
      consumed_by: profile.id,
      fill_level: item.fill_level ?? 1,
    }
    await supabase.from('consumed_items').insert(consumedData)
    await supabase.from('inventory_items').delete().eq('id', item.id)
    setConsumingItem(null)
  }

  const handleScanComplete = (scannedItems, scanReceiptTotal) => {
    setScanResults(scannedItems)
    setReceiptTotal(scanReceiptTotal ?? null)
  }

  // Splitting at scan
  const handleScanConfirm = async (selectedItems) => {
    const today = new Date().toISOString().split('T')[0]
    const rows = []

    for (const item of selectedItems) {
      const qty = Math.floor(item.quantity)
      if (qty > 1) {
        const splitQty = item.quantity / qty
        const splitPrice = item.price != null ? item.price / qty : null
        for (let i = 0; i < qty; i++) {
          rows.push({
            household_id: profile.household_id,
            added_by: profile.id,
            name: item.name,
            brand: typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : null,
            quantity: splitQty,
            unit: item.unit,
            price: splitPrice,
            price_per_kg: item.price_per_kg ?? null,
            price_estimated: item.price_estimated === true,
            category: item.category,
            store: item.store,
            purchase_date: today,
            fill_level: 1,
            estimated_expiry_date: item.estimated_expiry_days
              ? new Date(Date.now() + item.estimated_expiry_days * 86400000).toISOString().split('T')[0]
              : null,
          })
        }
      } else {
        rows.push({
          household_id: profile.household_id,
          added_by: profile.id,
          name: item.name,
          brand: typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : null,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          price_per_kg: item.price_per_kg ?? null,
          price_estimated: item.price_estimated === true,
          category: item.category,
          store: item.store,
          purchase_date: today,
          fill_level: 1,
          estimated_expiry_date: item.estimated_expiry_days
            ? new Date(Date.now() + item.estimated_expiry_days * 86400000).toISOString().split('T')[0]
            : null,
        })
      }
    }

    await supabase.from('inventory_items').insert(rows.map(autoPriceCalc))
    setScanResults(null)
    setReceiptTotal(null)
  }

  // Selection mode handlers
  const handleLongPress = useCallback((item) => {
    setSelectionMode(true)
    setSelectedIds(new Set([item.id]))
  }, [])

  const handleToggleSelect = useCallback((itemId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      if (next.size === 0) {
        setSelectionMode(false)
      }
      return next
    })
  }, [])

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  // Determine scope items for dictation
  const getScopeItems = useCallback(() => {
    if (selectionMode && selectedIds.size > 0) {
      return items.filter((i) => selectedIds.has(i.id))
    }
    if (category !== 'all') {
      return items.filter((i) => i.category === category)
    }
    return items
  }, [selectionMode, selectedIds, items, category])

  // Sanitize numeric fields from AI responses (may return strings, NaN, etc.)
  const sanitizePayload = (payload) => {
    const numericFields = ['quantity', 'price', 'price_per_kg', 'fill_level']
    const validUnits = ['piece', 'kg', 'g', 'l', 'ml', 'pack']
    const validCategories = ['dairy', 'meat', 'fish', 'vegetables', 'fruits', 'grains', 'bakery', 'frozen', 'beverages', 'snacks', 'condiments', 'hygiene', 'household', 'other']
    const clean = { ...payload }
    for (const key of numericFields) {
      if (clean[key] !== undefined && clean[key] !== null) {
        const num = Number(clean[key])
        if (isNaN(num)) {
          delete clean[key]
        } else {
          clean[key] = num
        }
      }
    }
    if (clean.price_estimated !== undefined) {
      clean.price_estimated = Boolean(clean.price_estimated)
    }
    if (clean.unit !== undefined && !validUnits.includes(clean.unit)) {
      delete clean.unit
    }
    if (clean.category !== undefined && !validCategories.includes(clean.category)) {
      delete clean.category
    }
    return clean
  }

  // Apply updates to Supabase (extracted logic)
  // Uses itemsRef to always read the latest items, avoiding stale closure issues
  const applyUpdates = useCallback(async (updates) => {
    const currentItems = itemsRef.current
    for (const update of updates) {
      if (update.action === 'consumed' && update.item_id) {
        const item = currentItems.find((i) => i.id === update.item_id)
        if (item) {
          await supabase.from('consumed_items').insert({
            household_id: item.household_id,
            name: item.name,
            brand: item.brand || null,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
            price_per_kg: item.price_per_kg ?? null,
            price_estimated: item.price_estimated === true,
            category: item.category,
            purchase_date: item.purchase_date,
            store: item.store,
            notes: item.notes,
            added_by: item.added_by,
            consumed_by: profile.id,
            fill_level: item.fill_level ?? 1,
          })
          await supabase.from('inventory_items').delete().eq('id', item.id)
        }
      } else if (update.action === 'update' && update.item_id && update.fields) {
        const allowed = ['name', 'brand', 'quantity', 'unit', 'price', 'price_per_kg', 'price_estimated', 'fill_level', 'category', 'store', 'notes', 'estimated_expiry_date']
        const raw = {}
        for (const key of allowed) {
          if (update.fields[key] !== undefined) raw[key] = update.fields[key]
        }
        const payload = sanitizePayload(raw)
        if (Object.keys(payload).length > 0) {
          const item = currentItems.find((i) => i.id === update.item_id)
          const merged = autoPriceCalc({
            quantity: payload.quantity ?? item?.quantity,
            unit: payload.unit ?? item?.unit,
            price: payload.price !== undefined ? payload.price : (item?.price ?? null),
            price_per_kg: payload.price_per_kg !== undefined ? payload.price_per_kg : (item?.price_per_kg ?? null),
          })
          if (merged.price_per_kg != null && payload.price_per_kg === undefined) payload.price_per_kg = merged.price_per_kg
          if (merged.price != null && payload.price === undefined) payload.price = merged.price
          const { error } = await supabase
            .from('inventory_items')
            .update(payload)
            .eq('id', update.item_id)
          if (error) console.error('Supabase update failed:', error.message, 'payload:', JSON.stringify(payload))
        }
      }
    }
  }, [profile])

  // Inventory command handler (shared by dictation and text input)
  const handleInventoryCommand = useCallback(async (text, cmdLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)

    const scopeItems = getScopeItems().map((i) => ({
      item_id: i.id,
      name: i.name,
      brand: i.brand,
      quantity: i.quantity,
      unit: i.unit,
      price: i.price ?? null,
      price_per_kg: i.price_per_kg ?? null,
      fill_level: i.fill_level ?? 1,
      category: i.category,
    }))

    try {
      const res = await fetch('/api/correct-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          context: 'inventory-update',
          lang: cmdLang || lang,
          items: scopeItems,
        }),
      })

      if (res.ok) {
        const data = await res.json()

        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.summary || data.search_reason || JSON.stringify(data.updates),
          timestamp: Date.now(),
        })

        // Search needed flow
        if (data.search_needed) {
          setPendingSearch({
            text,
            lang: cmdLang || lang,
            items: scopeItems,
            search_query: data.search_query,
            search_reason: data.search_reason,
          })
        } else if (data.updates && Array.isArray(data.updates) && data.updates.length > 0) {
          // Confirmation flow
          setPendingUpdates({ updates: data.updates, summary: data.summary })
        } else {
          setDictationTrace({
            rawTranscript: text,
            correctedResult: t('inventory.noUpdates'),
            timestamp: Date.now(),
          })
        }
      }
    } catch {
      // silently fail
    } finally {
      setDictationCorrecting(false)
      if (selectionMode) exitSelectionMode()
    }
  }, [getScopeItems, lang, selectionMode, t])

  // Dictation handler (delegates to shared handler)
  const handleInventoryDictation = useCallback(async (text, dictLang) => {
    await handleInventoryCommand(text, dictLang)
  }, [handleInventoryCommand])

  // Confirm updates
  const handleConfirmUpdates = useCallback(async () => {
    if (!pendingUpdates) return
    await applyUpdates(pendingUpdates.updates)
    setPendingUpdates(null)
    await fetchItems()
  }, [pendingUpdates, applyUpdates, fetchItems])

  // Cancel updates
  const handleCancelUpdates = useCallback(() => {
    setPendingUpdates(null)
  }, [])

  // Confirm search
  const handleSearchConfirm = useCallback(async () => {
    if (!pendingSearch) return
    setDictationCorrecting(true)
    setPendingSearch(null)

    try {
      const res = await fetch('/api/correct-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pendingSearch.text,
          context: 'inventory-update-search',
          lang: pendingSearch.lang,
          items: pendingSearch.items,
        }),
      })

      if (res.ok) {
        const data = await res.json()

        setDictationTrace({
          rawTranscript: pendingSearch.text,
          correctedResult: data.summary || JSON.stringify(data.updates),
          timestamp: Date.now(),
        })

        if (data.updates && Array.isArray(data.updates) && data.updates.length > 0) {
          setPendingUpdates({ updates: data.updates, summary: data.summary })
        } else {
          setDictationTrace({
            rawTranscript: pendingSearch.text,
            correctedResult: data.summary || t('inventory.noUpdates'),
            timestamp: Date.now(),
          })
        }
      }
    } catch {
      // silently fail
    } finally {
      setDictationCorrecting(false)
    }
  }, [pendingSearch, t])

  // Cancel search
  const handleSearchCancel = useCallback(() => {
    setPendingSearch(null)
  }, [])

  // Text command submission
  const handleCommandSubmit = useCallback(() => {
    if (!commandText.trim()) return
    const text = commandText.trim()
    setCommandText('')
    setShowCommandInput(false)
    handleInventoryCommand(text, lang)
  }, [commandText, lang, handleInventoryCommand])

  // Toggle command input
  const toggleCommandInput = useCallback(() => {
    setShowCommandInput((prev) => {
      if (!prev) {
        setTimeout(() => commandInputRef.current?.focus(), 50)
      }
      return !prev
    })
  }, [])

  const isBusy = dictationCorrecting || !!pendingUpdates || !!pendingSearch

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('inventory.title')}</h1>
          <DictationButton
            onResult={handleInventoryDictation}
            disabled={isBusy}
            color="orange"
          />
          <button
            onClick={toggleCommandInput}
            disabled={isBusy}
            className="p-1.5 text-gray-500 hover:text-orange-500 disabled:opacity-40 transition-colors cursor-pointer"
            title={t('inventory.typeCommand')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </button>
          {dictationCorrecting && (
            <span className="text-xs text-gray-400 animate-pulse shrink-0">{t('dictation.correcting')}</span>
          )}
        </div>
        {selectionMode ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-600">
              {t('inventory.selected', { count: selectedIds.size })}
            </span>
            <button
              onClick={exitSelectionMode}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-full transition-colors cursor-pointer"
            >
              {t('inventory.exitSelection')}
            </button>
          </div>
        ) : (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('inventory.add')}
            </button>
            <ScanReceiptButton onScanComplete={handleScanComplete} />
          </div>
        )}
      </div>

      {/* Text command input */}
      {showCommandInput && (
        <div className="shrink-0 px-3 pb-2">
          <form
            onSubmit={(e) => { e.preventDefault(); handleCommandSubmit() }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={commandInputRef}
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCommandSubmit()
                }
              }}
              placeholder={t('inventory.commandPlaceholder')}
              rows={1}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              style={{ maxHeight: '80px' }}
            />
            <button
              type="submit"
              disabled={!commandText.trim() || isBusy}
              className="shrink-0 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('chat.send')}
            </button>
          </form>
        </div>
      )}

      {/* Dictation trace */}
      {dictationTrace && (
        <div className="shrink-0 px-3">
          <DictationTrace trace={dictationTrace} />
        </div>
      )}

      {/* Search confirm dialog */}
      {pendingSearch && (
        <SearchConfirmDialog
          searchQuery={pendingSearch.search_query}
          searchReason={pendingSearch.search_reason}
          onConfirm={handleSearchConfirm}
          onCancel={handleSearchCancel}
        />
      )}

      {/* Category filter */}
      <div className="shrink-0 px-3 pb-2">
        <CategoryFilter selected={category} onSelect={setCategory} />
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <InventoryList
          items={items}
          category={category}
          onEdit={setEditingItem}
          onConsume={setConsumingItem}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onLongPress={handleLongPress}
          onToggleSelect={handleToggleSelect}
        />
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {consumingItem && (
        <ConsumeModal
          item={consumingItem}
          onClose={() => setConsumingItem(null)}
          onUpdateFillLevel={handleUpdateFillLevel}
          onConsumeAll={handleConsumeAll}
        />
      )}

      {scanResults && (
        <ScanReviewModal
          items={scanResults}
          receiptTotal={receiptTotal}
          onClose={() => { setScanResults(null); setReceiptTotal(null) }}
          onConfirm={handleScanConfirm}
        />
      )}

      {pendingUpdates && (
        <InventoryUpdateConfirmModal
          updates={pendingUpdates.updates}
          summary={pendingUpdates.summary}
          items={items}
          onConfirm={handleConfirmUpdates}
          onCancel={handleCancelUpdates}
        />
      )}
    </div>
  )
}
