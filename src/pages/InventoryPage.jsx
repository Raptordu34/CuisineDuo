import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useMiamActions } from '../hooks/useMiamActions'
import CategoryFilter from '../components/inventory/CategoryFilter'
import InventoryList from '../components/inventory/InventoryList'
import AddItemModal from '../components/inventory/AddItemModal'
import EditItemModal from '../components/inventory/EditItemModal'
import ConsumeModal from '../components/inventory/ConsumeModal'
import ScanReceiptButton from '../components/inventory/ScanReceiptButton'
import ScanReviewModal from '../components/inventory/ScanReviewModal'
import DictationButton from '../components/DictationButton'
import DictationTrace from '../components/DictationTrace'

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

  // Phase 4: Selection mode
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const scanTriggerRef = useRef(null)

  // Miam orchestrator: register available actions
  useMiamActions({
    openAddItem: {
      handler: () => setShowAddModal(true),
      description: 'Open add item modal',
    },
    openScanner: {
      handler: () => scanTriggerRef.current?.(),
      description: 'Open receipt scanner',
    },
    filterCategory: {
      handler: ({ category: cat }) => setCategory(cat === 'all' ? 'all' : cat),
      description: 'Filter inventory by category',
    },
  })

  useEffect(() => {
    if (!profile?.household_id) return

    const fetchItems = async () => {
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
    }

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
        async () => {
          const { data } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('household_id', profile.household_id)
            .order('created_at', { ascending: false })
          if (data) setItems(data)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.household_id])

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

  // Phase 1: Fill-level handlers
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

  // Phase 1: Splitting at scan
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

  // Phase 4: Selection mode handlers
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

  // Phase 4: Determine scope items for dictation
  const getScopeItems = useCallback(() => {
    if (selectionMode && selectedIds.size > 0) {
      return items.filter((i) => selectedIds.has(i.id))
    }
    if (category !== 'all') {
      return items.filter((i) => i.category === category)
    }
    return items
  }, [selectionMode, selectedIds, items, category])

  // Phase 4: Inventory dictation handler
  const handleInventoryDictation = useCallback(async (text, dictLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)

    const scopeItems = getScopeItems().map((i) => ({
      item_id: i.id,
      name: i.name,
      brand: i.brand,
      quantity: i.quantity,
      unit: i.unit,
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
          lang: dictLang || lang,
          items: scopeItems,
        }),
      })

      if (res.ok) {
        const data = await res.json()

        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.summary || JSON.stringify(data.updates),
          timestamp: Date.now(),
        })

        if (data.updates && Array.isArray(data.updates)) {
          for (const update of data.updates) {
            if (update.action === 'consumed' && update.item_id) {
              const item = items.find((i) => i.id === update.item_id)
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
              const payload = {}
              for (const key of allowed) {
                if (update.fields[key] !== undefined) payload[key] = update.fields[key]
              }
              if (Object.keys(payload).length > 0) {
                const item = items.find((i) => i.id === update.item_id)
                const merged = autoPriceCalc({
                  quantity: payload.quantity ?? item?.quantity,
                  unit: payload.unit ?? item?.unit,
                  price: payload.price !== undefined ? payload.price : (item?.price ?? null),
                  price_per_kg: payload.price_per_kg !== undefined ? payload.price_per_kg : (item?.price_per_kg ?? null),
                })
                if (merged.price_per_kg != null && payload.price_per_kg === undefined) payload.price_per_kg = merged.price_per_kg
                if (merged.price != null && payload.price === undefined) payload.price = merged.price
                await supabase
                  .from('inventory_items')
                  .update(payload)
                  .eq('id', update.item_id)
              }
            }
          }
        }
      }
    } catch {
      // silently fail
    } finally {
      setDictationCorrecting(false)
      if (selectionMode) exitSelectionMode()
    }
  }, [getScopeItems, lang, items, profile, selectionMode])

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('inventory.title')}</h1>
          <DictationButton
            onResult={handleInventoryDictation}
            disabled={dictationCorrecting}
            color="orange"
          />
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
            <ScanReceiptButton onScanComplete={handleScanComplete} onError={(msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 5000) }} galleryTriggerRef={scanTriggerRef} />
          </div>
        )}
      </div>

      {/* Dictation trace */}
      {dictationTrace && (
        <div className="shrink-0 px-3">
          <DictationTrace trace={dictationTrace} />
        </div>
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

      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/80 hover:text-white cursor-pointer">✕</button>
        </div>
      )}
    </div>
  )
}
