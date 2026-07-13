import { useEffect, useState } from 'react'
import { db, type Profile } from '../db'
import {
  ACTIVITY_LEVELS, GOAL_PRESETS, bmrMifflinStJeor, effectiveTargets, goalLockedOut,
  macroTargets, pregnancyEnergyBump, tdee, trimesterOf,
  type ActivityKey, type Goal, type PregnancyState,
} from '../lib/nutrition'
import ImportView from './ImportView'
import { hasApiKey } from '../lib/settings'

const PREG_STATES: { key: PregnancyState | 'off'; label: string }[] = [
  { key: 'off', label: 'Off' },
  { key: 'planning', label: 'Planning' },
  { key: 'pregnant', label: 'Pregnant' },
  { key: 'breastfeeding', label: 'Breastfeeding' },
]

export default function SettingsView({ profile }: { profile: Profile }) {
  const [importing, setImporting] = useState(false)
  if (importing) return <ImportView onClose={() => setImporting(false)} />
  return <SettingsBody profile={profile} onImport={() => setImporting(true)} />
}

function SettingsBody({ profile, onImport }: { profile: Profile; onImport: () => void }) {
  const [age, setAge] = useState(String(profile.ageYears))
  const [height, setHeight] = useState(String(profile.heightCm))
  const [weight, setWeight] = useState(String(profile.weightKg))
  const [activity, setActivity] = useState<ActivityKey>(profile.activity)
  const [goal, setGoal] = useState<Goal>(profile.goal)
  const [kcal, setKcal] = useState(String(profile.targets.kcal))
  const [protein, setProtein] = useState(String(profile.targets.protein))
  const [carbs, setCarbs] = useState(String(profile.targets.carbs))
  const [fat, setFat] = useState(String(profile.targets.fat))
  const [saved, setSaved] = useState(false)

  // Re-sync the form when switching profiles.
  useEffect(() => {
    setAge(String(profile.ageYears)); setHeight(String(profile.heightCm))
    setWeight(String(profile.weightKg)); setActivity(profile.activity); setGoal(profile.goal)
    setKcal(String(profile.targets.kcal)); setProtein(String(profile.targets.protein))
    setCarbs(String(profile.targets.carbs)); setFat(String(profile.targets.fat))
  }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const ageN = parseInt(age), heightN = parseFloat(height), weightN = parseFloat(weight)
  const statsValid = ageN > 0 && heightN > 0 && weightN > 0
  const bmr = statsValid ? bmrMifflinStJeor(profile.sex, weightN, heightN, ageN) : profile.bmr
  const tdeeVal = tdee(bmr, activity)
  const suggested = statsValid ? macroTargets(tdeeVal, goal, weightN) : profile.targets

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500) }

  const saveStats = async (useSuggested: boolean) => {
    if (!statsValid) return
    const targets = useSuggested
      ? suggested
      : { kcal: parseInt(kcal) || 0, protein: parseInt(protein) || 0, carbs: parseInt(carbs) || 0, fat: parseInt(fat) || 0 }
    await db.profiles.update(profile.id!, {
      ageYears: ageN, heightCm: heightN, weightKg: weightN, activity, goal,
      bmr, tdee: tdeeVal, targets,
    })
    if (useSuggested) {
      setKcal(String(targets.kcal)); setProtein(String(targets.protein))
      setCarbs(String(targets.carbs)); setFat(String(targets.fat))
    }
    flash()
  }

  const deleteProfile = async () => {
    if (!confirm(`Delete ${profile.name}'s profile and all their logged food? This can't be undone.`)) return
    await db.log.where('profileId').equals(profile.id!).delete()
    await db.favorites.where('profileId').equals(profile.id!).delete()
    await db.supplements.where('profileId').equals(profile.id!).delete()
    await db.profiles.delete(profile.id!)
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500'
  const targetsDiffer =
    parseInt(kcal) !== suggested.kcal || parseInt(protein) !== suggested.protein ||
    parseInt(carbs) !== suggested.carbs || parseInt(fat) !== suggested.fat

  return (
    <div className="p-4 space-y-4">
      <button onClick={onImport}
        className="w-full rounded-3xl bg-brand-600 text-white shadow-sm p-4 flex items-center justify-between">
        <span className="text-left">
          <span className="block font-semibold">📸 Import from Cozyla</span>
          <span className="block text-xs text-brand-100">Screenshot a recipe, weekly plan, or grocery list</span>
        </span>
        <span className="text-2xl">›</span>
        {!hasApiKey() && <span className="sr-only">API key needed</span>}
      </button>

      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="text-sm font-semibold">{profile.name} — stats</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">Age</label>
            <input className={input} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Height cm</label>
            <input className={input} inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Weight kg</label>
            <input className={input} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Activity</label>
          <select className={input} value={activity} onChange={(e) => setActivity(e.target.value as ActivityKey)}>
            {ACTIVITY_LEVELS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Goal</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(Object.keys(GOAL_PRESETS) as Goal[]).map((g) => {
              const locked = goalLockedOut(g, profile.pregnancy)
              return (
                <button key={g} onClick={() => !locked && setGoal(g)} disabled={locked}
                  className={`rounded-xl py-1.5 px-1 border text-sm ${goal === g ? 'bg-brand-600 text-white border-brand-600' : locked ? 'bg-gray-50 border-gray-200 text-gray-300' : 'bg-white border-gray-300 text-gray-600'}`}>
                  {GOAL_PRESETS[g].label}{locked && ' 🔒'}
                </button>
              )
            })}
          </div>
          {goalLockedOut('lose', profile.pregnancy) && (
            <p className="text-[11px] text-gray-400 mt-1">
              Weight-loss goals are unavailable during pregnancy and breastfeeding — the aim is healthy gain/maintenance.
            </p>
          )}
        </div>
        <div className="text-xs text-gray-500 pt-1">
          BMR {bmr} kcal · TDEE {tdeeVal} kcal → suggested {suggested.kcal} kcal,
          P{suggested.protein} C{suggested.carbs} F{suggested.fat}
        </div>
        <button onClick={() => saveStats(true)} disabled={!statsValid}
          className="w-full rounded-xl bg-brand-600 text-white font-semibold py-2.5 disabled:opacity-40">
          Save & recalculate targets
        </button>
      </div>

      <PregnancyCard profile={profile} />

      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="text-sm font-semibold">Hand-tuned targets</div>
        <p className="text-xs text-gray-400 -mt-2">
          Override the suggested numbers — e.g. a coach's plan. These are what the tracker uses.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {([['kcal', kcal, setKcal], ['Protein', protein, setProtein], ['Carbs', carbs, setCarbs], ['Fat', fat, setFat]] as const).map(([label, val, set]) => (
            <div key={label}>
              <label className="text-xs text-gray-500">{label}</label>
              <input className={input} inputMode="numeric" value={val} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
        </div>
        <button onClick={() => saveStats(false)} disabled={!statsValid}
          className={`w-full rounded-xl font-semibold py-2.5 border ${targetsDiffer ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-300'}`}>
          Save custom targets
        </button>
      </div>

      {saved && <div className="text-center text-sm font-medium text-brand-700">Saved ✓</div>}

      <button onClick={deleteProfile} className="w-full text-center text-sm text-red-400 py-2">
        Delete this profile
      </button>
    </div>
  )
}

