import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useShoppingList } from '../hooks/useShoppingList'
import ShoppingListSelector from '../components/shopping/ShoppingListSelector'
import ShoppingListItems from '../components/shopping/ShoppingListItems'
import AddShoppingItemModal from '../components/shopping/AddShoppingItemModal'

export default function ShoppingListPage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const {
    lists,
    activeList,
    activeListId,
    setActiveListId,
    items,
    loading,
    createList,
    toggleItem,
    addItem,
    removeItem,
    archiveList,
    deleteList,
  } = useShoppingList(profile?.household_id)

  const [showAdd, setShowAdd] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  const handleCreateList = async () => {
    if (!newListName.trim()) return
    await createList(newListName.trim(), profile.id)
    setNewListName('')
    setShowNewList(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('shopping.title')}</h1>
        <div className="flex items-center gap-2">
          {activeList && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 w-44">
                  <button
                    onClick={() => { archiveList(activeListId); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {t('shopping.archive')}
                  </button>
                  <button
                    onClick={() => { deleteList(activeListId); setShowMenu(false) }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    {t('shopping.delete')}
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowNewList(true)}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
          >
            {t('shopping.newList')}
          </button>
        </div>
      </div>

      {/* New list inline */}
      {showNewList && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder={t('shopping.listNamePlaceholder')}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
          />
          <button
            onClick={handleCreateList}
            disabled={!newListName.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {t('shopping.create')}
          </button>
          <button
            onClick={() => { setShowNewList(false); setNewListName('') }}
            className="px-3 py-2 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* List selector */}
      <ShoppingListSelector
        lists={lists.filter((l) => l.status !== 'archived')}
        activeListId={activeListId}
        onSelect={setActiveListId}
      />

      {/* Progress bar */}
      {activeList && totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{t('shopping.progress', { checked: checkedCount, total: totalCount })}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {activeList ? (
        <ShoppingListItems
          items={items}
          onToggle={toggleItem}
          onRemove={removeItem}
          profileId={profile?.id}
        />
      ) : (
        <div className="text-center py-12 space-y-3">
          <div className="text-5xl opacity-30">🛒</div>
          <p className="text-gray-400">{t('shopping.noLists')}</p>
          <button
            onClick={() => setShowNewList(true)}
            className="text-orange-500 hover:text-orange-600 text-sm font-medium cursor-pointer"
          >
            {t('shopping.createFirst')}
          </button>
        </div>
      )}

      {/* FAB - Add item */}
      {activeList && (
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-20 right-4 md:bottom-8 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-colors z-30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      )}

      {/* Add item modal */}
      {showAdd && (
        <AddShoppingItemModal
          onClose={() => setShowAdd(false)}
          onAdd={addItem}
        />
      )}
    </div>
  )
}
