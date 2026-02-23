# CLAUDE.md - Contexte projet CuisineDuo

## Directives de session

- **Au debut de chaque session**, lire attentivement les fichiers `README.md` et `CONTRIBUTING.md` pour se remettre en contexte des objectifs et des standards du projet.
- **Fin de branche** : Lorsque l'utilisateur indique "fin de branche" (ou similaire), proceder a la fusion de la branche courante vers `main` en utilisant `git merge --no-ff`. Cela permet de conserver l'historique des commits successifs de la branche tout en gardant une trace claire de la fusion dans `main` (evite le fast-forward).

## Description du projet

CuisineDuo est une **Progressive Web App (PWA)** de gestion culinaire collaborative pour un foyer. Elle permet a plusieurs membres de gerer ensemble leur inventaire alimentaire, decouvrir et cuisiner des recettes, planifier les repas par un systeme de vote swipe, et communiquer via un chat integre avec un assistant IA nomme **Miam**.

L'application est concue **mobile-first**, installable, avec synchronisation temps reel entre appareils via Supabase Realtime.

---

## Stack technique

- **Frontend** : React 19 + React Router 7 + Tailwind CSS 4 (via plugin Vite `@tailwindcss/vite`)
- **Build** : Vite 7
- **Backend** : Vercel Serverless Functions (dossier `api/`)
- **Base de donnees** : Supabase (PostgreSQL + Realtime + Row Level Security)
- **IA** : Google Gemini 2.0 Flash (`@google/generative-ai`)
- **Notifications** : Web Push API avec cles VAPID
- **Voix** : Web Speech API + correction par Gemini
- **PWA** : Service Worker (`public/sw.js`) + Web App Manifest

---

## Architecture et patterns cles

### Structure des fichiers

```
src/
  components/    # Composants React organises par domaine (layout/, recipes/, inventory/, swipe/, shopping/, cooking/)
  contexts/      # AuthContext (profils) + LanguageContext (i18n FR/EN/ZH)
  hooks/         # Hooks custom metier (useNotifications, useSwipeSession, useDictation, etc.)
  pages/         # Un fichier par page/route
  lib/           # supabase.js (client Supabase)
  i18n/          # translations.js (cles de traduction)
api/             # Fonctions serverless Vercel (une par fichier)
public/          # Manifest PWA, Service Worker, icones
```

### Conventions de nommage

- **Composants** : PascalCase, extension `.jsx` (ex: `RecipeDetailPage.jsx`)
- **Hooks** : camelCase avec prefixe `use`, extension `.js` (ex: `useSwipeSession.js`)
- **Fichiers API** : kebab-case, extension `.js` (ex: `chat-ai.js`)
- **CSS** : Classes utilitaires Tailwind directement dans le JSX, pas de fichiers CSS par composant

### Gestion d'etat

- **React Context API** uniquement (pas de Redux/Zustand)
- `AuthContext` : expose `{ user, profile, loading, passwordRecovery, signIn, signUp, signOut, resetPassword, updatePassword, refreshProfile }`. La session est geree par Supabase Auth (token stocke automatiquement dans `localStorage` par le client Supabase). `LanguageContext` : langue courante (`'fr'`/`'en'`/`'zh'`), stockee en `localStorage` sous `'lang'`
- Etat local avec `useState`/`useEffect` dans les composants
- **Supabase Realtime** pour la synchronisation inter-appareils (messages, votes, inventaire)

### Authentification

Systeme base sur **Supabase Auth** (email + mot de passe) :
1. L'utilisateur s'inscrit avec email/mot de passe + `display_name` → Supabase cree un `auth.users` et un trigger cree automatiquement la ligne `profiles` correspondante (meme `id`)
2. La session est persistee automatiquement par le client Supabase JS
3. `AuthContext` ecoute `supabase.auth.onAuthStateChange` comme **unique source de verite** pour la session
4. Apres `SIGNED_IN`, `AuthContext` charge le `profile` depuis la table `profiles` (meme `id` que `auth.users`)
5. `AuthContext` fournit `user` (objet Supabase Auth) et `profile` (ligne de la table `profiles` avec `id`, `display_name`, `household_id`)
6. `ProtectedRoute` redirige vers `/login` si `!user`, vers `/onboarding` si `!profile?.household_id`
7. **Reset de mot de passe** : email avec lien → `PASSWORD_RECOVERY` event → redirect vers `/reset-password` → `updatePassword()`

