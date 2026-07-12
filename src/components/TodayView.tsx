import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, MEAL_SLOTS, type LogEntry, type MealSlot, type Profile } from '../db'
import { getFood } from '../lib/afcd'
import {
  addNutrients, EMPTY_NUTRIENTS, MICRO_DV, NHMRC_DAILY_SD_LIMIT, qualityScore,
  standardDrinks, type Nutrients,
} from '../lib/nutrition'
import SupplementsCard from './SupplementsCard'
import { MacroBar, Ring } from './ui'

export function useDayEntries(profileId: number, date: string) {
  return useLiveQuery(
    () => db.log.where('[profileId+date]').equals([profileId, date]).toArray(),
    [profileId, date],
  )
}

export function dayTotals(entries: LogEntry[] | undefined): Nutrients {
  return (entries ?? []).reduce((acc, e) => addNutrients(acc, e.nutrients), { ...EMPTY_NUTRIENTS })
}

/** Calorie-weighted average quality of the day's food (0–100). */
export function dayQuality(entries: LogEntry[] | undefined): number | null {
  if (!entries || entries.length === 0) return null
  let kcal = 0, weighted = 0
  for (const e of entries) {
    if (!e.foodId || e.nutrients.kcal <= 0) continue
    const f = getFood(e.foodId)
    const q = f ? qualityScore(f) : null
    if (q == null) continue
    kcal += e.nutrients.kcal
    weighted += q * e.nutrients.kcal
  }
  return kcal > 0 ? Math.round(weighted / kcal) : null
}

export default function TodayView({ profile, date, onAdd }: {
  profile: Profile; date: string; onAdd: (slot: MealSlot) => void
}) {
  const entries = useDayEntries(profile.id!, date)
  const totals = dayTotals(entries)
  const t = profile.targets
  const quality = dayQuality(entries)
  const sd = standardDrinks(totals.alcohol)
  const [showMicros, setShowMicros] = useState(false)

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Ring pct={(totals.kcal / t.kcal) * 100}>
            <div className="text-lg font-bold leading-none">{Math.round(totals.kcal)}</div>
            <div className="text-[10px] text-gray-400">of {t.kcal}</div>
          </Ring>
          <div className="flex-1 space-y-2.5">
            <MacroBar label="Protein" used={totals.protein} target={t.protein} accent="bg-sky-500" />
            <MacroBar label="Carbs" used={totals.carbs} target={t.carbs} accent="bg-amber-500" />
            <MacroBar label="Fat" used={totals.fat} target={t.fat} accent="bg-rose-400" />
          </div>
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <button onClick={() => setShowMicros(!showMicros)} className="text-left">
            Fiber {Math.round(totals.fiber)}g · Sugar {Math.round(totals.sugars)}g · Salt {(totals.sodium / 1000 * 2.5).toFixed(1)}g
            <span className="ml-1 text-brand-700 font-medium">{showMicros ? '▴' : '▾ micros'}</span>
          </button>
          {quality != null && (
            <span className="font-medium">
              Quality <span className={quality >= 55 ? 'text-green-600' : quality >= 30 ? 'text-amber-600' : 'text-red-500'}>{quality}</span>/100
            </span>
          )}
        </div>
        {showMicros && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {MICRO_DV.map((m) => {
              const val = totals[m.key]
              const pct = Math.min(100, (val / m.dv) * 100)
              return (
                <div key={m.key}>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>{m.label}</span>
                    <span>{val >= 100 ? Math.round(val) : Math.round(val * 10) / 10}/{m.dv}{m.unit}</span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-brand-400' : 'bg-amber-300'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="col-span-2 text-[10px] text-gray-400">
              vs adult daily values (women 19–50) · food + supplements combined
            </div>
          </div>
        )}
        {sd > 0.05 && (
          <div className={`mt-2 text-xs font-medium ${sd > NHMRC_DAILY_SD_LIMIT ? 'text-red-600' : 'text-purple-700'}`}>
            🍷 {sd.toFixed(1)} standard drinks today {sd > NHMRC_DAILY_SD_LIMIT && '— above the ≤4/day guideline'}
          </div>
        )}
      </div>

      <SupplementsCard profile={profile} date={date} entries={entries ?? []} />

      {MEAL_SLOTS.map((s) => {
        const slotEntries = (entries ?? []).filter((e) => e.slot === s.key)
        const slotKcal = slotEntries.reduce((sum, e) => sum + e.nutrients.kcal, 0)
        return (
          <div key={s.key} className="rounded-2xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="font-semibold text-sm">{s.emoji} {s.label}</div>
              <div className="flex items-center gap-3">
                {slotKcal > 0 && <span className="text-xs text-gray-400">{Math.round(slotKcal)} kcal</span>}
                <button onClick={() => onAdd(s.key)} className="w-7 h-7 rounded-full bg-brand-50 text-brand-700 font-bold text-lg leading-none">+</button>
              </div>
            </div>
            {slotEntries.length > 0 && (
              <div className="px-4 pb-3 space-y-1">
                {slotEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm py-1 group">
                    <div className="min-w-0">
                      <div className="truncate">{e.name}</div>
                      <div className="text-[11px] text-gray-400">
                        {e.grams}g · {Math.round(e.nutrients.kcal)} kcal · P{Math.round(e.nutrients.protein)} C{Math.round(e.nutrients.carbs)} F{Math.round(e.nutrients.fat)}
                        {e.nutrients.alcohol > 0 && ` · ${standardDrinks(e.nutrients.alcohol).toFixed(1)} SD`}
                      </div>
                    </div>
                    <button onClick={() => db.log.delete(e.id!)} className="text-gray-300 hover:text-red-500 px-2 text-lg">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
