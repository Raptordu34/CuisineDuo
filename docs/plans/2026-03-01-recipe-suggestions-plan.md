# Recipe Suggestions Improvement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add pre-suggestion config UI (inventory vs. discovery slider), anti-duplicate system, taste profile page, and adaptive AI taste learning.

**Architecture:** Intercept the "Suggest" button with a config modal, enrich the Gemini prompt in `suggest-recipes.js` with existing recipes (anti-duplicates) and aggregated household taste profiles, add a new `/profile` page for taste preferences, and a new `updateTasteProfile` function in the Miam orchestrator.

**Tech Stack:** React 19, Tailwind CSS 4, Supabase (PostgreSQL + RLS), Gemini API, Vercel Serverless Functions.

**Design doc:** `docs/plans/2026-03-01-recipe-suggestions-design.md`

**Important notes:**
- This project uses JavaScript (no TypeScript) with `.jsx` for components and `.js` for hooks/API
- No automated tests — manual testing only (per project conventions)
- Styling is Tailwind CSS utility classes only (no CSS files per component)
- Primary color: orange-500, AI accent: indigo-500
- Translations must be added for all 3 languages (FR, EN, ZH)
- Commits follow Conventional Commits: `feat(scope): description`

---

## Task 1: Database migration — Enrich taste_preferences table

**Files:**
- Create: `sql_history/enrich_taste_preferences.sql`

**Step 1: Write the migration SQL**

Create `sql_history/enrich_taste_preferences.sql`:

```sql
-- Add explicit taste markers to taste_preferences table
-- The table already has: sweetness, saltiness, spiciness, acidity, bitterness, umami, richness (SMALLINT 1-5)
-- and: notes TEXT, updated_at TIMESTAMPTZ

ALTER TABLE taste_preferences
  ADD COLUMN IF NOT EXISTS banned_ingredients JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dietary_restrictions JSONB DEFAULT '[]'::jsonb;

-- Rename existing 'notes' to 'additional_notes' for clarity (if 'notes' exists)
-- Note: the legacy table already has a 'notes' column, we'll use it as-is for additional_notes

-- Ensure RLS policies exist for taste_preferences
-- Users can read taste preferences of all household members (needed for aggregation)
-- Users can only update their own taste preferences

-- Drop existing policies if any to recreate cleanly
DROP POLICY IF EXISTS "Users can view household taste preferences" ON taste_preferences;
DROP POLICY IF EXISTS "Users can manage own taste preferences" ON taste_preferences;

CREATE POLICY "Users can view household taste preferences" ON taste_preferences
  FOR SELECT USING (
    profile_id IN (
      SELECT id FROM profiles WHERE household_id = auth_user_household_id()
    )
  );

CREATE POLICY "Users can manage own taste preferences" ON taste_preferences
  FOR ALL USING (profile_id = auth.uid());

-- Enable RLS if not already enabled
ALTER TABLE taste_preferences ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for taste_preferences (for cross-device sync)
ALTER PUBLICATION supabase_realtime ADD TABLE taste_preferences;
```

**Step 2: Apply the migration via Supabase MCP**

Use the `apply_migration` MCP tool with project_id from the Supabase project.
The migration name should be `enrich_taste_preferences`.

**Step 3: Verify the migration**

Use `execute_sql` to run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'taste_preferences' ORDER BY ordinal_position;
```

Expected: all original columns plus `banned_ingredients` (jsonb) and `dietary_restrictions` (jsonb).

**Step 4: Commit**

```bash
git add sql_history/enrich_taste_preferences.sql
git commit -m "feat(db): enrich taste_preferences with banned ingredients and dietary restrictions"
```

---

## Task 2: Add translations for all new features (FR/EN/ZH)

**Files:**
- Modify: `src/i18n/translations.js`

**Step 1: Add French translation keys**

In the `fr:` section, after the existing `recipes.suggestRetry` key (around line 367), add:

```javascript
    // Suggest config modal
    'recipes.suggestConfig.title': 'Personnalise tes suggestions',
    'recipes.suggestConfig.inventory': 'Inventaire',
    'recipes.suggestConfig.discovery': 'Decouverte',
    'recipes.suggestConfig.inventoryDesc': '{{count}} depuis ton frigo',
    'recipes.suggestConfig.discoveryDesc': '{{count}} surprise(s)',
    'recipes.suggestConfig.confirm': 'Suggere-moi !',
