import type { FiveWhy } from '../../types'

export function FiveWhys({ items }: Readonly<{ items: FiveWhy[] }>) {
  return (
    <div className="divide-y divide-[#1e1e2a]">
      {items.map((item, i) => (
        <div key={i} className="py-4 first:pt-0 last:pb-0">
          <p className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-1">
            {i + 1}. Why
          </p>
          <p className="text-sm text-zinc-400 mb-2">{item.question}</p>
          <p className="text-sm text-zinc-100 leading-relaxed">{item.answer}</p>
        </div>
      ))}
    </div>
  )
}
