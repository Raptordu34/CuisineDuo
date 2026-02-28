# CLAUDE.md - Contexte projet CuisineDuo

## Directives de session

- **Au debut de chaque session**, lire attentivement les fichiers `README.md` et `CONTRIBUTING.md` pour se remettre en contexte des objectifs et des standards du projet.
- **Fin de branche** : Lorsque l'utilisateur indique "fin de branche" (ou similaire), proceder a la fusion de la branche courante vers `main` en utilisant `git merge --no-ff`. Cela permet de conserver l'historique des commits successifs de la branche tout en gardant une trace claire de la fusion dans `main` (evite le fast-forward).

## Description du projet

CuisineDuo est une **Progressive Web App (PWA)** de gestion culinaire collaborative pour un foyer. Elle permet a plusieurs membres de gerer ensemble leur inventaire alimentaire et de communiquer via un chat integre avec un assistant IA nomme **Miam**.

L'application est concue **mobile-first**, installable, avec synchronisation temps reel entre appareils via Supabase Realtime.

### Fonctionnalites actuelles

- **Inventaire alimentaire** : ajout manuel, scan de ticket de caisse (OCR Gemini), saisie vocale, suivi des prix/quantites/peremption, historique de consommation
- **Chat du foyer** : messagerie temps reel, GIFs (Giphy), reactions emoji, reponses/edition/suppression de messages, indicateurs de lecture, notifications push
- **Assistant IA Miam** : assistant contextuel avec function calling (orchestrateur), TTS, activation vocale ("Hey Miam"), actions dynamiques par page
- **Journaux IA** : page de debug pour les interactions IA (logs)
- **Multilingue** : interface en francais, anglais et chinois

> **Note** : Les fonctionnalites recettes, swipe/planification de repas, listes de courses, mode cuisine et profil gustatif ont ete retirees du frontend. Les tables correspondantes existent toujours en base de donnees mais ne sont plus exploitees par l'application.

---

## Stack technique

- **Frontend** : React 19 + React Router 7 (`react-router-dom`) + Tailwind CSS 4 (via plugin Vite `@tailwindcss/vite`)
- **Build** : Vite 7 + `vite-plugin-pwa` (strategie `injectManifest` avec Workbox)
- **Backend** : Vercel Serverless Functions (dossier `api/`)
- **Base de donnees** : Supabase (PostgreSQL + Realtime + Row Level Security + Auth)
- **IA** : Google Gemini 2.0 Flash (`@google/generative-ai`)
- **GIFs** : Giphy API (recherche + suggestions IA)
- **Notifications** : Web Push API avec cles VAPID (`web-push`)
- **Voix** : Web Speech API + correction par Gemini
- **PWA** : Service Worker (`src/sw.js` via `vite-plugin-pwa`) + Web App Manifest

---

## Architecture et patterns cles

### Structure des fichiers

