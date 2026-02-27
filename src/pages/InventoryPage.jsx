import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useMiamActions } from '../hooks/useMiamActions'
import { useMiam } from '../contexts/MiamContext'
import CategoryFilter from '../components/inventory/CategoryFilter'
import InventoryList from '../components/inventory/InventoryList'
import AddItemModal from '../components/inventory/AddItemModal'
import EditItemModal from '../components/inventory/EditItemModal'
import ConsumeModal from '../components/inventory/ConsumeModal'
import ScanReceiptButton from '../components/inventory/ScanReceiptButton'
import ScanReviewModal from '../components/inventory/ScanReviewModal'
import StoreSelectDialog from '../components/inventory/StoreSelectDialog'
import { apiPost } from '../lib/apiClient'

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
  const { t } = useLanguage()
  const { registerContextProvider } = useMiam()
  const [items, setItems] = useState([])
  const [category, setCategory] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [consumingItem, setConsumingItem] = useState(null)
  const [scanResults, setScanResults] = useState(null)
  const [receiptTotal, setReceiptTotal] = useState(null)
  const [pendingScanData, setPendingScanData] = useState(null)
  const [verifyingPrices, setVerifyingPrices] = useState(false)

  // Phase 4: Selection mode
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [toastMessage, setToastMessage] = useState(null)
  const scanTriggerRef = useRef(null)

  // Miam orchestrator: register available actions
  useMiamActions({
    openAddItem: {
      handler: () => setShowAddModal(true),
      description: 'Open add item modal',
    },
    openScanner: {
      handler: ({ source = 'camera', mode = 'auto' } = {}) => {
        scanTriggerRef.current?.({ source, mode })
      },
      description: 'Open receipt scanner',
    },
    filterCategory: {
      handler: ({ category: cat }) => setCategory(cat === 'all' ? 'all' : cat),
      description: 'Filter inventory by category',
    },
  })

  // Fournir le contexte inventaire à Miam (liste d'articles pour updateInventoryItem/consumeInventoryItem)
  useEffect(() => {
    return registerContextProvider('inventoryItems', () =>
      items.map(i => ({ id: i.id, name: i.name, brand: i.brand, category: i.category }))
    )
  }, [registerContextProvider, items])

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
    console.log('[InventoryPage] scanComplete:', scannedItems?.length, 'items')
    setPendingScanData({ items: scannedItems, receiptTotal: scanReceiptTotal ?? null })
  }

  const handleStoreConfirm = async (storeName) => {
    if (!pendingScanData) return
    const { items: scannedItems, receiptTotal: scanReceiptTotal } = pendingScanData
    setPendingScanData(null)

    // Appliquer le magasin a tous les items
    let finalItems = storeName
      ? scannedItems.map(item => ({ ...item, store: storeName }))
      : scannedItems

    // Verifier les prix si un magasin est specifie et qu'il y a des items au poids
    const hasWeightItems = finalItems.some(item =>
      item.unit === 'kg' && ['meat', 'fish', 'vegetables', 'fruits', 'dairy'].includes(item.category)
    )

    if (storeName && hasWeightItems) {
      setVerifyingPrices(true)
      try {
        const res = await apiPost('/api/verify-prices', { items: finalItems, store: storeName })
        if (res.ok) {
          const data = await res.json()
          if (data.items) finalItems = data.items
        }
      } catch {
        // Fallback gracieux : on garde les items originaux
      } finally {
        setVerifyingPrices(false)
      }
    }

    setScanResults(finalItems)
    setReceiptTotal(scanReceiptTotal)
  }

  const handleStoreSkip = () => {
    if (!pendingScanData) return
    const { items: scannedItems, receiptTotal: scanReceiptTotal } = pendingScanData
    setPendingScanData(null)
    setScanResults(scannedItems)
    setReceiptTotal(scanReceiptTotal)
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


  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('inventory.title')}</h1>
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
            <ScanReceiptButton onScanComplete={handleScanComplete} onError={(msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 5000) }} scanTriggerRef={scanTriggerRef} />
          </div>
        )}
      </div>

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

      {pendingScanData && createPortal(
        <StoreSelectDialog
          onConfirm={handleStoreConfirm}
          onSkip={handleStoreSkip}
        />,
        document.body
      )}

      {verifyingPrices && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-700 font-medium">{t('inventory.verifyingPrices')}</p>
          </div>
        </div>,
        document.body
      )}

      {pendingScanData && createPortal(
        <StoreSelectDialog
          onConfirm={handleStoreConfirm}
          onSkip={handleStoreSkip}
        />,
        document.body
      )}

      {verifyingPrices && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-700 font-medium">{t('inventory.verifyingPrices')}</p>
          </div>
        </div>,
        document.body
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
