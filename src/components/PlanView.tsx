import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr, weekDates, type PlanEntry, type PlanSlot, type Profile, type Recipe } from '../db'
import { EMPTY_NUTRIENTS, addNutrients, type Nutrients } from '../lib/nutrition'
import { recipeNutrition } from '../lib/recipe'

const PLAN_SLOTS: { key: PlanSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { key: 'lunch', label: 'Lunch', emoji: '🥪' },
  { key: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { key: 'snack', label: 'Snack', emoji: '🍎' },
]
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PlanView({ profile, date }: {
  profile: Profile; date: string
}) {
  const dates = weekDates(date)
  const [pick, setPick] = useState<{ date: string; slot: PlanSlot } | null>(null)

  const planEntries = useLiveQuery(
    () => db.plan.where('date').between(dates[0], dates[6], true, true).toArray(),
    [dates[0], dates[6]],
  )
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), [])
  // Which planned meals are already logged today? (matched by name + recipe source)
  const loggedNames = useLiveQuery(async () => {
    const rows = await db.log.where('[profileId+date]').between([profile.id!, dates[0]], [profile.id!, dates[6]], true, true).toArray()
    return new Set(rows.filter((r) => r.source === 'recipe').map((r) => `${r.date}|${r.name}`))
  }, [profile.id, dates[0], dates[6]])

  const entriesFor = (d: string, slot: PlanSlot) => (planEntries ?? []).filter((e) => e.date === d && e.slot === slot)
  const recipeById = (id: number) => (recipes ?? []).find((r) => r.id === id)

  const addToPlan = async (recipe: Recipe) => {
    if (!pick) return
    await db.plan.add({ date: pick.date, slot: pick.slot, recipeId: recipe.id!, title: recipe.name, createdAt: Date.now() })
    setPick(null)
  }

  const confirmMeal = async (e: PlanEntry) => {
    const r = recipeById(e.recipeId)
    if (!r) return
    const per = recipeNutrition(r).perServing
    const nutrients = addNutrients({ ...EMPTY_NUTRIENTS },
      Object.fromEntries(Object.entries(per)) as Partial<Nutrients>)
    await db.log.add({
      profileId: profile.id!, date: e.date, slot: e.slot, foodId: null, name: e.title,
      grams: 0, nutrients, source: 'recipe', createdAt: Date.now(),
    })
  }

  const unlogMeal = async (e: PlanEntry) => {
    const rows = await db.log.where('[profileId+date]').equals([profile.id!, e.date]).toArray()
    const match = rows.find((r) => r.source === 'recipe' && r.name === e.title)
    if (match) await db.log.delete(match.id!)
  }

  const removeFromPlan = (id: number) => db.plan.delete(id)

  const today = todayStr()

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">This week's plan</h2>
      </div>
      <p className="text-xs text-gray-400 -mt-2">
        Plan meals from your recipes, then tap ✓ to log one to your day. Import a week from Cozyla via the Me tab.
      </p>

      {dates.map((d, i) => {
        const dayEntries = PLAN_SLOTS.flatMap((s) => entriesFor(d, s.key).map((e) => ({ e, slot: s })))
        const dayKcal = dayEntries.reduce((sum, { e }) => {
          const r = recipeById(e.recipeId); return sum + (r ? recipeNutrition(r).perServing.kcal : 0)
        }, 0)
        const isToday = d === today
        return (
          <div key={d} className={`rounded-2xl bg-white border shadow-sm ${isToday ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-sm font-semibold">
                {DAY_LABELS[i]} <span className="text-gray-400 font-normal">{d.slice(8)}/{d.slice(5, 7)}</span>
                {isToday && <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">today</span>}
              </span>
              {dayKcal > 0 && <span className="text-xs text-gray-400">≈{Math.round(dayKcal)} kcal planned</span>}
            </div>
            <div className="p-2 space-y-1">
              {PLAN_SLOTS.map((s) => {
                const es = entriesFor(d, s.key)
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 shrink-0">{s.emoji} {s.label}</span>
                    <div className="flex-1 flex flex-wrap gap-1">
                      {es.map((e) => {
                        const done = loggedNames?.has(`${d}|${e.title}`)
                        return (
                          <span key={e.id} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                            {done
                              ? <button onClick={() => unlogMeal(e)} title="Logged — tap to undo" className="font-bold">✓</button>
                              : <button onClick={() => confirmMeal(e)} title="Log this to your day" className="text-brand-700 font-bold text-sm">＋</button>}
                            {e.title}
                            <button onClick={() => removeFromPlan(e.id!)} className="text-gray-400">×</button>
                          </span>
                        )
                      })}
                      <button onClick={() => setPick({ date: d, slot: s.key })}
                        className="rounded-lg border border-dashed border-gray-300 text-gray-400 px-2 py-1 text-xs">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {pick && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center" onClick={() => setPick(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[80dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 font-semibold">Add a recipe to {pick.slot}</div>
            <div className="flex-1 overflow-y-auto p-2">
              {(recipes ?? []).length === 0 && (
                <div className="p-6 text-center text-sm text-gray-400">No recipes yet — add some in the Recipes tab first.</div>
              )}
              {(recipes ?? []).map((r) => {
                const per = recipeNutrition(r).perServing
                return (
                  <button key={r.id} onClick={() => addToPlan(r)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 flex justify-between items-center">
                    <span className="text-sm">{r.name}</span>
                    <span className="text-xs text-gray-400">{Math.round(per.kcal)} kcal/serve</span>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setPick(null)} className="m-3 py-3 rounded-2xl border border-gray-300 font-medium text-gray-600">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
