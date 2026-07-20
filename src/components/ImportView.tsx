import { useState } from 'react'
import { db, type PlanSlot, type RecipeIngredient } from '../db'
import { foodMeasures } from '../lib/afcd'
import { weekDates, todayStr } from '../db'
import { parseIngredientLine } from '../lib/parseIngredient'
import { getApiKey, setApiKey } from '../lib/settings'
import {
  fileToBase64, parseScreenshot, type ImportKind, type ParsedPlanDay, type ParsedRecipe, type VisionResult,
} from '../lib/vision'
import { EMPTY_NUTRIENTS } from '../lib/nutrition'

const KINDS: { key: ImportKind; label: string; hint: string }[] = [
  { key: 'recipe', label: 'Recipe', hint: 'A single recipe with its ingredients & macros' },
  { key: 'plan', label: 'Weekly plan', hint: "One screenshot of Cozyla's week view" },
  { key: 'grocery', label: 'Grocery list', hint: 'The shared grocery-list image' },
]

function ingredientsFromLines(lines: string[]): RecipeIngredient[] {
  return lines.map((line) => {
    const p = parseIngredientLine(line)
    const grams = p.grams ?? (p.suggestion ? foodMeasures(p.suggestion.id)[0]?.grams ?? 100 : 100)
    return { text: line, foodId: p.suggestion?.id ?? null, grams: Math.round(grams), unitLabel: p.unitLabel }
  })
}

export default function ImportView({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getApiKey())
  const [kind, setKind] = useState<ImportKind>('recipe')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<VisionResult | null>(null)
  const [savedMsg, setSavedMsg] = useState('')

  const saveKey = () => setApiKey(key.trim())

  const onFile = async (file: File) => {
    setError(''); setResult(null); setSavedMsg('')
    if (!getApiKey()) { setError('Enter your Anthropic API key first.'); return }
    setBusy(true)
    try {
      const { data, mediaType } = await fileToBase64(file)
      const res = await parseScreenshot(getApiKey(), kind, data, mediaType)
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-gray-500">‹ Back</button>
        <div className="font-semibold">Import from Cozyla</div>
        <span className="w-10" />
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
        <div className="text-sm font-semibold">Anthropic API key</div>
        <p className="text-[11px] text-gray-400 -mt-1">
          Stored only on this phone, never uploaded to our servers. Get one at console.anthropic.com → API keys.
          Reading a screenshot costs about a cent.
        </p>
        <div className="flex gap-2">
          <input className={input} type="password" placeholder="sk-ant-…" value={key}
            onChange={(e) => setKey(e.target.value)} onBlur={saveKey} />
          <button onClick={saveKey} className="rounded-xl bg-gray-900 text-white px-4 font-semibold shrink-0">Save</button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
        <div className="text-sm font-semibold">What are you importing?</div>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.key} onClick={() => { setKind(k.key); setResult(null) }}
              className={`rounded-xl py-2 px-1 border text-sm font-medium ${kind === k.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-600'}`}>
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">{KINDS.find((k) => k.key === kind)!.hint}</p>

        <label className={`block rounded-xl border-2 border-dashed py-8 text-center cursor-pointer ${busy ? 'opacity-50' : 'border-gray-300'}`}>
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          <div className="text-3xl mb-1">📸</div>
          <div className="text-sm font-medium text-gray-600">{busy ? 'Reading screenshot…' : 'Tap to choose a screenshot'}</div>
        </label>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>

      {result && (
        <ReviewResult result={result} onSaved={(m) => { setSavedMsg(m); setResult(null) }} />
      )}
      {savedMsg && <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{savedMsg}</div>}
    </div>
  )
}

function ReviewResult({ result, onSaved }: { result: VisionResult; onSaved: (msg: string) => void }) {
  if (result.kind === 'recipe' && result.recipe) return <ReviewRecipe recipe={result.recipe} onSaved={onSaved} />
  if (result.kind === 'plan' && result.plan) return <ReviewPlan days={result.plan} onSaved={onSaved} />
  if (result.kind === 'grocery' && result.grocery) return <ReviewGrocery items={result.grocery.items} onSaved={onSaved} />
  return <div className="text-sm text-gray-400">Nothing recognised — try a clearer screenshot.</div>
}

