import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LogEntry, type Profile, type Supplement } from '../db'
import { EMPTY_NUTRIENTS, addNutrients, type Nutrients } from '../lib/nutrition'

// Label-accurate presets. Elevit verified against the Australian product
// (per tablet). Generic entries are typical values — all editable after adding.
const PRESETS: { name: string; doseLabel: string; nutrients: Partial<Nutrients> }[] = [
  {
    name: 'Elevit (pregnancy multivitamin)',
    doseLabel: '1 tablet',
    nutrients: {
      folate: 800, iron: 60, iodine: 220, b12: 2.6, vitC: 85, vitD: 5,
      vitE: 18.7, calcium: 125, magnesium: 100, zinc: 11,
    },
  },
  { name: 'Fish oil 1000mg', doseLabel: '1 capsule', nutrients: { kcal: 9, fat: 1 } },
  { name: 'Vitamin D 1000IU', doseLabel: '1 capsule', nutrients: { vitD: 25 } },
  { name: 'Iron + C (e.g. Ferro-Grad C)', doseLabel: '1 tablet', nutrients: { iron: 105, vitC: 500 } },
  { name: 'Protein powder', doseLabel: '1 scoop (30g)', nutrients: { kcal: 115, protein: 24, carbs: 2, fat: 1.5, calcium: 130 } },
  { name: 'Creatine 5g', doseLabel: '1 scoop (5g)', nutrients: {} },
  { name: 'Magnesium 300mg', doseLabel: '1 tablet', nutrients: { magnesium: 300 } },
  { name: 'Iodine 150µg', doseLabel: '1 tablet', nutrients: { iodine: 150 } },
]

const CUSTOM_FIELDS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'iron', label: 'Iron', unit: 'mg' },
  { key: 'calcium', label: 'Calcium', unit: 'mg' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg' },
  { key: 'zinc', label: 'Zinc', unit: 'mg' },
  { key: 'iodine', label: 'Iodine', unit: 'µg' },
  { key: 'folate', label: 'Folate', unit: 'µg' },
  { key: 'b12', label: 'B12', unit: 'µg' },
  { key: 'vitA', label: 'Vit A', unit: 'µg' },
  { key: 'vitC', label: 'Vit C', unit: 'mg' },
  { key: 'vitD', label: 'Vit D', unit: 'µg' },
  { key: 'vitE', label: 'Vit E', unit: 'mg' },
]

export default function SupplementsCard({ profile, date, entries }: {
  profile: Profile; date: string; entries: LogEntry[]
}) {
  const [managing, setManaging] = useState(false)
  const supplements = useLiveQuery(
    () => db.supplements.where('profileId').equals(profile.id!).toArray(),
    [profile.id],
  )

  const takenToday = (s: Supplement) =>
    entries.find((e) => e.slot === 'supplement' && e.supplementId === s.id)

  const toggle = async (s: Supplement) => {
    const existing = takenToday(s)
    if (existing) {
      await db.log.delete(existing.id!)
    } else {
      await db.log.add({
        profileId: profile.id!, date, slot: 'supplement', foodId: null,
        supplementId: s.id, name: s.name, grams: 0,
        nutrients: addNutrients({ ...EMPTY_NUTRIENTS }, s.nutrients),
        source: 'supplement', createdAt: Date.now(),
      })
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="font-semibold text-sm">💊 Supplements</div>
        <button onClick={() => setManaging(!managing)} className="text-xs font-medium text-brand-700">
          {managing ? 'Done' : 'Manage'}
        </button>
      </div>

      {(supplements ?? []).length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {(supplements ?? []).map((s) => {
            const taken = !!takenToday(s)
            return (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <button onClick={() => toggle(s)} className="flex items-center gap-2.5 py-1.5 flex-1 text-left min-w-0">
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[11px] shrink-0 ${taken ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
                  <span className="min-w-0">
                    <span className={`text-sm block truncate ${taken ? '' : 'text-gray-500'}`}>{s.name}</span>
                    <span className="text-[11px] text-gray-400">{s.doseLabel}</span>
                  </span>
                </button>
                {managing && (
                  <button onClick={() => db.supplements.delete(s.id!)} className="text-gray-300 hover:text-red-500 px-1 text-lg shrink-0">×</button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(supplements ?? []).length === 0 && !managing && (
        <div className="px-4 pb-3 text-xs text-gray-400">
          Tap Manage to add your daily supplements — then logging them is one tap.
        </div>
      )}

      {managing && <ManagePanel profile={profile} existing={supplements ?? []} />}
    </div>
  )
}

function ManagePanel({ profile, existing }: { profile: Profile; existing: Supplement[] }) {
  const [showCustom, setShowCustom] = useState(false)
  const [name, setName] = useState('')
  const [doseLabel, setDoseLabel] = useState('1 tablet')
  const [vals, setVals] = useState<Record<string, string>>({})

  const addPreset = (p: (typeof PRESETS)[number]) =>
    db.supplements.add({ profileId: profile.id!, name: p.name, doseLabel: p.doseLabel, nutrients: p.nutrients, createdAt: Date.now() })

  const addCustom = async () => {
    if (!name.trim()) return
    const nutrients: Partial<Nutrients> = {}
    for (const f of CUSTOM_FIELDS) {
      const v = parseFloat(vals[f.key] ?? '')
      if (Number.isFinite(v) && v > 0) nutrients[f.key] = v
    }
    await db.supplements.add({ profileId: profile.id!, name: name.trim(), doseLabel: doseLabel.trim() || '1 dose', nutrients, createdAt: Date.now() })
    setName(''); setVals({}); setShowCustom(false)
  }

  const notAdded = PRESETS.filter((p) => !existing.some((s) => s.name === p.name))

  return (
    <div className="border-t border-gray-100 px-4 py-3 space-y-3">
      {notAdded.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Common supplements</div>
          <div className="flex flex-wrap gap-1.5">
            {notAdded.map((p) => (
              <button key={p.name} onClick={() => addPreset(p)}
                className="px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-800 text-xs font-medium">
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showCustom && (
        <button onClick={() => setShowCustom(true)} className="text-xs font-medium text-gray-500 underline">
          Add a custom supplement (enter its label values)
        </button>
      )}

      {showCustom && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm" placeholder="Name"
              value={name} onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm" placeholder="Dose (e.g. 1 tablet)"
              value={doseLabel} onChange={(e) => setDoseLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {CUSTOM_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-[10px] text-gray-400 block">{f.label} {f.unit}</label>
                <input className="w-full rounded-lg border border-gray-300 px-1.5 py-1 text-sm" inputMode="decimal"
                  value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <button onClick={addCustom} disabled={!name.trim()}
            className="w-full rounded-xl bg-brand-600 text-white text-sm font-semibold py-2 disabled:opacity-40">
            Add supplement
          </button>
        </div>
      )}
    </div>
  )
}
