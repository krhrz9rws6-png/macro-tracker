import { useState } from 'react'
import { db } from '../db'
import {
  ACTIVITY_LEVELS, bmrMifflinStJeor, macroTargets, tdee,
  type ActivityKey, type Goal, type Sex,
} from '../lib/nutrition'

const GOALS: { key: Goal; label: string; hint: string }[] = [
  { key: 'lose', label: 'Lose', hint: '−20% calories' },
  { key: 'maintain', label: 'Maintain', hint: 'TDEE calories' },
  { key: 'gain', label: 'Gain', hint: '+10% calories' },
]

export default function Onboarding({ firstProfile, onDone }: { firstProfile: boolean; onDone: () => void }) {
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('female')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState<ActivityKey>('light')
  const [goal, setGoal] = useState<Goal>('maintain')

  const ageN = parseInt(age), heightN = parseFloat(height), weightN = parseFloat(weight)
  const valid = name.trim() && ageN > 0 && heightN > 0 && weightN > 0

  const bmr = valid ? bmrMifflinStJeor(sex, weightN, heightN, ageN) : null
  const tdeeVal = bmr != null ? tdee(bmr, activity) : null
  const targets = tdeeVal != null ? macroTargets(tdeeVal, goal, weightN) : null

  const save = async () => {
    if (!valid || bmr == null || tdeeVal == null || !targets) return
    await db.profiles.add({
      name: name.trim(), sex, ageYears: ageN, heightCm: heightN, weightKg: weightN,
      activity, goal, bmr, tdee: tdeeVal, targets, createdAt: Date.now(),
    })
    onDone()
  }

  const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-md mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mt-4">{firstProfile ? 'Welcome 👋' : 'Add a profile'}</h1>
      <p className="text-gray-500 mt-1 mb-6 text-sm">
        {firstProfile
          ? "Let's work out your baseline — BMR, daily energy, and macro targets."
          : 'Set up their baseline targets.'}
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lucinda" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Sex (for the BMR equation)</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(['female', 'male'] as Sex[]).map((s) => (
              <button key={s} onClick={() => setSex(s)}
                className={`rounded-xl py-2.5 border font-medium capitalize ${sex === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Age</label>
            <input className={input} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="yrs" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Height</label>
            <input className={input} inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="cm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Weight</label>
            <input className={input} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Activity level</label>
          <select className={input} value={activity} onChange={(e) => setActivity(e.target.value as ActivityKey)}>
            {ACTIVITY_LEVELS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Goal</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {GOALS.map((g) => (
              <button key={g.key} onClick={() => setGoal(g.key)}
                className={`rounded-xl py-2 border ${goal === g.key ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-gray-300 text-gray-700'}`}>
                <div className="font-medium">{g.label}</div>
                <div className={`text-[10px] ${goal === g.key ? 'text-brand-100' : 'text-gray-400'}`}>{g.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {bmr != null && tdeeVal != null && targets && (
          <div className="rounded-2xl bg-white border border-gray-200 p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-700 mb-2">Your baseline</div>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <span className="text-gray-500">BMR (Mifflin-St Jeor)</span><span className="text-right font-medium">{bmr} kcal</span>
              <span className="text-gray-500">Daily energy (TDEE)</span><span className="text-right font-medium">{tdeeVal} kcal</span>
              <span className="text-gray-500">Calorie target</span><span className="text-right font-semibold text-brand-700">{targets.kcal} kcal</span>
              <span className="text-gray-500">Protein</span><span className="text-right font-medium">{targets.protein} g</span>
              <span className="text-gray-500">Fat</span><span className="text-right font-medium">{targets.fat} g</span>
              <span className="text-gray-500">Carbs</span><span className="text-right font-medium">{targets.carbs} g</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Protein-first split (1.8 g/kg). You can hand-tune these later.</p>
          </div>
        )}

        <button onClick={save} disabled={!valid}
          className="w-full rounded-2xl bg-brand-600 text-white font-semibold py-3.5 disabled:opacity-40">
          {firstProfile ? 'Start tracking' : 'Add profile'}
        </button>
      </div>
    </div>
  )
}
