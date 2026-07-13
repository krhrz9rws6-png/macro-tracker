import type { Recipe } from '../db'
import { getFood } from './afcd'
import { addNutrients, EMPTY_NUTRIENTS, scaleFood, type Nutrients } from './nutrition'

export interface RecipeNutrition {
  perServing: Nutrients
  total: Nutrients
  matchedCount: number
  totalCount: number
}

/**
 * Per-serving nutrition for a recipe.
 * Prefers `statedPerServing` (e.g. macros parsed from Cozyla) when present;
 * otherwise sums matched ingredients and divides by servings.
 */
export function recipeNutrition(recipe: Recipe): RecipeNutrition {
  const servings = Math.max(1, recipe.servings || 1)

  if (recipe.statedPerServing) {
    const perServing = addNutrients({ ...EMPTY_NUTRIENTS }, recipe.statedPerServing)
    const total = scaleNutrients(perServing, servings)
    return { perServing, total, matchedCount: recipe.ingredients.length, totalCount: recipe.ingredients.length }
  }

  let total = { ...EMPTY_NUTRIENTS }
  let matched = 0
  for (const ing of recipe.ingredients) {
    if (!ing.foodId) continue
    const food = getFood(ing.foodId)
    if (!food) continue
    total = addNutrients(total, scaleFood(food, ing.grams))
    matched++
  }
  return {
    perServing: scaleNutrients(total, 1 / servings),
    total,
    matchedCount: matched,
    totalCount: recipe.ingredients.length,
  }
}

function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out = { ...n }
  for (const k of Object.keys(out) as (keyof Nutrients)[]) out[k] = out[k] * factor
  return out
}

/** Confidence flag for the UI: are enough ingredients matched to trust the numbers? */
export function recipeConfidence(n: RecipeNutrition): 'stated' | 'good' | 'partial' | 'none' {
  if (n.totalCount === 0) return 'none'
  const ratio = n.matchedCount / n.totalCount
  if (ratio === 1) return 'good'
  if (ratio >= 0.6) return 'partial'
  return 'none'
}
