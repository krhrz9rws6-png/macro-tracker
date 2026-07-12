import { useLiveQuery } from 'dexie-react-hooks'
import { db, weekDates, todayStr, type Profile } from '../db'
import { NHMRC_WEEKLY_SD_LIMIT, standardDrinks } from '../lib/nutrition'
import { dayQuality, dayTotals } from './TodayView'
import { MacroBar } from './ui'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekView({ profile, date, onPickDay }: {
  profile: Profile; date: string; onPickDay: (d: string) => void
}) {
  const dates = weekDates(date)
  const today = todayStr()

  const weekEntries = useLiveQuery(
    () => db.log.where('[profileId+date]').between([profile.id!, dates[0]], [profile.id!, dates[6]], true, true).toArray(),
    [profile.id, dates[0], dates[6]],
  )

  const byDate = (d: string) => (weekEntries ?? []).filter((e) => e.date === d)
  const totals = dayTotals(weekEntries)
  const t = profile.targets

  // Weekly budget = 7× daily, but only count elapsed days for "on track" feel.
  const weeklySd = standardDrinks(totals.alcohol)

  const daysWithFood = dates.filter((d) => byDate(d).length > 0).length
  const avgQuality = (() => {
    const qs = dates.map((d) => dayQuality(byDate(d))).filter((q): q is number => q != null)
    return qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : null
  })()

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="text-sm font-semibold">This week's budget</div>
        <MacroBar label="Calories" used={totals.kcal} target={t.kcal * 7} unit="" accent="bg-brand-500" />
        <div className="flex gap-3">
          <MacroBar label="Protein" used={totals.protein} target={t.protein * 7} accent="bg-sky-500" />
          <MacroBar label="Carbs" used={totals.carbs} target={t.carbs * 7} accent="bg-amber-500" />
          <MacroBar label="Fat" used={totals.fat} target={t.fat * 7} accent="bg-rose-400" />
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span className={weeklySd > NHMRC_WEEKLY_SD_LIMIT ? 'text-red-600 font-semibold' : ''}>
            🍷 {weeklySd.toFixed(1)}/{NHMRC_WEEKLY_SD_LIMIT} standard drinks
          </span>
          {avgQuality != null && <span>Avg quality {avgQuality}/100</span>}
          <span>{daysWithFood}/7 days logged</span>
        </div>
      </div>

      <div className="space-y-2">
        {dates.map((d, i) => {
          const dayEntries = byDate(d)
          const dt = dayTotals(dayEntries)
          const q = dayQuality(dayEntries)
          const pct = Math.min(100, (dt.kcal / t.kcal) * 100)
          const over = dt.kcal > t.kcal
          const isToday = d === today
          const isFuture = d > today
          return (
            <button key={d} onClick={() => onPickDay(d)}
              className={`w-full rounded-2xl border p-3 text-left bg-white shadow-sm ${isToday ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200'} ${isFuture ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold">
                  {DAY_LABELS[i]} <span className="text-gray-400 font-normal">{d.slice(8)}/{d.slice(5, 7)}</span>
                  {isToday && <span className="ml-1.5 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">today</span>}
                </span>
                <span className="text-xs text-gray-500">
                  {dayEntries.length > 0 ? `${Math.round(dt.kcal)}/${t.kcal} kcal` : '—'}
                  {q != null && <span className="ml-2">Q{q}</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