```

In the `fr:` section, after the miam recipe action keys (around line 392), add:

```javascript
    // Profile page
    'profile.title': 'Mon profil',
    'profile.household': 'Foyer : {{name}}',
    'profile.tasteTitle': 'Mes gouts',
    'profile.sweetness': 'Sucre',
    'profile.saltiness': 'Sale',
    'profile.spiciness': 'Epice',
    'profile.acidity': 'Acidite',
    'profile.bitterness': 'Amertume',
    'profile.umami': 'Umami',
    'profile.richness': 'Richesse',
    'profile.restrictionsTitle': 'Restrictions alimentaires',
    'profile.bannedTitle': 'Ingredients bannis',
    'profile.bannedPlaceholder': 'Ajouter un ingredient...',
    'profile.notesTitle': 'Notes',
    'profile.notesPlaceholder': 'Preferences supplementaires...',
    'profile.save': 'Enregistrer',
    'profile.saved': 'Enregistre !',
    'profile.back': 'Retour',
    'profile.tasteLow': 'Faible',
    'profile.tasteHigh': 'Fort',
    'nav.profile': 'Profil',
    // Dietary restrictions options
    'diet.vegetarian': 'Vegetarien',
    'diet.vegan': 'Vegan',
    'diet.glutenFree': 'Sans gluten',
    'diet.lactoseFree': 'Sans lactose',
    'diet.halal': 'Halal',
    'diet.kosher': 'Casher',
    'diet.nutFree': 'Sans fruits a coque',
    // Miam taste profile action
    'miam.action.updateTasteProfile': 'Profil gustatif mis a jour',
```

**Step 2: Add English translation keys**

In the `en:` section, after `recipes.suggestRetry` (around line 760), add:

```javascript
    // Suggest config modal
    'recipes.suggestConfig.title': 'Customize your suggestions',
    'recipes.suggestConfig.inventory': 'Inventory',
    'recipes.suggestConfig.discovery': 'Discovery',
    'recipes.suggestConfig.inventoryDesc': '{{count}} from your fridge',
    'recipes.suggestConfig.discoveryDesc': '{{count}} surprise(s)',
    'recipes.suggestConfig.confirm': 'Suggest!',
```

After the miam recipe action keys (around line 785), add:

```javascript
    // Profile page
    'profile.title': 'My profile',
    'profile.household': 'Household: {{name}}',
    'profile.tasteTitle': 'My tastes',
    'profile.sweetness': 'Sweet',
    'profile.saltiness': 'Salty',
    'profile.spiciness': 'Spicy',
    'profile.acidity': 'Acidic',
    'profile.bitterness': 'Bitter',
    'profile.umami': 'Umami',
    'profile.richness': 'Rich',
    'profile.restrictionsTitle': 'Dietary restrictions',
    'profile.bannedTitle': 'Banned ingredients',
    'profile.bannedPlaceholder': 'Add an ingredient...',
    'profile.notesTitle': 'Notes',
    'profile.notesPlaceholder': 'Additional preferences...',
    'profile.save': 'Save',
    'profile.saved': 'Saved!',
    'profile.back': 'Back',
    'profile.tasteLow': 'Low',
    'profile.tasteHigh': 'High',
    'nav.profile': 'Profile',
    // Dietary restrictions options
    'diet.vegetarian': 'Vegetarian',
    'diet.vegan': 'Vegan',
    'diet.glutenFree': 'Gluten-free',
    'diet.lactoseFree': 'Lactose-free',
    'diet.halal': 'Halal',
    'diet.kosher': 'Kosher',
    'diet.nutFree': 'Nut-free',
    // Miam taste profile action
    'miam.action.updateTasteProfile': 'Taste profile updated',
```

**Step 3: Add Chinese translation keys**

In the `zh:` section, in the same positions as above, add:

```javascript
    // Suggest config modal
    'recipes.suggestConfig.title': '自定义推荐',
    'recipes.suggestConfig.inventory': '库存',
    'recipes.suggestConfig.discovery': '探索',
    'recipes.suggestConfig.inventoryDesc': '{{count}} 道来自冰箱',
    'recipes.suggestConfig.discoveryDesc': '{{count}} 道惊喜',
    'recipes.suggestConfig.confirm': '推荐！',
