import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, MEAL_SLOTS, type MealSlot, type Profile } from '../db'
import { getFood, isBeverage, searchFoods, type Food } from '../lib/afcd'
import {
  qualityScore, scaleFood, standardDrinks, trafficLights, type Nutrients,
} from '../lib/nutrition'
import { LightBadge, QualityDot } from './ui'

const QUICK_DRINKS: { label: string; query: string; grams: number }[] = [
  { label: '🍷 Wine 150ml', query: 'wine red', grams: 150 },
  { label: '🍺 Beer 375ml', query: 'beer high alcohol', grams: 375 },
  { label: '🍸 Spirit 30ml', query: 'spirit vodka gin', grams: 30 },
  { label: '🥂 Bubbles 150ml', query: 'wine sparkling', grams: 150 },
]

const SIZE_PRESETS = [
  { label: 'Small', factor: 0.7 },
  { label: 'Standard', factor: 1 },
  { label: 'Large', factor: 1.4 },
]

export default function LogSheet({ profile, date, remaining, defaultSlot, onClose }: {
  profile: Profile
  date: string
  remaining: Nutrients // remaining vs daily targets (kcal/protein/fat/carbs meaningful)
  defaultSlot: MealSlot
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState(100)
  const [baseGrams, setBaseGrams] = useState(100)
  const [slot, setSlot] = useState<MealSlot>(defaultSlot)

  const results = useMemo(() => searchFoods(query), [query])

  const favorites = useLiveQuery(
    () => db.favorites.where('profileId').equals(profile.id!).reverse().sortBy('uses'),
    [profile.id],
  )

  const pick = (f: Food, g = 100, s?: MealSlot) => {
    setSelected(f)
    setGrams(g)
    setBaseGrams(g)
    if (s) setSlot(s)
    else if (isBeverage(f)) setSlot(f.alcohol > 0 ? 'drink' : slot)
  }

  const pickQuickDrink = (q: { query: string; grams: number }) => {
    const f = searchFoods(q.query, 1)[0]
    if (f) pick(f, q.grams, 'drink')
  }

  const scaled = selected ? scaleFood(selected, grams) : null
  const lights = selected ? trafficLights(selected, isBeverage(selected)) : null
  const quality = selected ? qualityScore(selected) : null
  const sd = scaled && scaled.alcohol > 0 ? standardDrinks(scaled.alcohol) : 0

  const log = async () => {
    if (!selected || !scaled) return
    await db.log.add({
      profileId: profile.id!, date, slot, foodId: selected.id, name: selected.name,
      grams, nutrients: scaled, source: slot === 'drink' ? 'quickdrink' : 'search',
      createdAt: Date.now(),
    })
    const existing = await db.favorites.where('[profileId+foodId]').equals([profile.id!, selected.id]).first()
    if (existing) await db.favorites.update(existing.id!, { uses: existing.uses + 1, lastUsed: Date.now(), grams })
    else await db.favorites.add({ profileId: profile.id!, foodId: selected.id, name: selected.name, grams, slot, uses: 1, lastUsed: Date.now() })
    onClose()
  }

  const after = (used: number, rem: number) => Math.round(rem - used)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-2 border-b border-gray-100">
          <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3 sm:hidden" />
          <input
            autoFocus
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search foods… (e.g. doughnut, chicken breast)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected && !query && (
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick drinks</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_DRINKS.map((q) => (
                    <button key={q.label} onClick={() => pickQuickDrink(q)}
                      className="px-3 py-2 rounded-xl bg-purple-50 text-purple-800 text-sm font-medium">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              {favorites && favorites.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your regulars</div>
                  <div className="space-y-1">
                    {favorites.slice(0, 8).map((fav) => {
                      const f = getFood(fav.foodId)
                      if (!f) return null
                      return (
                        <button key={fav.id} onClick={() => pick(f, fav.grams, fav.slot)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 flex justify-between items-center">
                          <span className="text-sm">{fav.name}</span>
                          <span className="text-xs text-gray-400">{fav.grams}g · ×{fav.uses}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!selected && query && (
            <div className="p-2">
              {results.map((f) => (
                <button key={f.id} onClick={() => pick(f)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100">
                  <div className="text-sm">{f.name}</div>
                  <div className="text-xs text-gray-400 flex gap-2 items-center">
                    <span>{f.kcal} kcal/100g</span>
                    <QualityDot score={qualityScore(f)} />
                  </div>
                </button>
              ))}
              {results.length === 0 && <div className="p-6 text-center text-sm text-gray-400">No matches — try fewer words</div>}
            </div>
          )}

          {selected && scaled && lights && (
            <div className="p-4 space-y-4">
              <div>
                <div className="font-semibold">{selected.name}</div>
                <div className="flex gap-1.5 mt-1.5 items-center">
                  <LightBadge label="Fat" light={lights.fat} />
                  <LightBadge label="Sat" light={lights.satFat} />
                  <LightBadge label="Sugar" light={lights.sugars} />
                  <LightBadge label="Salt" light={lights.sodium} />
                  <span className="ml-1"><QualityDot score={quality} /></span>
                </div>
              </div>

              <div>
                <div className="flex gap-2 mb-2">
                  {SIZE_PRESETS.map((s) => (
                    <button key={s.label} onClick={() => setGrams(Math.round(baseGrams * s.factor))}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium ${Math.round(baseGrams * s.factor) === grams ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-600'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input type="range" min={10} max={600} step={5} value={grams}
                    onChange={(e) => setGrams(Number(e.target.value))} className="flex-1 accent-brand-600" />
                  <div className="w-20">
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm"
                      inputMode="numeric" value={grams}
                      onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <span className="text-sm text-gray-400">g</span>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">If you eat this</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {([
                    ['kcal', scaled.kcal, remaining.kcal, ''],
                    ['Protein', scaled.protein, remaining.protein, 'g'],
                    ['Carbs', scaled.carbs, remaining.carbs, 'g'],
                    ['Fat', scaled.fat, remaining.fat, 'g'],
                  ] as const).map(([label, used, rem, unit]) => {
                    const left = after(used, rem)
                    return (
                      <div key={label}>
                        <div className="text-sm font-semibold">+{Math.round(used)}{unit}</div>
                        <div className={`text-[11px] ${left < 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                          {left < 0 ? `${-left}${unit} over` : `${left}${unit} left`}
                        </div>
                        <div className="text-[10px] text-gray-400">{label}</div>
                      </div>
                    )
                  })}
                </div>
                {sd > 0 && (
                  <div className="mt-2 text-xs text-purple-700 font-medium text-center">
                    🍷 {sd.toFixed(1)} standard drink{sd >= 1.05 ? 's' : ''}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {MEAL_SLOTS.map((s) => (
                  <button key={s.key} onClick={() => setSlot(s.key)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-medium ${slot === s.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-600'}`}>
                    {s.emoji}<br />{s.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pb-2">
                <button onClick={() => setSelected(null)} className="flex-1 py-3 rounded-2xl border border-gray-300 font-medium text-gray-600">
                  Back
                </button>
                <button onClick={log} className="flex-[2] py-3 rounded-2xl bg-brand-600 text-white font-semibold">
                  Log it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