**Piege technique — deadlock Supabase `onAuthStateChange`** :
Ne jamais faire `await supabase.from(...).select(...)` directement dans le callback `onAuthStateChange` — le client Supabase tient un verrou interne pendant le callback, ce qui bloque toute requete DB et provoque un deadlock (la requete ne se resout jamais). Solution : envelopper dans `setTimeout(async () => { ... }, 0)` pour sortir du verrou avant d'executer la requete.

```javascript
// CORRECT
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    setUser(session.user)
    setTimeout(async () => {
      const data = await fetchProfile(session.user.id) // OK hors du verrou
      setProfile(data)
    }, 0)
  }
})

// INCORRECT — deadlock garanti
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    const data = await fetchProfile(session.user.id) // bloque indefiniment
  }
})
```

### Internationalisation

- Hook `useLanguage()` retourne `{ lang, setLang, t }`
- Fonction `t(key, params)` avec variables au format `{{nomVariable}}`
- Cles de traduction dans `src/i18n/translations.js`
- Fallback : FR si cle manquante dans la langue courante

---

## Routage

Toutes les routes sont definies dans `src/App.jsx` :

| Route | Page | Layout | Notes |
|-------|------|--------|-------|
| `/login` | LoginPage | Non | Publique — affiche loader si session en cours de restauration |
| `/onboarding` | OnboardingPage | Non | Publique |
| `/reset-password` | ResetPasswordPage | Non | Publique — accessible uniquement via lien email (`passwordRecovery=true`) |
| `/` | HomePage | Oui | Dashboard |
| `/inventory` | InventoryPage | Oui | |
| `/recipes` | RecipesPage | Oui | |
| `/recipes/:id` | RecipeDetailPage | Oui | |
| `/recipes/:id/cook` | CookingModePage | **Non** | Plein ecran |
| `/profile` | TasteProfilePage | Oui | |
| `/chat` | ChatPage | Oui | |
| `/shopping` | ShoppingListPage | Oui | |
| `/swipe/:sessionId` | SwipePage | **Non** | Plein ecran |
| `/swipe/:sessionId/results` | SwipeResultsPage | Oui | |
| `/ai-logs` | AILogsPage | **Non** | Protegee, sans Layout |

Le `Layout` inclut la `Navbar` (barre de navigation mobile en bas + barre desktop en haut) et un conteneur `max-w-5xl`.

---

## Pattern des fonctions API serverless

Chaque fichier dans `api/` exporte un `default handler(req, res)` avec cette structure :

```javascript
export default async function handler(req, res) {
  // 1. CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // 2. Validation methode
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 3. Extraction et validation du body
  const { param } = req.body

  // 4. Verification de la cle API
  const apiKey = process.env.GEMINI_API_KEY

  // 5. Logique metier dans un try-catch
  try {
    // ... appel Gemini, traitement
    return res.status(200).json({ result })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ error: 'Operation failed' })
  }
}
```

