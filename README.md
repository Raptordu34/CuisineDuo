# CuisineDuo

**Application PWA de gestion culinaire collaborative pour le foyer** — inventaire alimentaire, chat temps reel avec GIFs et reactions, assistant IA Miam, le tout synchronise en temps reel.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-purple?logo=vite)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)
![Gemini](https://img.shields.io/badge/Google_Gemini-2.0_Flash-4285F4?logo=google)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel)

---

## Table des matieres

- [Apercu](#apercu)
- [Fonctionnalites](#fonctionnalites)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Scripts disponibles](#scripts-disponibles)
- [Structure du projet](#structure-du-projet)
- [API Serverless](#api-serverless)
- [Base de donnees](#base-de-donnees)
- [Contribution](#contribution)

---

## Apercu

CuisineDuo est une Progressive Web App pensee pour la gestion culinaire au sein d'un foyer. Elle permet a plusieurs membres de collaborer en temps reel : gerer les stocks alimentaires et communiquer via un chat integre avec un assistant IA contextuel.

L'application est concue mobile-first, installable sur l'ecran d'accueil, et supporte les notifications push.

---

## Fonctionnalites

### Gestion d'inventaire
- Ajout manuel ou par **scan de ticket de caisse** (OCR via Gemini)
- Saisie vocale avec correction IA
- Suivi des quantites, prix, prix au kg, dates de peremption
- Verification IA des prix pour les articles au poids
- Historique de consommation
- Filtrage par categorie, selection de magasin
- Selecteur visuel de niveau de remplissage

### Chat du foyer
- Messagerie temps reel entre les membres (Supabase Realtime)
- **GIFs** : recherche Giphy + suggestions IA de requetes
- **Reactions emoji** sur les messages
- **Reponses**, **edition** et **suppression** de messages
- Indicateurs de lecture par membre (read receipts)
- Notifications push pour les nouveaux messages
- Menu contextuel par appui long

### Assistant IA Miam
- Invocable via bouton flottant (FAB) ou commande vocale **"Hey Miam"**
- Orchestrateur avec **function calling** : actions contextuelles selon la page
- Synthese vocale (TTS) des reponses
- Panneau conversationnel coulissant
- Historique de conversation persiste par foyer

### Journaux IA
- Page de debug pour visualiser toutes les interactions IA (logs)
- Filtrage par endpoint, duree, erreurs

### Multilingue
- Interface disponible en francais, anglais et chinois
- Selecteur de langue integre

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 19, React Router 7 (`react-router-dom`), Tailwind CSS 4 |
| **Build** | Vite 7, `vite-plugin-pwa` (Workbox `injectManifest`) |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Base de donnees** | Supabase (PostgreSQL + Realtime + Auth + RLS) |
| **IA** | Google Gemini 2.0 Flash (`@google/generative-ai`) |
| **GIFs** | Giphy API |
| **Notifications** | Web Push API (VAPID, `web-push`) |
| **Voix** | Web Speech API + correction Gemini |
| **PWA** | Service Worker (`src/sw.js` via `vite-plugin-pwa`), Web App Manifest |

---

## Architecture

```
Client (React SPA)
    |
    |--- Supabase (BDD PostgreSQL + Realtime + Auth)
    |
    |--- Vercel Functions (/api/*)
              |
              |--- Google Gemini API (orchestrateur, scan, correction, prix)
              |--- Giphy API (GIFs)
              |--- Web Push (notifications)
```

**Principaux patterns :**
- **4 Contextes React** : authentification (Supabase Auth), langue, assistant Miam, messages non lus
- **7 Hooks custom** : dictee, long press, reactions, actions Miam, notifications, statut en ligne, wake word
- **Supabase Realtime** pour la synchronisation multi-appareil (messages, reactions, lecture, inventaire)
- **Serverless Functions** comme proxy securise vers les API externes
- **JWT Bearer tokens** pour l'authentification des appels API
- **AI logging** silencieux de toutes les interactions IA

---

## Installation

### Prerequis

- **Node.js** >= 18
- Un projet **Supabase** configure (voir [Base de donnees](#base-de-donnees))
- Une **cle API Google Gemini**
- Une **cle API Giphy**
- Des **cles VAPID** pour les notifications push

### Demarrage

```bash
# Cloner le depot
git clone https://github.com/Raptordu34/CuisineDuo.git
cd CuisineDuo

# Installer les dependances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos cles (voir section ci-dessous)

# Lancer le serveur de developpement
npm run dev

# Dans un second terminal, lancer le serveur API local
npm run dev:api
```

L'application sera accessible sur `http://localhost:5173` et l'API locale sur `http://localhost:3001`.

---

## Variables d'environnement

Creer un fichier `.env` a la racine du projet :

```env
# Supabase
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase

# Google Gemini
GEMINI_API_KEY=votre_cle_gemini
GEMINI_SCAN_API_KEY=votre_cle_gemini_scan

# Giphy
GIPHY_API_KEY=votre_cle_giphy

# Web Push (VAPID)
VITE_VAPID_PUBLIC_KEY=votre_cle_publique_vapid
VAPID_PRIVATE_KEY=votre_cle_privee_vapid
```

> Les variables prefixees `VITE_` sont exposees cote client. Les autres ne sont accessibles que dans les fonctions serverless.

---

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de developpement Vite (port 5173) |
| `npm run dev:api` | Serveur API local Express (port 3001) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Apercu du build de production |
| `npm run lint` | Analyse statique du code (ESLint) |

---

## Structure du projet

```
CuisineDuo/
├── api/                          # Fonctions serverless Vercel
│   ├── miam-orchestrator.js      # Orchestrateur IA Miam (function calling)
│   ├── chat-ai.js                # Chat IA du foyer (legacy)
│   ├── scan-receipt.js           # OCR ticket de caisse / photo d'aliments
│   ├── correct-transcription.js  # Correction vocale IA
│   ├── verify-prices.js          # Verification IA des prix au poids
│   ├── gif-search.js             # Recherche / trending GIFs (Giphy)
│   ├── gif-suggest.js            # Suggestions GIF par IA + Giphy
│   ├── send-notification.js      # Envoi de notifications push
│   └── subscribe-push.js         # Gestion des abonnements push
├── public/
│   ├── manifest.json             # Manifeste PWA
│   └── icons/                    # Icones de l'application
├── src/
│   ├── main.jsx                  # Point d'entree React + enregistrement SW
│   ├── App.jsx                   # Configuration du routage + providers
│   ├── index.css                 # Import Tailwind CSS
│   ├── sw.js                     # Service Worker (Workbox injectManifest)
│   ├── components/
│   │   ├── chat/                 # Chat : EmojiPicker, GifPicker, MessageContextMenu,
│   │   │                         #   ReactionBadges, ReactionBar
│   │   ├── inventory/            # Inventaire : AddItemModal, CategoryFilter, ConsumeModal,
│   │   │                         #   EditItemModal, InAppCamera, InventoryItemCard,
│   │   │                         #   InventoryList, ScanReceiptButton, ScanReviewItemRow,
│   │   │                         #   ScanReviewModal, StoreSelectDialog
│   │   ├── layout/               # Layout, Navbar, ProtectedRoute, ReloadPrompt
│   │   ├── miam/                 # MiamFAB (bouton flottant), MiamSheet (panneau)
│   │   ├── DictationButton.jsx   # Bouton de dictee vocale
│   │   ├── DictationTrace.jsx    # Affichage de la transcription en cours
│   │   ├── FillLevelPicker.jsx   # Selecteur visuel de niveau de remplissage
│   │   └── LanguageSwitcher.jsx  # Selecteur de langue (FR/EN/ZH)
│   ├── contexts/
│   │   ├── AuthContext.jsx       # Authentification Supabase Auth (email/password)
│   │   ├── LanguageContext.jsx   # Internationalisation (FR/EN/ZH)
│   │   ├── MiamContext.jsx       # Etat de l'assistant Miam (TTS, wake word, actions)
│   │   └── UnreadMessagesContext.jsx  # Messages non lus + statuts de lecture
│   ├── hooks/
│   │   ├── useDictation.js       # Reconnaissance vocale + correction IA
│   │   ├── useLongPress.js       # Geste appui long (menu contextuel)
│   │   ├── useMessageReactions.js # Reactions emoji sur les messages
│   │   ├── useMiamActions.js     # Enregistrement d'actions Miam par page
│   │   ├── useNotifications.js   # Notifications push
│   │   ├── useOnlineStatus.js    # Detection en ligne / hors ligne
│   │   └── useWakeWord.js        # Activation vocale "Hey Miam"
│   ├── pages/
│   │   ├── LoginPage.jsx         # Connexion (email/password)
│   │   ├── OnboardingPage.jsx    # Creation / rejoindre un foyer
│   │   ├── HomePage.jsx          # Tableau de bord
│   │   ├── InventoryPage.jsx     # Gestion des stocks
│   │   ├── ChatPage.jsx          # Chat du foyer
│   │   └── AILogsPage.jsx        # Debug des interactions IA
│   ├── lib/
│   │   ├── supabase.js           # Client Supabase
│   │   ├── apiClient.js          # Fetch wrapper authentifie (JWT Bearer)
│   │   └── aiLogger.js           # Logging silencieux des interactions IA
│   └── i18n/
│       └── translations.js       # Traductions multilingues (FR/EN/ZH)
├── sql_history/                  # Historique des migrations SQL
├── package.json
├── vite.config.js
├── vercel.json                   # Configuration de deploiement Vercel
├── api-dev-server.js             # Serveur Express local pour les API
├── eslint.config.js
├── CLAUDE.md                     # Contexte pour l'assistant Claude
├── Gemini.md                     # Contexte pour l'assistant Gemini
└── CONTRIBUTING.md               # Guide de contribution
```

---

## API Serverless

Toutes les fonctions API sont situees dans le dossier `api/` et deployees automatiquement sur Vercel. Les appels sont authentifies via JWT Bearer token (Supabase Auth).

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/miam-orchestrator` | POST | Orchestrateur IA Miam avec function calling contextuel |
| `/api/chat-ai` | POST | Chat IA du foyer (legacy) |
| `/api/scan-receipt` | POST | OCR de ticket de caisse ou photo d'aliments via Gemini |
| `/api/correct-transcription` | POST | Correction IA d'une transcription vocale |
| `/api/verify-prices` | POST | Verification IA des prix pour articles au poids |
| `/api/gif-search` | POST | Recherche et trending de GIFs via Giphy |
| `/api/gif-suggest` | POST | Suggestions de requetes GIF par Gemini + Giphy |
| `/api/send-notification` | POST | Envoi d'une notification push au foyer |
| `/api/subscribe-push` | POST | Enregistrement/suppression d'un abonnement push |

---

## Base de donnees

Le schema PostgreSQL est gere via des migrations successives dans `sql_history/`. Toutes les tables utilisent RLS (Row Level Security) avec `auth.uid()` et `auth_user_household_id()`.

### Tables actives

| Table | Description |
|-------|-------------|
| `households` | Foyers (unite de partage des donnees) |
| `profiles` | Membres d'un foyer (lies a Supabase Auth via `id = auth.uid()`) |
| `inventory_items` | Stock actuel (quantite, prix, peremption, magasin) |
| `consumed_items` | Historique de consommation |
| `messages` | Messages du chat (texte, GIFs, reponses, edition, suppression douce) |
| `message_reactions` | Reactions emoji sur les messages |
| `chat_read_status` | Statut de lecture du chat par membre |
| `push_subscriptions` | Abonnements aux notifications push |
| `ai_logs` | Logs des interactions IA (debug) |

### Tables legacy (en base, non utilisees)

`recipes`, `recipe_comments`, `recipe_taste_params`, `recipe_ratings`, `cooking_history`, `taste_preferences`, `swipe_sessions`, `swipe_session_recipes`, `swipe_votes`, `shopping_lists`, `shopping_list_items`

Toutes les tables sont scopees par `household_id` avec des politiques RLS configurees dans Supabase.

---

## Contribution

Consultez le [CONTRIBUTING.md](./CONTRIBUTING.md) pour les conventions de commit (Conventional Commits), la strategie de branches et les standards de qualite du code.

---

<p align="center">
  Construit avec React, Supabase et Gemini — deploye sur Vercel
</p>