```
src/
  components/
    chat/          # EmojiPicker, GifPicker, MessageContextMenu, ReactionBadges, ReactionBar
    inventory/     # AddItemModal, CategoryFilter, ConsumeModal, EditItemModal, InAppCamera,
                   # InventoryItemCard, InventoryList, ScanReceiptButton, ScanReviewItemRow,
                   # ScanReviewModal, StoreSelectDialog
    layout/        # Layout, Navbar, ProtectedRoute, ReloadPrompt
    miam/          # MiamFAB (bouton flottant), MiamSheet (panneau conversationnel)
    DictationButton.jsx    # Bouton de dictee vocale
    DictationTrace.jsx     # Affichage visuel de la transcription en cours
    FillLevelPicker.jsx    # Selecteur visuel de niveau de remplissage
    LanguageSwitcher.jsx   # Selecteur de langue (FR/EN/ZH)
  contexts/
    AuthContext.jsx            # Authentification Supabase Auth (email/password, JWT, profil)
    LanguageContext.jsx        # Internationalisation (FR/EN/ZH)
    MiamContext.jsx            # Etat de l'assistant Miam (conversation, TTS, wake word, actions)
    UnreadMessagesContext.jsx  # Suivi des messages non lus et statuts de lecture
  hooks/
    useDictation.js          # Reconnaissance vocale + correction IA
    useLongPress.js          # Geste long press pour menu contextuel
    useMessageReactions.js   # Gestion des reactions emoji sur les messages
    useMiamActions.js        # Enregistrement d'actions Miam par page
    useNotifications.js      # Abonnement et envoi de notifications push
    useOnlineStatus.js       # Detection du statut en ligne/hors ligne
    useWakeWord.js           # Activation vocale "Hey Miam"
  pages/
    AILogsPage.jsx       # Page de debug des logs IA
    ChatPage.jsx         # Chat du foyer
    HomePage.jsx         # Tableau de bord
    InventoryPage.jsx    # Gestion des stocks
    LoginPage.jsx        # Connexion (email/password)
    OnboardingPage.jsx   # Creation/rejoindre un foyer
  lib/
    supabase.js    # Client Supabase
    apiClient.js   # Fetch wrapper authentifie (JWT Bearer token)
    aiLogger.js    # Logging silencieux des interactions IA vers la table ai_logs
  i18n/
    translations.js   # Cles de traduction multilingues
api/                   # Fonctions serverless Vercel (une par fichier)
public/                # Manifest PWA, icones
sql_history/           # Historique des migrations SQL
```

### Conventions de nommage

- **Composants** : PascalCase, extension `.jsx` (ex: `InventoryItemCard.jsx`)
- **Hooks** : camelCase avec prefixe `use`, extension `.js` (ex: `useDictation.js`)
- **Fichiers API** : kebab-case, extension `.js` (ex: `chat-ai.js`)
- **CSS** : Classes utilitaires Tailwind directement dans le JSX, pas de fichiers CSS par composant

### Gestion d'etat

- **React Context API** uniquement (pas de Redux/Zustand)
- `AuthContext` : authentification Supabase Auth, profil courant cache en `localStorage` sous `'cuisineduo_cached_profile'`
- `LanguageContext` : langue courante (`'fr'`/`'en'`/`'zh'`), stockee en `localStorage` sous `'lang'`
- `MiamContext` : etat de l'assistant Miam (conversation, TTS, wake word), historique persiste en `localStorage` par foyer
- `UnreadMessagesContext` : compteur de messages non lus, statuts de lecture par membre
- Etat local avec `useState`/`useEffect` dans les composants
- **Supabase Realtime** pour la synchronisation inter-appareils (messages, reactions, statuts de lecture, inventaire)

### Authentification

Systeme d'authentification complet via **Supabase Auth** :
1. L'utilisateur se connecte avec email et mot de passe sur `LoginPage` (`supabase.auth.signInWithPassword`)
2. Inscription via `supabase.auth.signUp` avec `display_name` en metadata
3. `profiles.id = auth.uid()` — le profil est lie a l'utilisateur Supabase
4. JWT automatiquement gere par le client Supabase, envoye aux API via `apiClient.js` (`Authorization: Bearer <token>`)
5. Profil cache en `localStorage` pour affichage instantane, synchronise en arriere-plan
6. `ProtectedRoute` redirige vers `/login` si pas de session, vers `/onboarding` si pas de `household_id`
7. Les policies RLS utilisent `auth.uid()` et la fonction `auth_user_household_id()`
8. Support de `resetPasswordForEmail` pour la reinitialisation du mot de passe

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
| `/login` | LoginPage | Non | Publique |
| `/onboarding` | OnboardingPage | Non | Publique |
| `/` | HomePage | Oui | Dashboard, protegee |
| `/inventory` | InventoryPage | Oui | Gestion des stocks, protegee |
| `/chat` | ChatPage | Oui | Chat du foyer, protegee |
| `/ai-logs` | AILogsPage | **Non** | Debug IA, protegee (pas de Layout) |