function ReviewRecipe({ recipe, onSaved }: { recipe: ParsedRecipe; onSaved: (m: string) => void }) {
  const [name, setName] = useState(recipe.name ?? 'Imported recipe')
  const [servings, setServings] = useState(String(recipe.servings ?? 4))
  const ps = recipe.perServing

  const save = async () => {
    const ingredients = ingredientsFromLines(recipe.ingredients ?? [])
    const statedPerServing = ps
      ? { ...EMPTY_NUTRIENTS, kcal: ps.kcal ?? 0, protein: ps.protein ?? 0, carbs: ps.carbs ?? 0, fat: ps.fat ?? 0 }
      : undefined
    const fields = {
      name: name.trim(), servings: Math.max(1, parseInt(servings) || 1),
      ingredients, statedPerServing, source: 'cozyla' as const,
      category: recipe.category ?? undefined, updatedAt: Date.now(),
    }
    // If a placeholder with this name already exists (e.g. from a plan import),
    // fill it in rather than creating a duplicate.
    const existing = await db.recipes.filter((r) => r.name.toLowerCase() === fields.name.toLowerCase()).first()
    if (existing) {
      await db.recipes.update(existing.id!, fields)
      onSaved(`Updated "${fields.name}" with its macros.`)
    } else {
      await db.recipes.add({ ...fields, createdAt: Date.now() })
      onSaved(`Saved "${fields.name}" to your recipes.`)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
      <div className="text-sm font-semibold">Review recipe</div>
      <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Serves</span>
        <input className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-center" value={servings} onChange={(e) => setServings(e.target.value)} />
      </div>
      {ps && <div className="text-xs text-gray-500">Cozyla macros/serving: {Math.round(ps.kcal ?? 0)} kcal · P{Math.round(ps.protein ?? 0)} C{Math.round(ps.carbs ?? 0)} F{Math.round(ps.fat ?? 0)}</div>}
      <div className="text-xs text-gray-500">{(recipe.ingredients ?? []).length} ingredients — matched to the food database on save; fix any in the Recipes tab.</div>
      <button onClick={save} className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5">Save recipe</button>
    </div>
  )
}

const SLOT_MAP: Record<string, PlanSlot> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack' }

function ReviewPlan({ days, onSaved }: { days: ParsedPlanDay[]; onSaved: (m: string) => void }) {
  const total = days.reduce((s, d) => s + d.meals.length, 0)

  const save = async () => {
    const week = weekDates(todayStr())
    const dayIndex: Record<string, string> = {}
    const names = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    week.forEach((d, i) => { dayIndex[names[i]] = d })

    let placed = 0
    for (const day of days) {
      const key = (day.day ?? '').toLowerCase().slice(0, 3)
      const date = day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date : dayIndex[key]
      if (!date) continue
      for (const meal of day.meals) {
        const slot = SLOT_MAP[meal.slot?.toLowerCase()] ?? 'dinner'
        // Link to an existing recipe by name if we have one; else create a stub.
        let recipe = await db.recipes.filter((r) => r.name.toLowerCase() === meal.name.toLowerCase()).first()
        if (!recipe) {
          const id = await db.recipes.add({
            name: meal.name, servings: 4, ingredients: [], source: 'cozyla',
            createdAt: Date.now(), updatedAt: Date.now(),
          })
          recipe = await db.recipes.get(id)
        }
        await db.plan.add({ date, slot, recipeId: recipe!.id!, title: meal.name, createdAt: Date.now() })
        placed++
      }
    }
    onSaved(`Added ${placed} planned meal${placed === 1 ? '' : 's'} to this week.`)
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
      <div className="text-sm font-semibold">Review weekly plan</div>
      <div className="text-xs text-gray-500">{total} meals across {days.length} days:</div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {days.map((d, i) => (
          <div key={i} className="text-xs">
            <span className="font-medium">{d.day ?? d.date}:</span>{' '}
            {d.meals.map((m) => `${m.slot} — ${m.name}`).join(' · ') || '—'}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Meals link to matching recipes; unknown ones become stubs you can fill in later (import each recipe for macros).</p>
      <button onClick={save} className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5">Add to this week's plan</button>
    </div>
  )
}

function ReviewGrocery({ items, onSaved }: { items: string[]; onSaved: (m: string) => void }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-2">
      <div className="text-sm font-semibold">Grocery list ({items.length} items)</div>
      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
        {items.map((it, i) => <span key={i} className="rounded-lg bg-gray-100 px-2 py-1 text-xs">{it}</span>)}
      </div>
      <p className="text-[11px] text-gray-400">Price matching (Harris Farm) arrives in the next phase — this confirms the parser reads your list cleanly.</p>
      <button onClick={() => onSaved(`Read ${items.length} grocery items.`)} className="w-full rounded-xl bg-gray-900 text-white font-semibold py-2.5">Done</button>
    </div>
  )
}
