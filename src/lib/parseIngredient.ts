import { GENERIC_MEASURES, searchFoods, type Food } from './afcd'

export interface ParsedIngredient {
  grams: number | null // resolved edible weight if we could work one out
  unitLabel: string // human display of the amount, e.g. "212 g" or "½ cup"
  foodQuery: string // the food-name part, for matching
  suggestion: Food | null // best AFCD guess
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

const GRAM_RE = /(\d+(?:\.\d+)?)\s*(g|grams?|kg)\b/i
const ML_RE = /(\d+(?:\.\d+)?)\s*(ml|millilitres?|l|litres?)\b/i
const VOL_RE = /(\d+(?:\.\d+)?|[½⅓⅔¼¾⅕⅖⅗⅘⅛⅜⅝⅞])\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?)\b/i

function parseLeadingNumber(s: string): { value: number; rest: string } | null {
  const t = s.trim()
  // Unicode fraction, possibly with a leading whole number ("1½")
  const uni = t.match(/^(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅛⅜⅝⅞])/)
  if (uni) {
    const whole = uni[1] ? parseInt(uni[1]) : 0
    return { value: whole + UNICODE_FRACTIONS[uni[2]], rest: t.slice(uni[0].length).trim() }
  }
  // ASCII fraction "1/2" or "1 1/2"
  const frac = t.match(/^(\d+)?\s*(\d+)\/(\d+)/)
  if (frac) {
    const whole = frac[1] ? parseInt(frac[1]) : 0
    return { value: whole + parseInt(frac[2]) / parseInt(frac[3]), rest: t.slice(frac[0].length).trim() }
  }
  const num = t.match(/^(\d+(?:\.\d+)?)/)
  if (num) return { value: parseFloat(num[1]), rest: t.slice(num[0].length).trim() }
  return null
}

/**
 * Parse a recipe ingredient line into an amount + food name, and take a best
 * guess at the AFCD match. Grams preferred; volumes converted approximately.
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.trim()
  let grams: number | null = null
  let unitLabel = ''
  let foodQuery = raw

  const g = raw.match(GRAM_RE)
  const ml = raw.match(ML_RE)
  const vol = raw.match(VOL_RE)

  if (g) {
    const val = parseFloat(g[1])
    grams = /kg/i.test(g[2]) ? val * 1000 : val
    unitLabel = `${val} ${g[2].toLowerCase()}`
    foodQuery = raw.replace(g[0], ' ').trim()
  } else if (ml) {
    const val = parseFloat(ml[1])
    grams = /^l|litre/i.test(ml[2]) ? val * 1000 : val // ~water density
    unitLabel = `${val} ${ml[2].toLowerCase()}`
    foodQuery = raw.replace(ml[0], ' ').trim()
  } else if (vol) {
    const parsed = parseLeadingNumber(raw)
    const qty = parsed?.value ?? 1
    const measure = GENERIC_MEASURES.find((m) =>
      /cup/i.test(vol[2]) ? m.label.includes('cup') :
      /tbsp|tablespoon/i.test(vol[2]) ? m.label.includes('tbsp') :
      m.label.includes('tsp'),
    )
    if (measure) grams = Math.round(measure.grams * qty)
    unitLabel = `${qty} ${vol[2].toLowerCase()}`
    foodQuery = raw.replace(vol[0], ' ').replace(/^\s*[\d./½⅓⅔¼¾⅕⅖⅗⅘⅛⅜⅝⅞]+\s*/, ' ').trim()
  } else {
    // Bare leading count ("2 eggs") — no weight yet; keep the count in the label.
    const parsed = parseLeadingNumber(raw)
    if (parsed) { unitLabel = `${parsed.value}`; foodQuery = parsed.rest }
  }

  // Strip trailing prep notes for a cleaner search ("chopped", "diced", "to taste").
  const cleaned = foodQuery
    .replace(/,?\s*(chopped|diced|sliced|minced|grated|crushed|to taste|optional|finely|roughly|fresh|dried)\b.*$/i, '')
    .replace(/^of\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const suggestion = cleaned ? searchFoods(cleaned, 1)[0] ?? null : null
  return { grams, unitLabel: unitLabel || '—', foodQuery: cleaned, suggestion }
}