Le `Layout` inclut la `Navbar` (barre de navigation mobile en bas + barre desktop en haut) et un conteneur `max-w-5xl`.

L'arbre de providers est : `BrowserRouter > LanguageProvider > AuthProvider > UnreadMessagesProvider > MiamProvider`.

---

## Fonctions API serverless

Chaque fichier dans `api/` exporte un `default handler(req, res)` avec cette structure :

```javascript
export default async function handler(req, res) {
  // 1. CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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

### Endpoints disponibles

| Endpoint | Description |
|----------|-------------|
| `/api/miam-orchestrator` | Orchestrateur IA Miam avec function calling (actions contextuelles) |
| `/api/chat-ai` | Chat IA du foyer (legacy, encore present) |
| `/api/scan-receipt` | OCR de ticket de caisse ou photo d'aliments via Gemini |
| `/api/correct-transcription` | Correction IA d'une transcription vocale |
| `/api/verify-prices` | Verification IA des prix pour les articles au poids |
| `/api/gif-search` | Recherche et trending de GIFs via Giphy API |
| `/api/gif-suggest` | Suggestions de requetes GIF par Gemini + recherche Giphy |
| `/api/send-notification` | Envoi d'une notification push au foyer |
| `/api/subscribe-push` | Enregistrement/suppression d'un abonnement push |

**Integration Gemini** :
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai'
const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
```

Toutes les methodes sont **POST**. Les reponses d'erreur suivent le format `{ error: string }`.

---

## Base de donnees (Supabase) — Schema complet

Le SQL source est dans le dossier `sql_history/` (migrations successives).
Les requetes utilisent directement le client `supabase` importe depuis `src/lib/supabase.js`.

### Regles generales

- **Toutes les donnees sont scopees par `household_id`** — c'est le critere de partage entre membres d'un foyer
- **RLS (Row Level Security)** active sur toutes les tables — les policies utilisent `auth.uid()` et `auth_user_household_id()`
- **Supabase Realtime** active sur : `inventory_items`, `messages`, `message_reactions`, `chat_read_status`
- Toutes les PK sont `UUID` avec `gen_random_uuid()`
- Toutes les tables ont un champ `created_at TIMESTAMPTZ default now()`
- **Storage** : bucket `recipe-images` avec policies publiques

### Tables actives (utilisees par le frontend)

#### 1. households

Foyer = unite de partage de toutes les donnees.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `name` | TEXT | NOT NULL |
| `invite_code` | TEXT | UNIQUE, auto-genere (6 caracteres hex) |
| `created_at` | TIMESTAMPTZ | default now() |

#### 2. profiles

Membres d'un foyer. Lies a `auth.users` via `id = auth.uid()`.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK, = auth.uid() |
| `display_name` | TEXT | NOT NULL |
| `household_id` | UUID | FK → households(id) ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | default now() |

#### 3. inventory_items

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

#### 4. consumed_items

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

#### 5. messages

Chat du foyer. Supporte texte, GIFs, reponses, edition et suppression douce.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households, NOT NULL |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `content` | TEXT | NOT NULL |
| `is_ai` | BOOLEAN | default false |
| `message_type` | TEXT | default `'text'` (valeurs : `'text'`, `'gif'`) |
| `media_url` | TEXT | URL du GIF |
| `gif_title` | TEXT | Titre du GIF |
| `giphy_id` | TEXT | Identifiant Giphy |
| `reply_to_id` | UUID | FK → messages(id), pour les reponses |
| `edited_at` | TIMESTAMPTZ | Date de derniere edition |
| `deleted_at` | TIMESTAMPTZ | Suppression douce (soft delete) |
| `created_at` | TIMESTAMPTZ | default now() |

#### 6. message_reactions

