import type { Light } from '../lib/nutrition'

export function MacroBar({ label, used, target, unit = 'g', accent }: {
  label: string; used: number; target: number; unit?: string; accent: string
}) {
  const pct = target > 0 ? Math.min(100, (used / target) * 100) : 0
  const over = used > target
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-medium text-gray-600">{label}</span>
        <span className={over ? 'text-red-600 font-semibold' : 'text-gray-500'}>
          {Math.round(used)}/{Math.round(target)}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : accent}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const LIGHT_STYLES: Record<Light, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
}

export function LightBadge({ label, light }: { label: string; light: Light }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${LIGHT_STYLES[light]}`}>
      {label}
    </span>
  )
}

export function QualityDot({ score }: { score: number | null }) {
  if (score == null) return null
  const color = score >= 55 ? 'bg-green-500' : score >= 30 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      {score}
    </span>
  )
}

export function Ring({ pct, size = 96, stroke = 10, children }: {
  pct: number; size?: number; stroke?: number; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const over = pct > 100
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? '#ef4444' : '#16a34a'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
