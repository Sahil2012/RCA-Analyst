import { useEffect, useState } from 'react'

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const start = Date.now()
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1)
      setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return count
}

interface Props { total: number; open: number; investigating: number; analysed: number }

export function StatsStrip({ total, open, investigating, analysed }: Readonly<Props>) {
  const t = useCountUp(total)
  const o = useCountUp(open)
  const inv = useCountUp(investigating)
  const a = useCountUp(analysed)

  return (
    <div className="flex items-center gap-8 mb-8 pb-6 border-b border-(--border) flex-wrap">
      <Stat value={t}   label="total incidents" />
      <Sep />
      <Stat value={o}   label="open"          dot="bg-red-500" />
      <Sep />
      <Stat value={inv} label="investigating"  dot="bg-blue-400" />
      <Sep />
      <Stat value={a}   label="AI analysed"   dot="bg-amber-400" gold />
    </div>
  )
}

function Stat({ value, label, dot, gold }: Readonly<{ value: number; label: string; dot?: string; gold?: boolean }>) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`text-4xl font-light tabular-nums tracking-tight ${gold ? 'text-(--accent) glow-gold' : 'text-[#dde4f0]'}`}>
        {value}
      </span>
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#3d4f6a]">
        {dot && <span className={`size-1.5 rounded-full ${dot} ${gold ? 'animate-pulse' : ''} shrink-0`} />}
        {label}
      </span>
    </div>
  )
}

function Sep() {
  return <div className="h-5 w-px bg-[#1e2d45] shrink-0" />
}