Reactions emoji sur les messages du chat.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `message_id` | UUID | FK → messages(id) ON DELETE CASCADE, NOT NULL |
| `profile_id` | UUID | FK → profiles(id) ON DELETE CASCADE, NOT NULL |
| `emoji` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | default now() |

Contrainte UNIQUE sur `(message_id, profile_id, emoji)`. Realtime active.

#### 7. chat_read_status

Suivi du statut de lecture du chat par membre.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `profile_id` | UUID | FK → profiles(id) ON DELETE CASCADE, NOT NULL |
| `household_id` | UUID | FK → households(id) ON DELETE CASCADE, NOT NULL |
| `last_read_at` | TIMESTAMPTZ | NOT NULL, default now() |
| `created_at` | TIMESTAMPTZ | default now() |

Contrainte UNIQUE sur `(profile_id, household_id)`. Realtime active.

#### 8. push_subscriptions

Abonnements aux notifications push par appareil.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `profile_id` | UUID | FK → profiles, NOT NULL |
| `household_id` | UUID | FK → households, NOT NULL |
| `subscription` | JSONB | NOT NULL (contient `endpoint`, `keys`) |
| `created_at` | TIMESTAMPTZ | default now() |

Index unique sur `(profile_id, subscription->>'endpoint')`.

#### 9. ai_logs

Logs des interactions IA pour debug.

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK |
| `household_id` | UUID | FK → households(id) ON DELETE CASCADE |
| `profile_id` | UUID | FK → profiles(id) ON DELETE SET NULL |
| `endpoint` | TEXT | NOT NULL (ex: `'miam-orchestrator'`, `'scan-receipt'`) |
| `input` | JSONB | Donnees envoyees a l'IA |
| `output` | JSONB | Reponse recue |
| `duration_ms` | INTEGER | Duree de l'appel en ms |
| `error` | TEXT | Message d'erreur si echec |
| `created_at` | TIMESTAMPTZ | default now() |

### Tables legacy (en base mais non utilisees par le frontend)

Les tables suivantes existent en base de donnees mais ne sont plus exploitees par le frontend actuel :

`recipes`, `recipe_comments`, `recipe_taste_params`, `recipe_ratings`, `cooking_history`, `taste_preferences`, `swipe_sessions`, `swipe_session_recipes`, `swipe_votes`, `shopping_lists`, `shopping_list_items`

### Relations cles (tables actives)

```
households 1──N profiles
households 1──N inventory_items
households 1──N consumed_items
households 1──N messages
households 1──N push_subscriptions
households 1──N ai_logs

profiles 1──1 chat_read_status (par foyer)

messages 1──N message_reactions
messages N──1 messages (reply_to_id, auto-reference)
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
| `GIPHY_API_KEY` | Serveur | Cle API Giphy pour les GIFs |
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
- Configuration dans `vercel.json` : cache headers (assets immutables, index.html no-cache), rewrites pour les routes API et SPA fallback
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

## Historique des migrations SQL

Les fichiers dans `sql_history/` documentent l'evolution du schema :

| Fichier | Description |
|---------|-------------|
| `init_schema.sql` | Schema initial complet (toutes les tables) |
| `drop_all_tables.sql` | Suppression de toutes les tables |
| `storage_policies.sql` | Policies du bucket `recipe-images` |
| `check_realtime_config.sql` | Verification de la config Realtime |
| `add_chat_read_status.sql` | Table `chat_read_status` |
| `add_reactions.sql` | Table `message_reactions` |
| `add_reply_edit_delete.sql` | Colonnes `reply_to_id`, `deleted_at`, `edited_at` sur `messages` |
| `add_gifs.sql` | Colonnes `message_type`, `media_url` sur `messages` |
| `add_gif_metadata.sql` | Colonnes `gif_title`, `giphy_id` sur `messages` |
| `add_ai_logs.sql` | Table `ai_logs` |
| `migrate_to_supabase_auth.sql` | Migration vers Supabase Auth (RLS avec `auth.uid()`) |
