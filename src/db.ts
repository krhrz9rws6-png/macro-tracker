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

export const db = new Dexie('macro-tracker') as Dexie & {
  profiles: EntityTable<Profile, 'id'>
  log: EntityTable<LogEntry, 'id'>
  favorites: EntityTable<Favorite, 'id'>
  supplements: EntityTable<Supplement, 'id'>
}

db.version(1).stores({
  profiles: '++id, name',
  log: '++id, [profileId+date], profileId, date',
  favorites: '++id, [profileId+foodId], profileId, uses',
})

db.version(2).stores({
  supplements: '++id, profileId',
})

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
