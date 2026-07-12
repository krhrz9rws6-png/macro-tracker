import type { Food } from './afcd'

// ---------- BMR / TDEE (Mifflin-St Jeor) ----------

export type Sex = 'female' | 'male'
export type Goal = 'lose' | 'maintain' | 'recomp' | 'muscle' | 'endurance'

export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary (desk job, little exercise)', factor: 1.2 },
  { key: 'light', label: 'Lightly active (1–3 sessions/week)', factor: 1.375 },
  { key: 'moderate', label: 'Moderately active (3–5 sessions/week)', factor: 1.55 },
  { key: 'very', label: 'Very active (6–7 sessions/week)', factor: 1.725 },
  { key: 'extra', label: 'Extremely active (physical job + training)', factor: 1.9 },
] as const

export type ActivityKey = (typeof ACTIVITY_LEVELS)[number]['key']

export function bmrMifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function tdee(bmr: number, activity: ActivityKey): number {
  const f = ACTIVITY_LEVELS.find((a) => a.key === activity)?.factor ?? 1.2
  return Math.round(bmr * f)
}

/**
 * Goal presets. Each sets a calorie adjustment on TDEE, a protein dose (g/kg —
 * higher in a deficit to preserve lean mass, high for hypertrophy, moderate for
 * endurance where carbs take priority) and a fat share of calories (lower for
 * muscle/endurance goals so the remainder flows to carbs, which fuel training).
 */
export const GOAL_PRESETS: Record<Goal, {
  label: string
  hint: string
  kcalAdjust: number
  proteinPerKg: number
  fatShare: number
}> = {
  lose: {
    label: 'Lose fat', hint: '−20% cal · high protein',
    kcalAdjust: -0.2, proteinPerKg: 2.2, fatShare: 0.3,
  },
  maintain: {
    label: 'Maintain', hint: 'TDEE · balanced',
    kcalAdjust: 0, proteinPerKg: 1.8, fatShare: 0.3,
  },
  recomp: {
    label: 'Recomp', hint: 'TDEE · very high protein',
    kcalAdjust: 0, proteinPerKg: 2.2, fatShare: 0.25,
  },
  muscle: {
    label: 'Build muscle', hint: '+10% cal · high protein & carbs',
    kcalAdjust: 0.1, proteinPerKg: 2.0, fatShare: 0.25,
  },
  endurance: {
    label: 'Endurance / VO₂', hint: 'TDEE · carb-forward fuel',
    kcalAdjust: 0, proteinPerKg: 1.7, fatShare: 0.25,
  },
}

export interface MacroTargets {
  kcal: number
  protein: number // g
  fat: number // g
  carbs: number // g
}

/** Protein-first split from the goal preset; carbs get the remaining calories. */
export function macroTargets(tdeeKcal: number, goal: Goal, weightKg: number): MacroTargets {
  const p = GOAL_PRESETS[goal]
  const kcal = Math.round(tdeeKcal * (1 + p.kcalAdjust))
  const protein = Math.round(p.proteinPerKg * weightKg)
  const fat = Math.round((kcal * p.fatShare) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, fat, carbs }
}

// ---------- Per-entry nutrient math ----------

/** The nutrient snapshot stored on every log entry (already scaled to the eaten amount). */
export interface Nutrients {
  kcal: number
  protein: number
  fat: number
  carbs: number
  sugars: number
  addedSugars: number
  fiber: number
  satFat: number
  transFat: number
  alcohol: number
  sodium: number
  potassium: number
  calcium: number
  iron: number
  magnesium: number
  zinc: number
  iodine: number
  folate: number
  b12: number
  vitA: number
  vitC: number
  vitD: number
  vitE: number
  caffeine: number
}

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0, protein: 0, fat: 0, carbs: 0, sugars: 0, addedSugars: 0, fiber: 0,
  satFat: 0, transFat: 0, alcohol: 0, sodium: 0, potassium: 0, calcium: 0,
  iron: 0, magnesium: 0, zinc: 0, iodine: 0, folate: 0, b12: 0,
  vitA: 0, vitC: 0, vitD: 0, vitE: 0, caffeine: 0,
}

export function scaleFood(f: Food, grams: number): Nutrients {
  const k = grams / 100
  return {
    kcal: f.kcal * k,
    protein: f.protein * k,
    fat: f.fat * k,
    carbs: f.carbs * k,
    sugars: f.sugars * k,
    addedSugars: f.addedSugars * k,
    fiber: f.fiber * k,
    satFat: f.satFat * k,
    transFat: f.transFat * k,
    alcohol: f.alcohol * k,
    sodium: f.sodium * k,
    potassium: f.potassium * k,
    calcium: f.calcium * k,
    iron: f.iron * k,
    magnesium: f.magnesium * k,
    zinc: f.zinc * k,
    iodine: f.iodine * k,
    folate: f.folate * k,
    b12: f.b12 * k,
    vitA: f.vitA * k,
    vitC: f.vitC * k,
    vitD: f.vitD * k,
    vitE: f.vitE * k,
    caffeine: f.caffeine * k,
  }
}

