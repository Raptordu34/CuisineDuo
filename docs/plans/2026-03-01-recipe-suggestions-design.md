# Design : Amelioration du systeme de suggestion de recettes

Date : 2026-03-01

## Objectif

Ameliorer la mecanique de suggestion de recettes avec 3 axes :
1. Interface de pre-suggestion (repartition inventaire vs. decouverte)
2. Systeme anti-doublons
3. Profil gustatif du foyer (approche hybride)

Plus une nouvelle page profil utilisateur.

---

## 1. Interface de pre-suggestion

### Flux utilisateur

1. Clic sur "Suggere-moi" dans RecipesPage
2. Un dialogue modal `SuggestConfigModal` s'affiche (au lieu de lancer directement la generation)
3. Slider discret (positions 0, 1, 2, 3) representant le nombre de recettes "inventaire"
4. Le complement (3 - valeur) est automatiquement affiche comme recettes "decouverte"
5. Valeur par defaut : 2 inventaire / 1 decouverte
6. Bouton "Suggere-moi !" lance la generation avec les parametres choisis

### Composant : `SuggestConfigModal.jsx`

- Slider `<input type="range" min={0} max={3} step={1}>` stylise Tailwind
- Indicateurs visuels : orange pour inventaire, indigo pour decouverte
- Labels dynamiques : "2 depuis ton frigo, 1 surprise"
- Props : `onConfirm({ inventoryCount, discoveryCount })`, `onClose`

### Modification API

- `suggest-recipes.js` recoit `{ inventoryCount, discoveryCount }` en plus
- Le prompt Gemini est segmente : recettes inventaire (contraintes par ingredients dispo) et recettes decouverte (liberte totale, mix intelligent — peut utiliser ou non l'inventaire, privilegie la variete)

---

## 2. Systeme anti-doublons

### Approche : injection contextuelle dans le prompt Gemini

Aucune logique cote serveur supplementaire.

### Donnees envoyees

Avant d'appeler `/api/suggest-recipes`, le frontend recupere la liste des recettes existantes :

```json
{
  "existingRecipes": [
    { "name": "Poulet roti aux herbes", "category": "main" },
    { "name": "Tarte aux pommes", "category": "dessert" }
  ]
}
```

Uniquement `name` et `category` — leger, suffisant pour l'identification.

### Bloc prompt Gemini

```
ANTI-DOUBLON :
Le carnet de recettes contient deja ces plats : [liste].
Tu ne dois PAS proposer de recettes identiques ou trop similaires
(meme plat avec variante mineure, meme base avec garniture differente).
Privilegie la diversite culinaire.
```

### Limites acceptees

- Si le carnet depasse ~50 recettes, tronquer aux plus recentes
- Verification "best effort" — acceptable pour un usage domestique

---

## 3. Profil gustatif hybride

### 3A. Schema de donnees

Reutilisation de la table legacy `taste_preferences` avec enrichissement.

**Colonnes existantes :**

| Colonne | Type | Usage |
|---------|------|-------|
| id | UUID | PK |
| profile_id | UUID | FK → profiles, UNIQUE |
| sweetness | SMALLINT (1-5) | Tolerance au sucre |
| saltiness | SMALLINT (1-5) | Tolerance au sale |
| spiciness | SMALLINT (1-5) | Tolerance au piquant |
| acidity | SMALLINT (1-5) | Tolerance a l'acidite |
| bitterness | SMALLINT (1-5) | Tolerance a l'amertume |
| umami | SMALLINT (1-5) | Affinite umami |
| richness | SMALLINT (1-5) | Affinite plats riches |

**Nouvelles colonnes (migration) :**

| Colonne | Type | Usage |
|---------|------|-------|
| banned_ingredients | JSONB | Liste d'ingredients bannis |
| dietary_restrictions | JSONB | Restrictions alimentaires |
| additional_notes | TEXT | Notes libres |
| updated_at | TIMESTAMPTZ | Derniere mise a jour |

### 3B. Page profil utilisateur

**Route** : `/profile` — protegee

**Acces** : clic sur l'avatar (initiales) en haut a droite dans la Navbar

**Contenu (minimaliste)** :
- Header : avatar (initiales), nom d'affichage, nom du foyer
- Section "Mes gouts" : 7 sliders visuels (1-5) avec labels descriptifs
- Section "Restrictions" : chips/tags selectionnables (vegetarien, vegan, sans gluten, halal, sans lactose, etc.)
- Section "Ingredients bannis" : input + tags
- Section "Notes" : champ texte libre
- Bouton sauvegarder → upsert dans taste_preferences

### 3C. Integration dans les suggestions

Le prompt Gemini de `suggest-recipes.js` recoit le profil gustatif agrege :

```
PROFIL GUSTATIF DU FOYER :
- Tolerance aux epices : faible (membre A: 2/5, membre B: 1/5)
- Ingredients bannis : coriandre (membre A), fruits de mer (membre B)
- Restrictions : sans gluten (membre A)
- Notes : "prefere les plats rapides en semaine"

CONSIGNES :
- Ne propose JAMAIS de recettes contenant des ingredients bannis.
- Respecte les restrictions alimentaires de TOUS les membres.
- Adapte les niveaux d'epices/acidite au profil le plus sensible du foyer.
- Si une recette contient un element sensible, propose une alternative
  ou une adaptation (ex: "remplacer le fromage fort par du fromage doux").
```

**Agregation** : minimum pour chaque axe de saveur (pour plaire a tous), union des ingredients bannis et restrictions.

### 3D. Mise a jour adaptative par l'IA

Quand un utilisateur note un plat (1-5 etoiles), le miam-orchestrator peut ajuster le profil :
- Note haute (4-5) sur plat epice → augmenter legerement `spiciness`
- Note basse (1-2) sur plat acide → diminuer legerement `acidity`

Nouvelle function `updateTasteProfile` dans le miam-orchestrator :
- Recoit le contexte de la recette notee et ses `recipe_taste_params`
- Ajustements incrementaux (±0.5 max par interaction)
- Ne depasse pas les bornes 1-5

---

## Fichiers impactes

### Nouveaux fichiers
- `src/components/recipes/SuggestConfigModal.jsx` — dialogue de pre-suggestion
- `src/pages/ProfilePage.jsx` — page profil utilisateur
- `sql_history/add_taste_preferences_columns.sql` — migration schema

### Fichiers modifies
- `src/pages/RecipesPage.jsx` — integration du SuggestConfigModal
- `src/components/layout/Navbar.jsx` — ajout avatar cliquable → /profile
- `src/App.jsx` — ajout route /profile
- `api/suggest-recipes.js` — nouveaux parametres (repartition, anti-doublons, profil gustatif)
- `api/miam-orchestrator.js` — nouvelle function updateTasteProfile
- `src/i18n/translations.js` — traductions pour profil et pre-suggestion
- `src/contexts/MiamContext.jsx` — handler updateTasteProfile

---

## Decisions techniques cles

1. **Slider discret** (pas continu) pour la repartition — plus intuitif avec seulement 4 positions
2. **Anti-doublons dans le prompt** — simple et suffisant, pas de logique serveur complexe
3. **Table legacy reutilisee** — evite une migration lourde, enrichie avec 3 colonnes
4. **Agregation par minimum** — le profil du foyer est le "plus petit denominateur commun" pour les saveurs
5. **Mise a jour adaptative incrementale** — ±0.5 max pour eviter les changements brusques
6. **Page profil minimaliste** — extensible plus tard avec metriques et parametres