**Integration Gemini** :
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
```

Toutes les methodes sont **POST**. Les reponses d'erreur suivent le format `{ error: string }`.

---

## Base de donnees (Supabase) — Schema complet

Le SQL source est dans `archivesqleditor/CuisineDuo_Full_Schema_&_RLS.sql`.
Les requetes utilisent directement le client `supabase` importe depuis `src/lib/supabase.js`.

### Regles generales

- **Toutes les donnees sont scopees par `household_id`** — c'est le critere de partage entre membres d'un foyer
- **RLS (Row Level Security)** active sur toutes les tables — les policies verifient l'appartenance au foyer via une sous-requete sur `profiles`
- **Supabase Realtime** active sur : `inventory_items`, `messages`, `recipes`, `recipe_comments`, `swipe_sessions`, `swipe_votes`, `shopping_list_items`
- Toutes les PK sont `UUID` avec `gen_random_uuid()`
- Toutes les tables ont un champ `created_at TIMESTAMPTZ default now()`
- **Storage** : bucket `recipe-images` avec policies publiques (lecture, upload, modification, suppression)

### 1. households

Foyer = unite de partage de toutes les donnees.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `name` | TEXT | NOT NULL |
| `invite_code` | TEXT | UNIQUE, auto-genere (6 caracteres hex) |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : ouvert (anyone can read/create/update).

### 2. profiles

Membres d'un foyer. Cree automatiquement par trigger Supabase a l'inscription. **L'`id` est identique a celui de `auth.users`** (pas d'UUID separe).

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK, = `auth.users.id` |
| `display_name` | TEXT | NOT NULL |
| `household_id` | UUID | FK → households(id) ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : ouvert (anyone can CRUD).

### 3. recipes

Recettes du foyer. Les champs `equipment`, `ingredients`, `steps`, `tips` sont des tableaux JSON.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households(id) ON DELETE CASCADE, NOT NULL |
| `created_by` | UUID | FK → profiles(id) ON DELETE CASCADE, NOT NULL |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `category` | TEXT | |
| `servings` | SMALLINT | |
| `prep_time` | SMALLINT | en minutes |
| `cook_time` | SMALLINT | en minutes |
| `difficulty` | TEXT | |
| `equipment` | JSONB | default `[]` |
| `ingredients` | JSONB | default `[]` |
| `steps` | JSONB | default `[]` |
| `tips` | JSONB | default `[]` |
| `image_url` | TEXT | |
| `image_source` | TEXT | default `'none'` |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id` (CRUD pour les membres du foyer).

### 4. inventory_items

Stock alimentaire actuel du foyer.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `added_by` | UUID | FK → profiles, NOT NULL |
| `name` | TEXT | NOT NULL |
| `brand` | TEXT | |
| `quantity` | NUMERIC | NOT NULL, default 1 |
| `unit` | TEXT | NOT NULL, default `'piece'` |
| `price` | NUMERIC | |
| `price_per_kg` | NUMERIC | |
| `price_estimated` | BOOLEAN | default false |
| `category` | TEXT | NOT NULL, default `'other'` |
| `purchase_date` | DATE | |
| `estimated_expiry_date` | DATE | |
| `fill_level` | SMALLINT | default 1 |
| `store` | TEXT | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 5. consumed_items

Historique des articles consommes (copies depuis `inventory_items` a la consommation).

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `consumed_by` | UUID | FK → profiles, NOT NULL |
| `added_by` | UUID | FK → profiles, ON DELETE SET NULL |
| `name` | TEXT | NOT NULL |
| `brand` | TEXT | |
| `quantity` | NUMERIC | |
| `unit` | TEXT | |
| `price` | NUMERIC | |
| `price_per_kg` | NUMERIC | |
| `price_estimated` | BOOLEAN | default false |
| `category` | TEXT | |
| `purchase_date` | DATE | |
| `consumption_date` | DATE | default CURRENT_DATE |
| `store` | TEXT | |
| `notes` | TEXT | |
| `fill_level` | SMALLINT | default 1 |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 6. messages

Chat du foyer. Les messages de l'IA Miam ont `is_ai = true`.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `content` | TEXT | NOT NULL |
| `is_ai` | BOOLEAN | default false |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 7. recipe_comments

Commentaires sur les recettes.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `recipe_id` | UUID | FK → recipes(id) ON DELETE CASCADE, NOT NULL |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `content` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `recipe_id` (via sous-requete sur recipes).

### 8. push_subscriptions

Abonnements aux notifications push par appareil.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `household_id` | UUID | FK → households, NOT NULL |
| `subscription` | JSONB | NOT NULL (contient `endpoint`, `keys`) |
| `created_at` | TIMESTAMPTZ | default now() |

Index unique sur `(profile_id, subscription->>'endpoint')`.
RLS : lecture scope par `household_id`, ecriture/suppression ouverte.

### 9. swipe_sessions

