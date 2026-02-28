/**
 * Retourne le nom/description/ingredients/steps/tips traduits d'une recette
 * selon la langue courante, en fallback sur les champs principaux.
 *
 * @param {object} recipe - L'objet recette avec potentiellement un champ `translations`
 * @param {string} lang - Code langue courante ('fr', 'en', 'zh')
 * @returns {object} - { name, description, ingredients, steps, tips } traduits
 */
export function getTranslatedRecipe(recipe, lang) {
  if (!recipe) return { name: '', description: '' }

  const tr = recipe.translations?.[lang]
  if (!tr) return recipe // Pas de traduction disponible, retourner tel quel

  // Fusionner les ingredients traduits (remplacer les noms, garder quantites/unites)
  let ingredients = recipe.ingredients
  if (tr.ingredients?.length && recipe.ingredients?.length) {
    ingredients = recipe.ingredients.map((ing, i) => ({
      ...ing,
      name: tr.ingredients[i]?.name || ing.name,
    }))
  }

  // Fusionner les steps traduits (remplacer les instructions, garder durees)
  let steps = recipe.steps
  if (tr.steps?.length && recipe.steps?.length) {
    steps = recipe.steps.map((step, i) => ({
      ...step,
      instruction: tr.steps[i]?.instruction || step.instruction,
    }))
  }

  // Tips traduits
  const tips = tr.tips?.length ? tr.tips : recipe.tips

  return {
    ...recipe,
    name: tr.name || recipe.name,
    description: tr.description || recipe.description,
    ingredients,
    steps,
    tips,
  }
}
