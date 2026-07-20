import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recipe, type RecipeIngredient } from '../db'
import { searchFoods, getFood, foodMeasures } from '../lib/afcd'
import { recipeNutrition } from '../lib/recipe'
import { parseIngredientLine } from '../lib/parseIngredient'

export default function RecipesView() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray(), [])
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null)

  if (editing) {
    return <RecipeEditor recipe={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Recipes</h2>
        <button onClick={() => setEditing('new')} className="rounded-xl bg-brand-600 text-white text-sm font-semibold px-3 py-2">
          + New recipe
        </button>
      </div>

      {(recipes ?? []).length === 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-sm text-gray-400">
          No recipes yet. Add your family favourites — the app computes the macros per serving,
          and you can log a whole meal in one tap.
        </div>
      )}

      {(recipes ?? []).map((r) => {
        const n = recipeNutrition(r)
        const isPlaceholder = !r.statedPerServing && r.ingredients.length === 0
        return (
          <button key={r.id} onClick={() => setEditing(r)}
            className="w-full text-left rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.name}</div>
                <div className="text-xs text-gray-400">
                  {r.servings} serving{r.servings === 1 ? '' : 's'}
                  {r.source === 'cozyla' && ' · from Cozyla'}
                  {n.totalCount > 0 && n.matchedCount < n.totalCount && !r.statedPerServing &&
                    ` · ${n.matchedCount}/${n.totalCount} matched`}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                {isPlaceholder ? (
                  <div className="text-xs text-amber-600 font-medium">macros not set</div>
                ) : (
                  <>
                    <div className="font-semibold">{Math.round(n.perServing.kcal)} kcal</div>
                    <div className="text-[11px] text-gray-400">
                      P{Math.round(n.perServing.protein)} C{Math.round(n.perServing.carbs)} F{Math.round(n.perServing.fat)}
                    </div>
                  </>
                )}
              </div>
            </div>
            {isPlaceholder && (
              <div className="mt-2 text-[11px] text-gray-500 bg-amber-50 rounded-lg px-2 py-1.5">
                Placeholder from your plan. Import this recipe (Me → Import → Recipe) or tap to add ingredients.
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

function RecipeEditor({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const [name, setName] = useState(recipe?.name ?? '')
  const [servings, setServings] = useState(String(recipe?.servings ?? 4))
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(recipe?.ingredients ?? [])
  const [newLine, setNewLine] = useState('')

  const servingsN = Math.max(1, parseInt(servings) || 1)
  const draft: Recipe = {
    ...recipe,
    name: name.trim() || 'Untitled',
    servings: servingsN,
    ingredients,
    statedPerServing: recipe?.statedPerServing,
    source: recipe?.source ?? 'manual',
    createdAt: recipe?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
  const n = useMemo(() => recipeNutrition(draft), [draft])

  const addLine = () => {
    if (!newLine.trim()) return
    const parsed = parseIngredientLine(newLine)
    const g = parsed.grams ?? (parsed.suggestion ? (foodMeasures(parsed.suggestion.id)[0]?.grams ?? 100) : 100)
    setIngredients([...ingredients, {
      text: newLine.trim(),
      foodId: parsed.suggestion?.id ?? null,
      grams: Math.round(g),
      unitLabel: parsed.unitLabel,
    }])
    setNewLine('')
  }

  const updateIng = (i: number, patch: Partial<RecipeIngredient>) =>
    setIngredients(ingredients.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)))
  const removeIng = (i: number) => setIngredients(ingredients.filter((_, j) => j !== i))

  const save = async () => {
    const payload = { ...draft }
    delete (payload as { id?: number }).id
    if (recipe?.id) await db.recipes.update(recipe.id, payload)
    else await db.recipes.add(payload)
    onClose()
  }

  const del = async () => {
    if (recipe?.id && confirm(`Delete "${recipe.name}"?`)) { await db.recipes.delete(recipe.id); onClose() }
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-gray-500">‹ Back</button>
        <div className="flex gap-3">
          {recipe?.id && <button onClick={del} className="text-sm text-red-400">Delete</button>}
          <button onClick={save} className="rounded-xl bg-brand-600 text-white text-sm font-semibold px-4 py-1.5">Save</button>
        </div>
      </div>

      <input className={`${input} text-lg font-semibold`} placeholder="Recipe name" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Serves</label>
        <input className="w-20 rounded-xl border border-gray-300 px-3 py-2 text-center" inputMode="numeric"
          value={servings} onChange={(e) => setServings(e.target.value)} />
      </div>

      <div className="rounded-2xl bg-brand-50 border border-brand-100 p-4">
        <div className="text-xs font-semibold text-brand-800 uppercase tracking-wide mb-1">Per serving</div>
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-bold">{Math.round(n.perServing.kcal)}<span className="text-sm font-normal text-gray-500"> kcal</span></div>
          <div className="text-sm text-gray-600">P{Math.round(n.perServing.protein)} · C{Math.round(n.perServing.carbs)} · F{Math.round(n.perServing.fat)}</div>
        </div>
        {draft.statedPerServing ? (
          <div className="text-[11px] text-gray-500 mt-1">Macros from Cozyla. Add ingredients for micronutrients + per-person portions.</div>
        ) : n.totalCount > 0 && n.matchedCount < n.totalCount ? (
          <div className="text-[11px] text-amber-700 mt-1">{n.matchedCount}/{n.totalCount} ingredients matched — unmatched ones aren't counted yet.</div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Ingredients</div>
        {ingredients.map((ing, i) => (
          <IngredientRow key={i} ing={ing} onChange={(p) => updateIng(i, p)} onRemove={() => removeIng(i)} />
        ))}

        <div className="flex gap-2">
          <input className={input} placeholder='Add ingredient, e.g. "212 g brown sugar"'
            value={newLine} onChange={(e) => setNewLine(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLine()} />
          <button onClick={addLine} className="rounded-xl bg-gray-900 text-white px-4 font-semibold shrink-0">Add</button>
        </div>
        <p className="text-[11px] text-gray-400">
          The app reads the amount and finds the food automatically — then you can fix the match or grams below each line.
        </p>
      </div>
    </div>
  )
}

function IngredientRow({ ing, onChange, onRemove }: {
  ing: RecipeIngredient; onChange: (p: Partial<RecipeIngredient>) => void; onRemove: () => void
}) {
  const [editingMatch, setEditingMatch] = useState(false)
  const [q, setQ] = useState('')
  const food = ing.foodId ? getFood(ing.foodId) : null
  const results = q ? searchFoods(q, 6) : []

  return (
    <div className="rounded-xl border border-gray-200 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm truncate">{ing.text}</div>
          <button onClick={() => setEditingMatch(!editingMatch)} className="text-[11px] text-left">
            {food
              ? <span className="text-gray-500">→ {food.name} <span className="text-brand-700">· change</span></span>
              : <span className="text-amber-600">⚠ tap to match a food</span>}
          </button>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm" inputMode="numeric"
            value={ing.grams} onChange={(e) => onChange({ grams: Math.max(0, parseInt(e.target.value) || 0) })} />
          <span className="text-xs text-gray-400">g</span>
          <button onClick={onRemove} className="text-gray-300 hover:text-red-500 text-lg px-1">×</button>
        </div>
      </div>

      {editingMatch && (
        <div className="mt-2">
          <input autoFocus className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
            placeholder="Search food to match…" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.map((f) => (
            <button key={f.id} onClick={() => { onChange({ foodId: f.id }); setEditingMatch(false); setQ('') }}
              className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-gray-50">
              {f.name} <span className="text-xs text-gray-400">{f.kcal}kcal/100g</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