```

```javascript
    // Profile page
    'profile.title': '我的资料',
    'profile.household': '家庭：{{name}}',
    'profile.tasteTitle': '我的口味',
    'profile.sweetness': '甜',
    'profile.saltiness': '咸',
    'profile.spiciness': '辣',
    'profile.acidity': '酸',
    'profile.bitterness': '苦',
    'profile.umami': '鲜',
    'profile.richness': '浓郁',
    'profile.restrictionsTitle': '饮食限制',
    'profile.bannedTitle': '禁用食材',
    'profile.bannedPlaceholder': '添加食材...',
    'profile.notesTitle': '备注',
    'profile.notesPlaceholder': '其他偏好...',
    'profile.save': '保存',
    'profile.saved': '已保存！',
    'profile.back': '返回',
    'profile.tasteLow': '低',
    'profile.tasteHigh': '高',
    'nav.profile': '资料',
    // Dietary restrictions options
    'diet.vegetarian': '素食',
    'diet.vegan': '纯素',
    'diet.glutenFree': '无麸质',
    'diet.lactoseFree': '无乳糖',
    'diet.halal': '清真',
    'diet.kosher': '犹太洁食',
    'diet.nutFree': '无坚果',
    // Miam taste profile action
    'miam.action.updateTasteProfile': '口味资料已更新',
