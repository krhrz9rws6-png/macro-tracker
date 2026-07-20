import Dexie, { type EntityTable } from 'dexie'
import type { ActivityKey, Goal, MacroTargets, Nutrients, PregnancyStatus, Sex } from './lib/nutrition'

export interface Profile {
  id?: number
  name: string
  sex: Sex
  ageYears: number
  heightCm: number
  weightKg: number
  activity: ActivityKey
  goal: Goal
  bmr: number
  tdee: number
  targets: MacroTargets // daily base; pregnancy adjustments applied via effectiveTargets()
  pregnancy?: PregnancyStatus
  createdAt: number
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'supplement'

export const MEAL_SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
  { key: 'drink', label: 'Drinks', emoji: '🥂' },
]

export interface LogEntry {
  id?: number
  profileId: number
  date: string // YYYY-MM-DD local
  slot: MealSlot
  foodId: string | null // AFCD id when from database
  name: string
  grams: number
  nutrients: Nutrients // snapshot, already scaled to `grams`
  source: 'search' | 'recipe' | 'barcode' | 'photo' | 'quickdrink' | 'supplement'
  supplementId?: number
  createdAt: number
}

/** A supplement in a profile's cabinet: nutrient content per single dose. */
export interface Supplement {
  id?: number
  profileId: number
  name: string
  doseLabel: string // e.g. "1 tablet", "1 scoop (30g)"
  nutrients: Partial<Nutrients> // per dose
  createdAt: number
}

/** A remembered regular: "your usual" foods & drinks for one-tap logging. */
export interface Favorite {
  id?: number
  profileId: number
  foodId: string
  name: string
  grams: number
  slot: MealSlot
  uses: number
  lastUsed: number
}

/** One line of a recipe. `foodId` is the matched AFCD food; null until matched. */
export interface RecipeIngredient {
  text: string // original line, e.g. "212 G Brown Sugar"
  foodId: string | null
  grams: number // resolved edible weight used for the nutrition calc
  unitLabel?: string // display, e.g. "½ cup" or "1 can"
}

/** A recipe. Nutrition is computed from ingredients OR taken from a source (Cozyla). */
export interface Recipe {
  id?: number
  name: string
  servings: number
  ingredients: RecipeIngredient[]
  /** Per-serving nutrients supplied directly (e.g. parsed from Cozyla); overrides computed when set. */
  statedPerServing?: Partial<Nutrients>
  source: 'manual' | 'cozyla' | 'url'
  category?: string // Main / Side / Snack / Dessert / Breakfast …
  createdAt: number
  updatedAt: number
}

export type PlanSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** A meal placed on the weekly plan for a date + slot (shared; per-profile servings). */
export interface PlanEntry {
  id?: number
  date: string // YYYY-MM-DD
  slot: PlanSlot
  recipeId: number
  title: string // denormalised for quick display
  createdAt: number
}

/** Remembered price for a grocery item, keyed by a normalised name. */
export interface PriceMemory {
  id?: number
  key: string // normalised item name (lowercase, trimmed)
  label: string // display name as last seen
  price: number // AUD
  source: 'manual' | 'receipt' | 'harrisfarm'
  updatedAt: number
}

export const db = new Dexie('macro-tracker') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  log: EntityTable<LogEntry, 'id'>
  favorites: EntityTable<Favorite, 'id'>
  supplements: EntityTable<Supplement, 'id'>
  recipes: EntityTable<Recipe, 'id'>
  plan: EntityTable<PlanEntry, 'id'>
  prices: EntityTable<PriceMemory, 'id'>
}

db.version(1).stores({
  profiles: '++id, name',
  log: '++id, [profileId+date], profileId, date',
  favorites: '++id, [profileId+foodId], profileId, uses',
})

db.version(2).stores({
  supplements: '++id, profileId',
})

db.version(3).stores({
  recipes: '++id, name, updatedAt',
  plan: '++id, [date+slot], date, recipeId',
})

db.version(4).stores({
  prices: '++id, &key',
})

export const priceKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export const todayStr = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return todayStr(dt)
}

/** Monday-start week containing dateStr. */
export const weekDates = (dateStr: string): string[] => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const monOffset = (dt.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => addDays(dateStr, i - monOffset))
}