export function addNutrients(a: Nutrients, b: Partial<Nutrients>): Nutrients {
  const out = { ...a }
  // `?? 0` guards entries logged before newer nutrient fields existed.
  for (const key of Object.keys(out) as (keyof Nutrients)[]) out[key] += b[key] ?? 0
  return out
}

/** Adult daily values used for the micronutrient overview (AU NRVs, women 19–50). */
export const MICRO_DV = [
  { key: 'fiber', label: 'Fiber', dv: 28, unit: 'g' },
  { key: 'iron', label: 'Iron', dv: 18, unit: 'mg' },
  { key: 'calcium', label: 'Calcium', dv: 1000, unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', dv: 320, unit: 'mg' },
  { key: 'zinc', label: 'Zinc', dv: 8, unit: 'mg' },
  { key: 'iodine', label: 'Iodine', dv: 150, unit: 'µg' },
  { key: 'folate', label: 'Folate', dv: 400, unit: 'µg' },
  { key: 'b12', label: 'B12', dv: 2.4, unit: 'µg' },
  { key: 'vitA', label: 'Vit A', dv: 700, unit: 'µg' },
  { key: 'vitC', label: 'Vit C', dv: 45, unit: 'mg' },
  { key: 'vitD', label: 'Vit D', dv: 10, unit: 'µg' },
  { key: 'vitE', label: 'Vit E', dv: 7, unit: 'mg' },
  { key: 'potassium', label: 'Potassium', dv: 2800, unit: 'mg' },
] as const satisfies readonly { key: keyof Nutrients; label: string; dv: number; unit: string }[]

// ---------- Alcohol ----------

/** Australian standard drink = 10 g of pure alcohol. */
export const standardDrinks = (alcoholGrams: number) => alcoholGrams / 10

export const NHMRC_WEEKLY_SD_LIMIT = 10
export const NHMRC_DAILY_SD_LIMIT = 4

// ---------- Calorie quality: NRF9.3 ----------
// Nutrient Rich Foods index: 9 encouraged nutrients minus 3 to limit, per 100 kcal,
// each expressed as % of daily value and capped at 100%.

// Daily reference values (adult, AU NRVs where available).
const DV = {
  protein: 50, fiber: 28, vitA: 900, vitC: 45, vitE: 10,
  calcium: 1000, iron: 12, magnesium: 400, potassium: 3800,
  satFat: 24, addedSugars: 50, sodium: 2000,
}

/** Raw NRF9.3 for a food, per 100 kcal. Roughly -100 (worst) to +900 (leafy greens). */
export function nrf93(f: Food): number | null {
  if (f.kcal <= 0) return null
  const per100kcal = 100 / f.kcal // multiply per-100g values to get per-100kcal
  const cap = (x: number) => Math.min(x, 100)
  const good =
    cap((f.protein * per100kcal / DV.protein) * 100) +
    cap((f.fiber * per100kcal / DV.fiber) * 100) +
    cap((f.vitA * per100kcal / DV.vitA) * 100) +
    cap((f.vitC * per100kcal / DV.vitC) * 100) +
    cap((f.vitE * per100kcal / DV.vitE) * 100) +
    cap((f.calcium * per100kcal / DV.calcium) * 100) +
    cap((f.iron * per100kcal / DV.iron) * 100) +
    cap((f.magnesium * per100kcal / DV.magnesium) * 100) +
    cap((f.potassium * per100kcal / DV.potassium) * 100)
  const limit =
    (f.satFat * per100kcal / DV.satFat) * 100 +
    (f.addedSugars * per100kcal / DV.addedSugars) * 100 +
    (f.sodium * per100kcal / DV.sodium) * 100
  return good - limit
}

/** Map raw NRF to a friendly 0–100 quality score. ~0 raw → 25; 300+ raw → 100. */
export function qualityScore(f: Food): number | null {
  const raw = nrf93(f)
  if (raw == null) return null
  const score = ((raw + 100) / 400) * 100
  return Math.round(Math.max(0, Math.min(100, score)))
}

export function qualityBand(score: number): 'high' | 'mid' | 'low' {
  return score >= 55 ? 'high' : score >= 30 ? 'mid' : 'low'
}

// ---------- FSA traffic lights (per 100g; drinks use half thresholds) ----------

export type Light = 'green' | 'amber' | 'red'

export interface TrafficLights {
  fat: Light
  satFat: Light
  sugars: Light
  sodium: Light
}

export function trafficLights(f: Food, beverage = false): TrafficLights {
  const d = beverage ? 0.5 : 1
  const band = (v: number, amber: number, red: number): Light =>
    v > red * d ? 'red' : v > amber * d ? 'amber' : 'green'
  return {
    fat: band(f.fat, 3, 17.5),
    satFat: band(f.satFat, 1.5, 5),
    sugars: band(f.sugars, 5, 22.5),
    // FSA salt thresholds 0.3g/1.5g salt per 100g → sodium mg equivalents.
    sodium: band(f.sodium, 120, 600),
  }
}