function PregnancyCard({ profile }: { profile: Profile }) {
  const status = profile.pregnancy
  const state: PregnancyState | 'off' = status?.state ?? 'off'
  const [dueDate, setDueDate] = useState(status?.dueDate ?? '')

  useEffect(() => { setDueDate(profile.pregnancy?.dueDate ?? '') }, [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setState = async (s: PregnancyState | 'off') => {
    if (s === 'off') {
      await db.profiles.update(profile.id!, { pregnancy: undefined })
    } else {
      // Coming out of a lose goal is forced when entering pregnancy/breastfeeding.
      const patch: Partial<Profile> = { pregnancy: { state: s, dueDate: dueDate || undefined } }
      if (s !== 'planning' && profile.goal === 'lose') patch.goal = 'maintain'
      await db.profiles.update(profile.id!, patch)
    }
  }

  const saveDue = async (v: string) => {
    setDueDate(v)
    if (status) await db.profiles.update(profile.id!, { pregnancy: { ...status, dueDate: v || undefined } })
  }

  const eff = effectiveTargets(profile.targets, profile.weightKg, status)
  const bump = pregnancyEnergyBump(status)

  return (
    <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="text-sm font-semibold">🤰 Pregnancy & breastfeeding</div>
      <div className="grid grid-cols-4 gap-1.5">
        {PREG_STATES.map((s) => (
          <button key={s.key} onClick={() => setState(s.key)}
            className={`rounded-xl py-1.5 px-0.5 border text-[11px] font-medium ${state === s.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-600'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {state === 'pregnant' && (
        <div>
          <label className="text-xs text-gray-500">Due date (sets your trimester automatically)</label>
          <input type="date" value={dueDate} onChange={(e) => saveDue(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-base" />
        </div>
      )}

      {state !== 'off' && status && (
        <div className="rounded-xl bg-brand-50 p-3 text-xs text-gray-600 space-y-1">
          {state === 'pregnant' && (
            <div className="font-semibold text-brand-800">
              Trimester {trimesterOf(status)} · {bump > 0 ? `+${bump} kcal/day` : 'no extra calories needed yet — eating for 1.1, not 2'}
            </div>
          )}
          {state === 'breastfeeding' && <div className="font-semibold text-brand-800">+500 kcal/day while breastfeeding</div>}
          {state === 'planning' && <div className="font-semibold text-brand-800">Folate target raised — folic acid 500µg/day is recommended from now</div>}
          <div>Today's targets: {eff.kcal} kcal · P{eff.protein} C{eff.carbs} F{eff.fat}</div>
          <div>Micronutrient bars now use {state} daily values (iron, folate, iodine…). Caffeine gauge ≤200mg. Alcohol guidance: none is safest.</div>
          <div className="text-gray-400 pt-1">Defaults from Australian guidelines — your GP/midwife's advice wins.</div>
        </div>
      )}
      {state === 'off' && (
        <p className="text-[11px] text-gray-400">
          Adjusts calories by trimester, raises protein and micronutrient targets, adds a caffeine gauge and food-safety flags.
        </p>
      )}
    </div>
  )
}