```

**Step 4: Verify no syntax errors**

Run: `npm run lint`
Expected: no errors in `translations.js`

**Step 5: Commit**

```bash
git add src/i18n/translations.js
git commit -m "feat(i18n): add translations for suggest config, profile page, and taste preferences"
```

---

## Task 3: Create SuggestConfigModal component

**Files:**
- Create: `src/components/recipes/SuggestConfigModal.jsx`

**Step 1: Create the component**

Create `src/components/recipes/SuggestConfigModal.jsx`:

```jsx
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function SuggestConfigModal({ onConfirm, onClose }) {
  const { t } = useLanguage()
  const [inventoryCount, setInventoryCount] = useState(2)
  const discoveryCount = 3 - inventoryCount

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-2xl md:rounded-2xl p-5 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 text-center mb-5">
          {t('recipes.suggestConfig.title')}
        </h3>

        {/* Labels */}
        <div className="flex justify-between items-center mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-sm font-medium text-gray-700">{t('recipes.suggestConfig.inventory')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-700">{t('recipes.suggestConfig.discovery')}</span>
            <span className="w-3 h-3 rounded-full bg-indigo-500" />
          </div>
        </div>

        {/* Slider */}
        <div className="relative mb-2">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${(inventoryCount / 3) * 100}%`,
                background: 'linear-gradient(to right, #f97316, #fb923c)',
              }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={inventoryCount}
            onChange={e => setInventoryCount(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Tick marks */}
          <div className="flex justify-between px-0.5 mt-1">
            {[0, 1, 2, 3].map(v => (
              <div
                key={v}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  v <= inventoryCount ? 'bg-orange-400' : 'bg-indigo-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Counts */}
        <div className="flex justify-between text-center mb-6">
          <div className="flex-1">
            <span className="text-2xl font-bold text-orange-500">{inventoryCount}</span>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('recipes.suggestConfig.inventoryDesc', { count: inventoryCount })}
            </p>
          </div>
          <div className="flex-1">
            <span className="text-2xl font-bold text-indigo-500">{discoveryCount}</span>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('recipes.suggestConfig.discoveryDesc', { count: discoveryCount })}
            </p>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={() => onConfirm({ inventoryCount, discoveryCount })}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          {t('recipes.suggestConfig.confirm')}
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/recipes/SuggestConfigModal.jsx
git commit -m "feat(recipes): create SuggestConfigModal with inventory/discovery slider"
```

---

## Task 4: Integrate SuggestConfigModal into RecipesPage

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

**Step 1: Add import and state**

At the top of `RecipesPage.jsx`, add the import (after the `SuggestPreviewModal` import at line 12):

```javascript
import SuggestConfigModal from '../components/recipes/SuggestConfigModal'
```

Add a new state variable (after `suggestError` state, around line 48):

```javascript
const [showSuggestConfig, setShowSuggestConfig] = useState(false)
```

**Step 2: Modify handleSuggest to accept config params**

Replace the `handleSuggest` function (lines 137-205) to accept `inventoryCount` and `discoveryCount` parameters, and include `existingRecipes`:

```javascript
  const handleSuggest = useCallback(async ({ inventoryCount = 3, discoveryCount = 0 } = {}) => {
    if (suggesting) return

    if (!inventoryItems.length && inventoryCount > 0) {
      setSuggestError(t('recipes.suggestEmptyInventory'))
      return
    }

    setSuggesting(true)
    setSuggestError(null)
    setShowSuggestConfig(false)
    const t0 = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS)

    // Prepare existing recipes for anti-duplicate check (max 50, most recent first)
    const existingRecipes = recipes
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 50)
      .map(r => ({ name: r.name, category: r.category }))

    try {
      const res = await apiPost('/api/suggest-recipes', {
        inventory: inventoryItems,
        lang,
        inventoryCount,
        discoveryCount,
        existingRecipes,
      }, { signal: controller.signal })

      clearTimeout(timeout)
      const durationMs = Date.now() - t0

      if (res.ok) {
        const data = await res.json()
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'suggest-recipes',
          input: { lang, inventoryCount: inventoryItems.length, inventoryRecipes: inventoryCount, discoveryRecipes: discoveryCount },
          output: { recipeCount: data.recipes?.length ?? 0 },
          durationMs,
        })
        if (data.recipes?.length) {
          setSuggestPreview(data.recipes)
        } else {
          setSuggestError(t('recipes.suggestNoResults'))
        }
      } else {
        const errBody = await res.json().catch(() => ({}))
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'suggest-recipes',
          input: { lang, inventoryCount: inventoryItems.length },
          output: { raw: errBody.raw?.slice?.(0, 300) },
          durationMs,
          error: errBody.error || `HTTP ${res.status}`,
        })
        setSuggestError(t('recipes.suggestError'))
      }
    } catch (err) {
      clearTimeout(timeout)
      const durationMs = Date.now() - t0
      const isTimeout = err.name === 'AbortError'
      logAI({
        householdId: profile?.household_id,
        profileId: profile?.id,
        endpoint: 'suggest-recipes',
        input: { lang, inventoryCount: inventoryItems.length },
        durationMs,
        error: isTimeout ? 'Client timeout' : (err.message || 'Unknown error'),
      })
      setSuggestError(isTimeout ? t('recipes.suggestTimeout') : t('recipes.suggestError'))
    } finally {
      setSuggesting(false)
    }
  }, [suggesting, inventoryItems, recipes, lang, t, profile])
```

**Step 3: Change the suggest button to open config modal**

Replace the suggest button's `onClick` handler (line 276):

From: `onClick={handleSuggest}`
To: `onClick={() => setShowSuggestConfig(true)}`

**Step 4: Add SuggestConfigModal to the JSX**

After the `SuggestPreviewModal` block (after line 400), add:

```jsx
      {showSuggestConfig && (
        <SuggestConfigModal
          onConfirm={handleSuggest}
          onClose={() => setShowSuggestConfig(false)}
        />
      )}
```

**Step 5: Update the retry handler in SuggestPreviewModal**

Change the `onRetry` prop (line 397) to re-open the config modal instead of directly calling handleSuggest:

From: `onRetry={() => { setSuggestPreview(null); handleSuggest() }}`
To: `onRetry={() => { setSuggestPreview(null); setShowSuggestConfig(true) }}`

**Step 6: Verify lint passes**

Run: `npm run lint`

**Step 7: Manual test**

1. Navigate to `/recipes`
2. Click "Suggere-moi" button
3. Verify the config modal appears with slider (default 2/1)
4. Move slider, verify counts update
5. Click "Suggere-moi !" and verify the suggestion flow works
6. When SuggestPreviewModal appears, click retry → verify config modal reopens

**Step 8: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat(recipes): integrate SuggestConfigModal with inventory/discovery split and anti-duplicate data"
```

---

## Task 5: Update suggest-recipes API with new params

**Files:**
- Modify: `api/suggest-recipes.js`

**Step 1: Extract new parameters from request body**

Replace line 16:

From:
```javascript
const { inventory, lang, preferences } = req.body
```

To:
```javascript
const { inventory, lang, preferences, inventoryCount = 3, discoveryCount = 0, existingRecipes, tasteProfile } = req.body
```

**Step 2: Rewrite the prompt construction**

Replace the prompt construction (lines 41-91) with a segmented prompt that handles inventory vs. discovery recipes, anti-duplicates, and taste profile:

```javascript
  // Build anti-duplicate section
  let antiDuplicateSection = ''
  if (existingRecipes?.length) {
    const recipeList = existingRecipes.map(r => `- ${r.name} (${r.category})`).join('\n')
    antiDuplicateSection = `
ANTI-DOUBLON — Le carnet de recettes contient deja ces plats:
${recipeList}

Tu ne dois PAS proposer de recettes identiques ou trop similaires (meme plat avec variante mineure, meme base avec garniture differente). Privilegie la diversite culinaire.
`
  }

  // Build taste profile section
  let tasteProfileSection = ''
  if (tasteProfile) {
    const parts = []
    if (tasteProfile.axes) {
      const axeLabels = { sweetness: 'sucre', saltiness: 'sale', spiciness: 'epice', acidity: 'acidite', bitterness: 'amertume', umami: 'umami', richness: 'richesse' }
      for (const [key, val] of Object.entries(tasteProfile.axes)) {
        if (val != null) parts.push(`- Tolerance ${axeLabels[key] || key}: ${val}/5`)
      }
    }
    if (tasteProfile.bannedIngredients?.length) {
      parts.push(`- Ingredients bannis: ${tasteProfile.bannedIngredients.join(', ')}`)
    }
    if (tasteProfile.dietaryRestrictions?.length) {
      parts.push(`- Restrictions alimentaires: ${tasteProfile.dietaryRestrictions.join(', ')}`)
    }
    if (tasteProfile.notes) {
      parts.push(`- Notes: "${tasteProfile.notes}"`)
    }
    if (parts.length) {
      tasteProfileSection = `
PROFIL GUSTATIF DU FOYER:
${parts.join('\n')}

CONSIGNES GUSTATIVES:
- Ne propose JAMAIS de recettes contenant des ingredients bannis.
- Respecte les restrictions alimentaires de TOUS les membres.
- Adapte les niveaux d'epices/acidite au profil le plus sensible.
- Si une recette contient un element sensible, propose une alternative ou adaptation.
`
    }
  }

  // Build the segmented prompt
  const inventorySection = inventoryCount > 0
    ? `${inventoryCount} recette(s) INVENTAIRE: basee(s) principalement sur les ingredients disponibles ci-dessous. Priorise les ingredients proches de la date de peremption.`
    : ''

  const discoverySection = discoveryCount > 0
    ? `${discoveryCount} recette(s) DECOUVERTE: recette(s) creative(s) et variee(s). Tu peux utiliser quelques ingredients de l'inventaire si pertinent, mais l'objectif est de proposer quelque chose de different et inspirant (cuisines du monde, tendances, etc.).`
    : ''

  const prompt = `Tu es un chef cuisinier creatif. Voici les ingredients disponibles dans un foyer:

${ingredientList}

${preferences ? `Preferences: ${preferences}` : ''}
${antiDuplicateSection}
${tasteProfileSection}

Genere exactement ${inventoryCount + discoveryCount} recettes reparties ainsi:
${inventorySection}
${discoverySection}

Tu peux supposer la presence de condiments basiques: sel, poivre, huile, etc.

Reponds UNIQUEMENT en JSON valide (pas de markdown), sous ce format exact:
{
  "recipes": [
    {
      "name": "Nom de la recette",
      "description": "Description courte (1-2 phrases)",
      "category": "appetizer|main|dessert|snack|drink|other",
      "difficulty": "easy|medium|hard",
      "prep_time": 15,
      "cook_time": 30,
      "servings": 4,
      "ingredients": [{"name": "ingredient", "quantity": 200, "unit": "g"}],
      "steps": [{"instruction": "Etape detaillee", "duration_minutes": 5}],
      "equipment": ["Four"],
      "tips": ["Astuce utile"],
      "translations": {
        "${otherLangs[0]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"],
          "equipment": ["Translated equipment"]
        },
        "${otherLangs[1]}": {
          "name": "Translated name",
          "description": "Translated description",
          "ingredients": [{"name": "translated ingredient name"}],
          "steps": [{"instruction": "Translated step instruction"}],
          "tips": ["Translated tip"],
          "equipment": ["Translated equipment"]
        }
      }
    }
  ]
}

Les champs principaux (name, description, ingredients, steps, tips) sont en ${langLabel}.
Le champ "translations" contient les traductions en ${otherLangLabels}.
Pour les traductions d'ingredients, garde le meme ordre et nombre que le tableau principal, avec seulement le champ "name" traduit.
Pour les traductions de steps, garde le meme ordre avec seulement "instruction" traduit.
category, difficulty, prep_time, cook_time, servings restent identiques (pas besoin de les traduire).`
```

**Step 3: Verify lint passes**

Run: `npm run lint`

**Step 4: Manual test**

1. Start local API server: `npm run dev:api`
2. From RecipesPage, use the slider to set different ratios (3/0, 2/1, 1/2, 0/3)
3. Verify recipes are generated correctly for each ratio
4. Verify anti-duplicate works: add a recipe to the book, then suggest — the same recipe should not appear

**Step 5: Commit**

```bash
git add api/suggest-recipes.js
git commit -m "feat(api): add inventory/discovery split, anti-duplicate, and taste profile to suggest-recipes"
```

---

## Task 6: Create ProfilePage with taste profile editing

**Files:**
- Create: `src/pages/ProfilePage.jsx`

**Step 1: Create the ProfilePage component**

Create `src/pages/ProfilePage.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const TASTE_AXES = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']

const DIETARY_OPTIONS = [
  'vegetarian', 'vegan', 'glutenFree', 'lactoseFree', 'halal', 'kosher', 'nutFree',
]

export default function ProfilePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const [household, setHousehold] = useState(null)
  const [tasteAxes, setTasteAxes] = useState(
    Object.fromEntries(TASTE_AXES.map(a => [a, 3]))
  )
  const [bannedIngredients, setBannedIngredients] = useState([])
  const [bannedInput, setBannedInput] = useState('')
  const [dietaryRestrictions, setDietaryRestrictions] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Fetch household name
  useEffect(() => {
    if (!profile?.household_id) return
    supabase.from('households').select('name').eq('id', profile.household_id).single()
      .then(({ data }) => setHousehold(data))
  }, [profile?.household_id])

  // Fetch existing taste preferences
  useEffect(() => {
    if (!profile?.id) return
    supabase.from('taste_preferences').select('*').eq('profile_id', profile.id).single()
      .then(({ data }) => {
        if (data) {
          const axes = {}
          for (const a of TASTE_AXES) {
            axes[a] = data[a] ?? 3
          }
          setTasteAxes(axes)
          setBannedIngredients(data.banned_ingredients || [])
          setDietaryRestrictions(data.dietary_restrictions || [])
          setNotes(data.notes || '')
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [profile?.id])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await supabase.from('taste_preferences').upsert({
      profile_id: profile.id,
      ...tasteAxes,
      banned_ingredients: bannedIngredients,
      dietary_restrictions: dietaryRestrictions,
      notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addBannedIngredient = () => {
    const val = bannedInput.trim().toLowerCase()
    if (val && !bannedIngredients.includes(val)) {
      setBannedIngredients(prev => [...prev, val])
    }
    setBannedInput('')
  }

  const removeBannedIngredient = (ingredient) => {
    setBannedIngredients(prev => prev.filter(i => i !== ingredient))
  }

  const toggleRestriction = (restriction) => {
    setDietaryRestrictions(prev =>
      prev.includes(restriction)
        ? prev.filter(r => r !== restriction)
        : [...prev, restriction]
    )
  }

  const initial = profile?.display_name?.charAt(0)?.toUpperCase() || '?'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        {t('profile.back')}
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
          {initial}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{profile?.display_name}</h1>
          {household && (
            <p className="text-sm text-gray-500">{t('profile.household', { name: household.name })}</p>
          )}
        </div>
      </div>

      {/* Taste axes */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('profile.tasteTitle')}</h2>
        <div className="space-y-4">
          {TASTE_AXES.map(axis => (
            <div key={axis}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">{t(`profile.${axis}`)}</label>
                <span className="text-sm font-bold text-orange-500">{tasteAxes[axis]}/5</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10">{t('profile.tasteLow')}</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={tasteAxes[axis]}
                  onChange={e => setTasteAxes(prev => ({ ...prev, [axis]: Number(e.target.value) }))}
                  className="flex-1 accent-orange-500"
                />
                <span className="text-xs text-gray-400 w-10 text-right">{t('profile.tasteHigh')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dietary restrictions */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('profile.restrictionsTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => toggleRestriction(opt)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                dietaryRestrictions.includes(opt)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t(`diet.${opt}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Banned ingredients */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('profile.bannedTitle')}</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={bannedInput}
            onChange={e => setBannedInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBannedIngredient()}
            placeholder={t('profile.bannedPlaceholder')}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
          <button
            onClick={addBannedIngredient}
            disabled={!bannedInput.trim()}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
        {bannedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bannedIngredients.map(ingredient => (
              <span key={ingredient} className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                {ingredient}
                <button
                  onClick={() => removeBannedIngredient(ingredient)}
                  className="hover:text-red-900 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('profile.notesTitle')}</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('profile.notesPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none"
        />
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-medium transition-colors cursor-pointer ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50'
        }`}
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
        ) : saved ? t('profile.saved') : t('profile.save')}
      </button>
    </div>
  )
}
```

**Step 2: Verify lint passes**

Run: `npm run lint`

**Step 3: Commit**

```bash
git add src/pages/ProfilePage.jsx
git commit -m "feat(profile): create ProfilePage with taste axes, dietary restrictions, and banned ingredients"
```

---

## Task 7: Add /profile route and Navbar avatar link

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/layout/Navbar.jsx`

**Step 1: Add route in App.jsx**

Add the ProfilePage import (after the AILogsPage import, line 16):

```javascript
import ProfilePage from './pages/ProfilePage'
```

Add the route (after the `/ai-logs` route block, around line 86):

```jsx
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
```

Note: ProfilePage has no Layout wrapper (like AILogsPage) — it manages its own layout for a clean fullscreen feel.

**Step 2: Make avatar clickable in Navbar**

In `Navbar.jsx`, add the `Link` import (already imported at line 1, nothing to change).

Replace the mobile avatar `div` (lines 70-72):

From:
```jsx
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </div>
```

To:
```jsx
            <Link to="/profile" className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </Link>
```

Replace the desktop avatar `div` (lines 162-164):

From:
```jsx
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </div>
```

To:
```jsx
            <Link to="/profile" className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold hover:ring-2 hover:ring-orange-300 transition-shadow">
              {initial}
            </Link>
```

**Step 3: Verify lint passes**

Run: `npm run lint`

**Step 4: Manual test**

1. Click on the avatar (both mobile and desktop views)
2. Verify it navigates to `/profile`
3. Verify the ProfilePage loads with taste sliders, restrictions, banned ingredients, notes
4. Set some values, save, refresh → verify persistence
5. Click "Back" → verify navigation works

**Step 5: Commit**

```bash
git add src/App.jsx src/components/layout/Navbar.jsx
git commit -m "feat(profile): add /profile route and make Navbar avatar link to profile page"
```

---

## Task 8: Integrate taste profile into suggestion flow

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

**Step 1: Fetch and aggregate household taste profiles**

In `RecipesPage.jsx`, add a function to fetch and aggregate taste profiles. Add this inside the component, after the inventory fetch `useEffect`:

```javascript
  // Fetch aggregated household taste profile for suggestions
  const fetchTasteProfile = useCallback(async () => {
    if (!profile?.household_id) return null
    const { data } = await supabase
      .from('taste_preferences')
      .select('sweetness, saltiness, spiciness, acidity, bitterness, umami, richness, banned_ingredients, dietary_restrictions, notes')
      .in('profile_id', (
        await supabase.from('profiles').select('id').eq('household_id', profile.household_id)
      ).data?.map(p => p.id) || [])

    if (!data?.length) return null

    // Aggregate: minimum for each axis (to please everyone)
    const axes = {}
    const tasteKeys = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']
    for (const key of tasteKeys) {
      const values = data.map(d => d[key]).filter(v => v != null)
      if (values.length) axes[key] = Math.min(...values)
    }

    // Union of banned ingredients and dietary restrictions
    const bannedSet = new Set()
    const restrictionSet = new Set()
    const notesList = []
    for (const d of data) {
      (d.banned_ingredients || []).forEach(i => bannedSet.add(i))
      ;(d.dietary_restrictions || []).forEach(r => restrictionSet.add(r))
      if (d.notes) notesList.push(d.notes)
    }

    return {
      axes,
      bannedIngredients: [...bannedSet],
      dietaryRestrictions: [...restrictionSet],
      notes: notesList.join(' | '),
    }
  }, [profile?.household_id])
```

**Step 2: Use taste profile in handleSuggest**

In the `handleSuggest` function, after computing `existingRecipes` and before the `try` block, add:

```javascript
    // Fetch aggregated taste profile
    const tasteProfile = await fetchTasteProfile()
```

And add `tasteProfile` to the API call payload:

```javascript
      const res = await apiPost('/api/suggest-recipes', {
        inventory: inventoryItems,
        lang,
        inventoryCount,
        discoveryCount,
        existingRecipes,
        tasteProfile,
      }, { signal: controller.signal })
```

Add `fetchTasteProfile` to the `useCallback` dependency array of `handleSuggest`.

**Step 3: Verify lint passes**

Run: `npm run lint`

**Step 4: Manual test**

1. Go to `/profile`, set taste preferences (e.g., spiciness = 1, ban "coriandre")
2. Go to `/recipes`, trigger suggestion
3. Verify the AI avoids overly spicy recipes and never includes coriandre

**Step 5: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat(recipes): fetch and send aggregated household taste profile with suggestions"
```

---

## Task 9: Add updateTasteProfile to Miam orchestrator

**Files:**
- Modify: `api/miam-orchestrator.js`
- Modify: `src/contexts/MiamContext.jsx`

**Step 1: Add tool declaration in miam-orchestrator.js**

After the `suggestRecipes` declaration (line 290), add:

```javascript
  {
    name: 'updateTasteProfile',
    description: 'Update the taste profile of the current user. Used to adjust taste preferences based on recipe ratings or explicit feedback. Each axis is a value from 1 to 5.',
    parameters: {
      type: 'object',
      properties: {
        sweetness: { type: 'number', description: 'Sweetness tolerance (1-5)' },
        saltiness: { type: 'number', description: 'Saltiness tolerance (1-5)' },
        spiciness: { type: 'number', description: 'Spiciness tolerance (1-5)' },
        acidity: { type: 'number', description: 'Acidity tolerance (1-5)' },
        bitterness: { type: 'number', description: 'Bitterness tolerance (1-5)' },
        umami: { type: 'number', description: 'Umami affinity (1-5)' },
        richness: { type: 'number', description: 'Richness affinity (1-5)' },
      },
      required: [],
    },
  },
```

**Step 2: Add updateTasteProfile to ALWAYS_AVAILABLE**

Add `'updateTasteProfile'` to the end of the `ALWAYS_AVAILABLE` array (line 294).

**Step 3: Add taste profile context to system prompt**

In the `buildSystemPrompt` function, after the `recipesSection` (around line 316), add a taste profile section:

```javascript
  const tasteSection = context.tasteProfile
    ? `- Profil gustatif de l'utilisateur: ${JSON.stringify(context.tasteProfile)}\n`
    : ''
```

Include `tasteSection` in the system prompt where the other context sections are concatenated.

**Step 4: Add handler in MiamContext.jsx**

In `MiamContext.jsx`, inside the `executeAction` function, add a handler for `updateTasteProfile` alongside the other recipe handlers:

```javascript
      case 'updateTasteProfile': {
        const updates = {}
        const axes = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']
        for (const axis of axes) {
          if (args[axis] != null) {
            updates[axis] = Math.max(1, Math.min(5, Math.round(args[axis])))
          }
        }
        if (Object.keys(updates).length === 0) return { success: false, error: 'No axes to update' }
        updates.updated_at = new Date().toISOString()
        await supabase.from('taste_preferences').upsert({
          profile_id: profile.id,
          ...updates,
        }, { onConflict: 'profile_id' })
        return { success: true, message: t('miam.action.updateTasteProfile') }
      }
```

**Step 5: Pass taste profile in context**

In `MiamContext.jsx`, where the context object is built before sending to the orchestrator API, add the user's taste profile:

```javascript
// Fetch current user taste profile for context
const { data: tasteData } = await supabase
  .from('taste_preferences')
  .select('sweetness, saltiness, spiciness, acidity, bitterness, umami, richness, banned_ingredients, dietary_restrictions, notes')
  .eq('profile_id', profile.id)
  .single()

// Add to context object
context.tasteProfile = tasteData || null
```

**Step 6: Verify lint passes**

Run: `npm run lint`

**Step 7: Manual test**

1. Open Miam, say "I found [recipe X] too spicy, can you adjust my taste profile?"
2. Verify Miam calls `updateTasteProfile` with adjusted spiciness
3. Go to `/profile` and verify the spiciness value has been updated
4. Rate a recipe low via Miam → verify Miam considers adjusting the profile

**Step 8: Commit**

```bash
git add api/miam-orchestrator.js src/contexts/MiamContext.jsx
git commit -m "feat(miam): add updateTasteProfile function for adaptive taste profile updates"
```

---

## Task 10: Final integration verification

**Step 1: Run full lint check**

Run: `npm run lint`
Fix any errors found.

**Step 2: Full manual test scenario**

1. **Profile setup:** Go to `/profile` via avatar click. Set:
   - Spiciness: 2/5
   - Ban: "coriandre"
   - Restriction: "Sans gluten"
   - Notes: "Prefere les plats legers"
   - Save

2. **Pre-suggestion flow:** Go to `/recipes`. Click "Suggere-moi".
   - Verify config modal appears with slider
   - Set to 1 inventaire / 2 decouverte
   - Click "Suggere-moi !"

3. **Verify suggestions:**
   - 1 recipe should use inventory ingredients
   - 2 recipes should be creative/varied
   - No recipe should contain coriandre
   - No recipe should contain gluten
   - Recipes should not be overly spicy
   - No recipe should duplicate existing cookbook entries

4. **Save a recipe** and re-suggest → verify it doesn't appear again

5. **Miam integration:** Ask Miam "Update my spiciness to 4" → verify profile updates

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues from recipe suggestions improvement"
```
