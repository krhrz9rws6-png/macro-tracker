import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, addDays, todayStr, type MealSlot } from './db'
import { EMPTY_NUTRIENTS } from './lib/nutrition'
import Onboarding from './components/Onboarding'
import TodayView, { dayTotals, useDayEntries } from './components/TodayView'
import WeekView from './components/WeekView'
import SettingsView from './components/SettingsView'
import RecipesView from './components/RecipesView'
import PlanView from './components/PlanView'
import LogSheet from './components/LogSheet'

type Tab = 'today' | 'week' | 'plan' | 'recipes' | 'me'

export default function App() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), [])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [date, setDate] = useState(todayStr())
  const [tab, setTab] = useState<Tab>('today')
  const [logSlot, setLogSlot] = useState<MealSlot | null>(null)
  const [addingProfile, setAddingProfile] = useState(false)

  const profile = profiles?.find((p) => p.id === (activeId ?? profiles[0]?.id)) ?? profiles?.[0]
  const entries = useDayEntries(profile?.id ?? -1, date)

  // Phones keep the app open for days: when it comes back to the foreground
  // after midnight, roll a stale "today" forward to the real today.
  const dateRef = useRef(date)
  dateRef.current = date
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = todayStr()
      if (dateRef.current !== now && dateRef.current === todayStr(new Date(Date.now() - 864e5))) {
        setDate(now)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

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
      <header className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-200 pt-[env(safe-area-inset-top)]">
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
      {tab === 'plan' && <PlanView profile={profile} date={date} />}
      {tab === 'recipes' && <RecipesView />}
      {tab === 'me' && <SettingsView profile={profile} />}

      {/* Floating log button, sits above the nav */}
      <button
        onClick={() => setLogSlot('snack')}
        className="fixed z-50 right-4 bottom-[calc(4rem+env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-brand-600 text-white text-3xl font-light shadow-lg shadow-brand-600/40"
        aria-label="Log food"
      >+</button>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center">
          {(['today', 'week', 'plan', 'recipes', 'me'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-3.5 text-[13px] font-medium capitalize ${tab === t ? 'text-brand-700' : 'text-gray-400'}`}>
              {t}
            </button>
          ))}
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
