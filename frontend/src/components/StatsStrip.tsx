import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Search, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

interface Tile {
  label: string
  value: number
  icon: LucideIcon
  bar: string
  iconColor: string
  glow?: boolean
}

function StatTile({ label, value, icon: Icon, bar, iconColor, glow }: Readonly<Tile>) {
  const displayed = useCountUp(value)
  return (
    <div className={`relative bg-[#111116] border border-[#1e1e2a] rounded-lg px-5 py-4 flex flex-col gap-1.5 overflow-hidden ${glow ? 'glow-violet' : ''}`}>
      <div className={`absolute inset-x-0 top-0 h-px ${bar}`} />
      <div className="flex items-start justify-between">
        <span className="text-4xl font-bold text-white tabular-nums leading-none tracking-tight">{displayed}</span>
        <Icon size={14} className={`mt-1 ${iconColor}`} />
      </div>
      <span className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">{label}</span>
    </div>
  )
}

interface Props { total: number; open: number; investigating: number; analysed: number }

export function StatsStrip({ total, open, investigating, analysed }: Readonly<Props>) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatTile label="Total"         value={total}        icon={Activity}    bar="bg-zinc-700"   iconColor="text-zinc-500" />
      <StatTile label="Open"          value={open}         icon={AlertCircle} bar="bg-red-500"    iconColor="text-red-400" />
      <StatTile label="Investigating" value={investigating} icon={Search}      bar="bg-orange-500" iconColor="text-orange-400" />
      <StatTile label="Analyses Run"  value={analysed}     icon={Zap}         bar="bg-violet-500" iconColor="text-violet-400" glow />
    </div>
  )
}
