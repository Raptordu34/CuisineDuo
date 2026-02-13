# CuisineDuo

**Application PWA de gestion culinaire collaborative pour le foyer** — inventaire, recettes, planification de repas par swipe, chat IA et listes de courses, le tout synchronis en temps r el.

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

CuisineDuo est une Progressive Web App pensee pour la gestion culinaire au sein d'un foyer. Elle permet a plusieurs membres de collaborer en temps reel : gerer les stocks, decouvrir des recettes, et communiquer via un chat integre avec un assistant IA.

L'application est concue mobile-first, installable sur l'ecran d'accueil, et supporte les notifications push.

---

## Fonctionnalites

### Gestion d'inventaire
- Ajout manuel ou par **scan de ticket de caisse** (OCR via Gemini)
- Suivi des quantites, prix, dates de peremption
- Historique de consommation et suivi budgetaire
- Saisie vocale avec correction IA

### Recettes
- Catalogue de recettes partage au sein du foyer
- Notes et commentaires des membres
- Assistant IA pour editer, rechercher ou obtenir des conseils sur une recette
- Mode cuisine pas-a-pas avec minuteur integre

### Chat du foyer
- Messagerie temps reel entre les membres
- Assistant IA **Miam** invocable dans la conversation
- Notifications push pour les nouveaux messages

### Listes de courses
- Creation et gestion de listes multiples
- Generation assistee par IA
- Synchronisation avec l'inventaire

### Multilingue
- Interface disponible en francais, anglais et chinois

---

## Stack technique

| Couche | Technologies |
|--------|-------------|
| **Frontend** | React 19, React Router 7, Tailwind CSS 4 |
| **Build** | Vite 7 |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Base de donnees** | Supabase (PostgreSQL + Realtime + Auth) |
| **IA** | Google Gemini 2.0 Flash |
| **Notifications** | Web Push API (VAPID) |
| **Voix** | Web Speech API + correction Gemini |
| **PWA** | Service Worker, Web App Manifest |

---

## Architecture

```
Client (React SPA)
    |
    |--- Supabase (BDD PostgreSQL + Realtime subscriptions)
    |
    |--- Vercel Functions (/api/*)
              |
              |--- Google Gemini API (chat, scan, generation)
              |--- Web Push (notifications)
```

**Principaux patterns :**
- **Contextes React** pour l'authentification (profils) et la langue
- **Hooks custom** pour la logique metier (inventaire, swipe, dictee, notifications)
- **Supabase Realtime** pour la synchronisation multi-appareil (messages, votes, inventaire)
- **Serverless Functions** comme proxy securise vers les API externes

---

## Installation

### Prerequis