Sessions de planification de repas par vote.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `created_by` | UUID | FK → profiles, NOT NULL |
| `title` | TEXT | NOT NULL, default `''` |
| `meal_count` | SMALLINT | NOT NULL, default 7 |
| `meal_types` | TEXT[] | NOT NULL, default `'{}'` |
| `status` | TEXT | NOT NULL, default `'generating'`, CHECK in (`generating`, `voting`, `completed`, `cancelled`) |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 10. swipe_session_recipes

Recettes proposees dans une session de swipe. Peut etre liee a une recette existante ou etre une suggestion IA.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `session_id` | UUID | FK → swipe_sessions, NOT NULL |
| `recipe_id` | UUID | FK → recipes, ON DELETE SET NULL (nullable) |
| `name` | TEXT | NOT NULL |
| `description` | TEXT | |
| `category` | TEXT | |
| `image_url` | TEXT | |
| `difficulty` | TEXT | |
| `prep_time` | SMALLINT | |
| `cook_time` | SMALLINT | |
| `servings` | SMALLINT | |
| `ai_recipe_data` | JSONB | donnees completes de la recette generee par l'IA |
| `is_existing_recipe` | BOOLEAN | NOT NULL, default false |
| `sort_order` | SMALLINT | NOT NULL, default 0 |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `session_id` (via sous-requete sur swipe_sessions).

### 11. swipe_votes

Vote individuel d'un membre sur une recette proposee.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `session_recipe_id` | UUID | FK → swipe_session_recipes, NOT NULL |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `vote` | BOOLEAN | NOT NULL (true = like, false = dislike) |
| `created_at` | TIMESTAMPTZ | default now() |

Contrainte UNIQUE sur `(session_recipe_id, profile_id)`.
RLS : scope par `session_recipe_id` (via sous-requete sur swipe_session_recipes).

### 12. shopping_lists

Listes de courses, optionnellement liees a une session de swipe.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `name` | TEXT | NOT NULL, default `''` |
| `session_id` | UUID | FK → swipe_sessions, ON DELETE SET NULL (nullable) |
| `status` | TEXT | NOT NULL, default `'active'`, CHECK in (`active`, `completed`, `archived`) |
| `created_by` | UUID | FK → profiles, NOT NULL |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 13. shopping_list_items

Elements d'une liste de courses.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `list_id` | UUID | FK → shopping_lists, NOT NULL |
| `name` | TEXT | NOT NULL |
| `quantity` | NUMERIC | |
| `unit` | TEXT | |
| `category` | TEXT | |
| `recipe_name` | TEXT | recette d'origine (informatif) |
| `checked` | BOOLEAN | NOT NULL, default false |
| `checked_by` | UUID | FK → profiles, ON DELETE SET NULL |
| `checked_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `sort_order` | SMALLINT | NOT NULL, default 0 |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `list_id` (via sous-requete sur shopping_lists).

### 14. cooking_history

Historique des recettes cuisinees.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `recipe_id` | UUID | FK → recipes, NOT NULL |
| `household_id` | UUID | FK → households, NOT NULL |
| `cooked_by` | UUID | FK → profiles, NOT NULL |
| `cooked_at` | TIMESTAMPTZ | NOT NULL, default now() |
| `notes` | TEXT | |
| `servings_cooked` | SMALLINT | |
| `created_at` | TIMESTAMPTZ | default now() |

RLS : scope par `household_id`.

### 15. recipe_taste_params

Profil gustatif d'une recette (7 axes, echelle 1-5).

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `recipe_id` | UUID | FK → recipes, NOT NULL, UNIQUE |
| `sweetness` | SMALLINT | CHECK 1-5 |
| `saltiness` | SMALLINT | CHECK 1-5 |
| `spiciness` | SMALLINT | CHECK 1-5 |
| `acidity` | SMALLINT | CHECK 1-5 |
| `bitterness` | SMALLINT | CHECK 1-5 |
| `umami` | SMALLINT | CHECK 1-5 |
| `richness` | SMALLINT | CHECK 1-5 |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

RLS : scope par `recipe_id` (via sous-requete sur recipes).

### 16. recipe_ratings

Notes individuelles sur les recettes (1-5 etoiles).

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `recipe_id` | UUID | FK → recipes, NOT NULL |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `rating` | SMALLINT | NOT NULL, CHECK 1-5 |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

Contrainte UNIQUE sur `(recipe_id, profile_id)`.
RLS : scope par `recipe_id` (via sous-requete sur recipes).

### 17. taste_preferences

Preferences gustatives personnelles d'un membre (memes 7 axes que recipe_taste_params).

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `profile_id` | UUID | FK → profiles, NOT NULL, UNIQUE |
| `sweetness` | SMALLINT | CHECK 1-5 |
| `saltiness` | SMALLINT | CHECK 1-5 |
| `spiciness` | SMALLINT | CHECK 1-5 |
| `acidity` | SMALLINT | CHECK 1-5 |
| `bitterness` | SMALLINT | CHECK 1-5 |
| `umami` | SMALLINT | CHECK 1-5 |
| `richness` | SMALLINT | CHECK 1-5 |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | default now() |

RLS : ouvert (anyone can CRUD).

### Relations cles (resume)

```
households 1──N profiles
households 1──N recipes
households 1──N inventory_items
households 1──N consumed_items
households 1──N messages
households 1──N swipe_sessions
households 1──N shopping_lists
households 1──N cooking_history
households 1──N push_subscriptions

