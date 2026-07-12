import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addDays, todayStr, type MealSlot } from './db'
import { EMPTY_NUTRIENTS } from './lib/nutrition'
import Onboarding from './components/Onboarding'
import TodayView, { dayTotals, useDayEntries } from './components/TodayView'
import WeekView from './components/WeekView'
import LogSheet from './components/LogSheet'

type Tab = 'today' | 'week'

export default function App() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [date, setDate] = useState(todayStr())
  const [tab, setTab] = useState<Tab>('today')
  const [logSlot, setLogSlot] = useState<MealSlot | null>(null)
  const [addingProfile, setAddingProfile] = useState(false)

  const profile = profiles?.find((p) => p.id === (activeId ?? profiles[0]?.id)) ?? profiles?.[0]
  const entries = useDayEntries(profile?.id ?? -1, date)

  if (!profiles) return null // db loading

  if (profiles.length === 0 || addingProfile) {
    return <Onboarding firstProfile={profiles.length === 0} onDone={() => setAddingProfile(false)} />
  }

  if (!profile) return null

  const totals = dayTotals(entries)
  const remaining = {
    ...EMPTY_NUTRIENTS,
    kcal: profile.targets.kcal - totals.kcal,
    protein: profile.targets.protein - totals.protein,
    carbs: profile.targets.carbs - totals.carbs,
    fat: profile.targets.fat - totals.fat,
  }

  const isToday = date === todayStr()

  return (
    <div className="max-w-md mx-auto min-h-dvh pb-24">
      <header className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex gap-1.5">
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setActiveId(p.id!)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${p.id === profile.id ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
                {p.name}
              </button>
            ))}
            <button onClick={() => setAddingProfile(true)}
              className="w-8 h-8 rounded-full bg-white border border-gray-300 text-gray-400 font-bold">+</button>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setDate(addDays(date, -1))} className="px-2 py-1 text-gray-400">‹</button>
            <button onClick={() => setDate(todayStr())} className={`font-medium ${isToday ? 'text-brand-700' : 'text-gray-600'}`}>
              {isToday ? 'Today' : `${date.slice(8)}/${date.slice(5, 7)}`}
            </button>
            <button onClick={() => setDate(addDays(date, 1))} className="px-2 py-1 text-gray-400">›</button>
          </div>
        </div>
      </header>

      {tab === 'today' && <TodayView profile={profile} date={date} onAdd={(s) => setLogSlot(s)} />}
      {tab === 'week' && <WeekView profile={profile} date={date} onPickDay={(d) => { setDate(d); setTab('today') }} />}

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto grid grid-cols-3 items-center">
          {(['today', 'week'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3.5 text-sm font-medium capitalize ${tab === t ? 'text-brand-700' : 'text-gray-400'}`}>
              {t}
            </button>
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => setLogSlot('snack')}
              className="w-14 h-14 -mt-6 rounded-full bg-brand-600 text-white text-3xl font-light shadow-lg shadow-brand-600/30"
              aria-label="Log food"
            >+</button>
          </div>
        </div>
      </nav>

      {logSlot && profile && (
        <LogSheet
          profile={profile}
          date={date}
          remaining={remaining}
          defaultSlot={logSlot}
          onClose={() => setLogSlot(null)}
        />
      )}
    </div>
  )
}
