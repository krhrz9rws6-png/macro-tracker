import raw from '../data/afcd.json'

// AFCD Release 3 (FSANZ) — values per 100g edible portion.
export interface Food {
  id: string
  name: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  sugars: number
  addedSugars: number
  fiber: number
  satFat: number
  transFat: number
  monoFat: number
  polyFat: number
  alcohol: number
  sodium: number
  potassium: number
  calcium: number
  iron: number
  magnesium: number
  zinc: number
  vitA: number
  vitC: number
  vitE: number
  vitD: number
  folate: number
  b12: number
  cholesterol: number
  caffeine: number
  classification: string
}

type Row = (string | number | null)[]

const z = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export const foods: Food[] = (raw as { foods: Row[] }).foods.map((r) => ({
  id: r[0] as string,
  name: r[1] as string,
  kcal: z(r[2]),
  protein: z(r[3]),
  fat: z(r[4]),
  carbs: z(r[5]),
  sugars: z(r[6]),
  addedSugars: z(r[7]),
  fiber: z(r[8]),
  satFat: z(r[9]),
  transFat: z(r[10]),
  monoFat: z(r[11]),
  polyFat: z(r[12]),
  alcohol: z(r[13]),
  sodium: z(r[14]),
  potassium: z(r[15]),
  calcium: z(r[16]),
  iron: z(r[17]),
  magnesium: z(r[18]),
  zinc: z(r[19]),
  vitA: z(r[20]),
  vitC: z(r[21]),
  vitE: z(r[22]),
  vitD: z(r[23]),
  folate: z(r[24]),
  b12: z(r[25]),
  cholesterol: z(r[26]),
  caffeine: z(r[27]),
  classification: (r[28] as string) ?? '',
}))

const byId = new Map(foods.map((f) => [f.id, f]))
export const getFood = (id: string) => byId.get(id)

// Precomputed once — searching runs on every keystroke.
const lcNames = foods.map((f) => f.name.toLowerCase())

// Beverages are AFCD classification major group 29 (non-alcoholic) / alcohol in 291-293.
export const isBeverage = (f: Food) => f.classification.startsWith('29')
export const isAlcoholic = (f: Food) => f.alcohol > 0

/** Simple ranked substring search: every query word must appear; earlier/shorter matches rank higher. */
export function searchFoods(query: string, limit = 30): Food[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const scored: { f: Food; score: number }[] = []
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i]
    const name = lcNames[i]
    let score = 0
    let ok = true
    for (const w of words) {
      const idx = name.indexOf(w)
      if (idx === -1) { ok = false; break }
      score += idx === 0 ? 0 : idx // prefer matches at the start
    }
    if (!ok) continue
    score += name.length * 0.1 // prefer shorter names
    scored.push({ f, score })
  }
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, limit).map((s) => s.f)
}