- **Node.js** >= 18
- Un projet **Supabase** configure (voir [Base de donnees](#base-de-donnees))
- Une **cle API Google Gemini**
- Des **cles VAPID** pour les notifications push

### Demarrage

```bash
# Cloner le depot
git clone https://github.com/<votre-utilisateur>/CuisineDuo.git
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
│   ├── chat-ai.js                # Chat IA du foyer (Miam)
│   ├── scan-receipt.js           # OCR ticket de caisse
│   ├── correct-transcription.js  # Correction vocale IA
│   ├── generate-recipe-image.js  # Recherche d'images de recettes
│   ├── generate-swipe-recipes.js # Generation de suggestions IA
│   ├── recipe-ai-chat.js        # Assistant IA par recette
│   ├── recipe-ai-search.js      # Recherche de recettes IA
│   ├── create-matched-recipes.js # Sauvegarde des matchs swipe
│   ├── send-notification.js     # Envoi de notifications push
│   └── subscribe-push.js        # Gestion des abonnements push
├── public/
│   ├── manifest.json             # Manifeste PWA
│   ├── sw.js                     # Service Worker (push)
│   └── icons/                    # Icones de l'application
├── src/
│   ├── main.jsx                  # Point d'entree React + enregistrement SW
│   ├── App.jsx                   # Configuration du routage
│   ├── index.css                 # Import Tailwind CSS
│   ├── components/
│   │   ├── layout/               # Navigation, Layout, ProtectedRoute
│   │   ├── recipes/              # Composants recettes (15 fichiers)
│   │   ├── inventory/            # Composants inventaire (11 fichiers)
│   │   ├── shopping/             # Composants listes de courses
│   │   ├── swipe/                # Interface de vote par swipe
│   │   ├── cooking/              # Mode cuisine
│   │   └── DictationButton.jsx   # Bouton de dictee vocale
│   ├── contexts/
│   │   ├── AuthContext.jsx       # Authentification par profils
│   │   └── LanguageContext.jsx   # Internationalisation (FR/EN/ZH)
│   ├── hooks/                    # Hooks custom metier
│   │   ├── useNotifications.js   # Notifications push
│   │   ├── useSwipeSession.js    # Session de vote swipe
│   │   ├── useTasteProfile.js    # Preferences gustatives
│   │   ├── useShoppingList.js    # Listes de courses
│   │   ├── useDictation.js       # Reconnaissance vocale
│   │   └── useRecipeAIEdit.js    # Edition IA de recettes
│   ├── pages/                    # Pages de l'application
│   │   ├── LoginPage.jsx         # Selection de profil
│   │   ├── OnboardingPage.jsx    # Creation de foyer
│   │   ├── HomePage.jsx          # Tableau de bord
│   │   ├── ChatPage.jsx          # Chat du foyer
│   │   ├── InventoryPage.jsx     # Gestion des stocks
│   │   ├── RecipesPage.jsx       # Catalogue de recettes
│   │   ├── RecipeDetailPage.jsx  # Detail d'une recette
│   │   ├── CookingModePage.jsx   # Mode cuisine pas-a-pas
│   │   ├── SwipePage.jsx         # Vote par swipe
│   │   ├── SwipeResultsPage.jsx  # Resultats des matchs
│   │   ├── ShoppingListPage.jsx  # Listes de courses
│   │   └── TasteProfilePage.jsx  # Profil de gout personnel
│   ├── lib/
│   │   └── supabase.js           # Client Supabase
│   └── i18n/
│       └── translations.js       # Traductions multilingues
├── package.json
├── vite.config.js
├── vercel.json                   # Configuration de deploiement
├── eslint.config.js
└── CONTRIBUTING.md               # Guide de contribution
```

---

## API Serverless

Toutes les fonctions API sont situees dans le dossier `api/` et deployees automatiquement sur Vercel.

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/chat-ai` | POST | Conversation avec l'assistant IA Miam |
| `/api/scan-receipt` | POST | Analyse OCR d'un ticket de caisse ou photo d'aliments |
| `/api/correct-transcription` | POST | Correction IA d'une transcription vocale |
| `/api/generate-recipe-image` | POST | Recherche d'image pour une recette |
| `/api/generate-swipe-recipes` | POST | Generation de suggestions de repas par IA |
| `/api/recipe-ai-chat` | POST | Assistant IA contextuel a une recette |
| `/api/recipe-ai-search` | POST | Recherche de recettes par description naturelle |
| `/api/create-matched-recipes` | POST | Sauvegarde des recettes matchees en session swipe |
| `/api/send-notification` | POST | Envoi d'une notification push au foyer |
| `/api/subscribe-push` | POST | Enregistrement/suppression d'un abonnement push |

---

## Base de donnees

Le schema PostgreSQL complet est disponible dans `archivesqleditor/CuisineDuo_Full_Schema_&_RLS.sql`.

### Tables principales

| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs au sein d'un foyer |
| `households` | Foyers (unite de partage des donnees) |
| `messages` | Messages du chat (humains et IA) |
| `recipes` | Catalogue de recettes du foyer |
| `recipe_taste_params` | Profil gustatif par recette |
| `ingredients` | Ingredients des recettes |
| `inventory_items` | Stock actuel (quantite, prix, peremption) |
| `consumed_items` | Historique de consommation |
| `shopping_lists` | Listes de courses |
| `shopping_list_items` | Elements des listes de courses |
| `cooking_history` | Historique des recettes cuisinees |
| `taste_preferences` | Preferences gustatives personnelles |
| `swipe_sessions` | Sessions de planification de repas |
| `swipe_session_recipes` | Recettes proposees par session |
| `swipe_votes` | Votes individuels |
| `push_subscriptions` | Abonnements aux notifications push |

Toutes les tables sont scopees par `household_id` avec des politiques RLS (Row Level Security) configurees dans Supabase.

---

## Contribution

Consultez le [CONTRIBUTING.md](./CONTRIBUTING.md) pour les conventions de commit (Conventional Commits), la strategie de branches et les standards de qualite du code.

---

<p align="center">
  Construit avec React, Supabase et Gemini — deploye sur Vercel
</p>