profiles 1──1 taste_preferences
profiles 1──N recipe_ratings
profiles 1──N recipe_comments
profiles 1──N swipe_votes

recipes 1──1 recipe_taste_params
recipes 1──N recipe_comments
recipes 1──N recipe_ratings
recipes 1──N cooking_history

swipe_sessions 1──N swipe_session_recipes
swipe_session_recipes 1──N swipe_votes
swipe_session_recipes N──1 recipes (nullable, pour recettes existantes)

shopping_lists 1──N shopping_list_items
shopping_lists N──1 swipe_sessions (nullable)
```

---

## Variables d'environnement

| Variable | Acces | Usage |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | Client | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Client | Cle anonyme Supabase |
| `VITE_VAPID_PUBLIC_KEY` | Client | Cle publique VAPID pour le push |
| `GEMINI_API_KEY` | Serveur | Cle API Gemini principale |
| `GEMINI_SCAN_API_KEY` | Serveur | Cle API Gemini pour le scan |
| `VAPID_PRIVATE_KEY` | Serveur | Cle privee VAPID |

Les variables `VITE_*` sont exposees cote client via Vite. Les autres ne sont accessibles que dans les fonctions `api/`.

---

## Developpement local

```bash
npm run dev        # Frontend Vite sur http://localhost:5173
npm run dev:api    # API Express sur http://localhost:3001 (charge automatiquement tous les fichiers api/*.js)
npm run build      # Build production dans dist/
npm run lint       # ESLint
```

Le proxy Vite redirige `/api/*` vers `localhost:3001` en developpement (configure dans `vite.config.js`).

Le serveur API local (`api-dev-server.js`) charge dynamiquement tous les fichiers `api/*.js` comme routes Express et utilise `dotenv` pour les variables d'environnement. Le body JSON est limite a 10 MB.

---

## Deploiement

- Heberge sur **Vercel**
- Configuration dans `vercel.json` : rewrites pour les routes API et SPA fallback
- Les fonctions `api/` sont deployees automatiquement comme Vercel Serverless Functions
- La branche principale est `main`

---

## Conventions de code

- **Langue du code** : anglais pour les noms de variables/fonctions, francais pour les commentaires et l'UI par defaut
- **Commits** : Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `chore`) — voir `CONTRIBUTING.md`
- **Branches** : `feature/`, `fix/`, `refactor/` — jamais de commit direct sur `main`
- **Linting** : ESLint 9 avec config flat, `no-unused-vars` ignore les noms commencant par une majuscule ou `_`
- **Pas de TypeScript** — le projet est en JavaScript pur avec JSX
- **Pas de tests automatises** — tester manuellement avant de fusionner vers `main`
- **Styling** : Tailwind CSS uniquement via classes utilitaires dans le JSX
- **Couleur primaire** : orange (`#f97316` / classes `orange-500`)
- **Couleur secondaire IA** : indigo (`#6366f1` / classes `indigo-*`) pour les elements lies a l'IA
