# 🍱 CuisineDuo

## 🎯 Vision
Application PWA conçue pour harmoniser la vie culinaire d'un couple mixte (Français/Chinois).
**Objectifs :** Historiser les plats, visualiser et comprendre les frictions gustatives (textures, épices, odeurs), et gérer le stock du quotidien intelligemment grâce à l'IA, sans complexité administrative.

## 🛠 Stack Technique
*   **Frontend :** React + Vite (Rapide, Léger).
*   **Backend & DB :** Supabase (PostgreSQL gratuit).
*   **IA (Cerveau) :** Gemini Advanced (Web) utilisé via un système de "Prompt Context Builder" (Copier-Coller intelligent).
*   **Hébergement :** Vercel.

---

## 🌟 Fonctionnalités Clés

### 1. Le "Radar des Frictions" (Analyse Sensorielle)
Au lieu d'une note unique, chaque plat est défini par un **Profil Sensoriel** permettant de visualiser les différences de perception.

*   **Les 8 Axes (Notation 0 à 10) :**
    1.  🌶️ **Piquant** (Spiciness) - La chaleur.
    2.  🍋 **Acide** (Sourness) - Vinaigre, agrumes.
    3.  🌿 **Amer** (Bitterness) - Légumes amers, herbes.
    4.  🍯 **Sucré** (Sweetness) - Plats sucrés-salés.
    5.  🧂 **Salé** (Saltiness) - Soy sauce, sel.
    6.  🍄 **Umami** (Savoriness) - La profondeur (bouillons, MSG, fromages).
    7.  🥓 **Gras** (Oiliness) - Richesse en bouche.
    8.  👃 **Odeur** (Smell) - Tofu puant, Durian, Fromages forts.

*   **Tags de Texture :**
    *   *Croustillant, Fondant, Gélatineux (Friction fréquente), Élastique (Q-texture), Fibreux, Sec...*

### 2. Gestion de Stock "Fusion & Relax"
Approche minimaliste pour garantir l'utilisation sur le long terme. Pas de grammes, pas de ml.

*   **Jauge Visuelle (4 États) :**
    *   🟢 **Plein / En Stock** (Pas besoin d'y penser).
    *   🟡 **Entamé** (Suffisant pour cuisiner).
    *   🔴 **Critique** (Ajout auto à la liste de courses).
    *   ❌ **Rupture / Vide**.
*   **Checkout Post-Cuisine :**
    *   Validation rapide après un repas : *"As-tu fini le Riz ?"* (Cocher Oui/Non).
*   **Import Intelligent :**
    *   Photo du ticket -> Gemini -> JSON -> Import dans l'app.

### 3. Le "Context Builder" (Pont vers l'IA)
L'application ne possède pas l'IA en interne mais **prépare le travail** pour Gemini.
Un bouton **"Action IA"** génère des prompts structurés contenant les données de l'app :

*   **Scénario "Inspiration" :**
    *   *Input App :* Liste des ingrédients (🟢/🟡) + Profils de goûts aimés + Historique récent.
    *   *Prompt généré :* "Propose 3 recettes (1 rapide, 1 fusion, 1 comfort) avec ces restes..."
*   **Scénario "Analyse Plat" :**
    *   *Prompt généré :* Template demandant à Gemini d'analyser une photo/description selon les 8 axes et de sortir un JSON.
*   **Scénario "Courses" :**
    *   *Prompt généré :* Template pour nettoyer l'OCR d'un ticket de caisse et catégoriser les produits.

---

## 💾 Structure de Données (Supabase)

### Table `recettes`
*   `id` (uuid)
*   `titre` (text)
*   `image_url` (text)
*   `origine` (text : 'CN', 'FR', 'FUSION')
*   **Notes Globales :** `note_moi` (int), `note_elle` (int)
*   **Profil Sensoriel (JSONB ou Colonnes) :**
    *   `piquant`, `acide`, `amer`, `sucre`, `sale`, `umami`, `gras`, `odeur` (0-10)
*   **Attributs :** `textures` (text[]), `ingredients_clés` (text[])

### Table `stock`
*   `id` (uuid)
*   `nom` (text)
*   `categorie` (text : 'Frais', 'Sec', 'Sauce', 'Surgelé')
*   `niveau` (text/enum : 'FULL', 'MID', 'LOW', 'EMPTY')
*   `updated_at` (timestamp)

### Table `historique`
*   `id` (uuid)
*   `date` (date)
*   `recette_id` (fk)
*   `feedback_rapide` (text)

---

## 📅 Roadmap Développement

1.  **Phase 1 : Socle Technique & DB (En cours)**
    *   Connexion React <-> Supabase.
    *   Mise à jour du schéma de base de données (ajout des 8 axes).

2.  **Phase 2 : Interface Saisie & Radar**
    *   Formulaire d'ajout de recette avec Sliders (8 axes).
    *   Visualisation "Radar Chart" sur la fiche recette.

3.  **Phase 3 : Gestion de Stock UI**
    *   Liste d'ingrédients avec sélecteur de jauge simple.

4.  **Phase 4 : Le "Context Builder"**
    *   Logique de génération de prompts (String templates injectant les données du state).
