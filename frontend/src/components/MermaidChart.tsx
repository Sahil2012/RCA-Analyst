import { useEffect, useId, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true })

export function MermaidChart({ diagram }: Readonly<{ diagram: string }>) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    setError(false)
    setReady(false)
    mermaid.render(`mermaid-${id}`, diagram)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg
          setReady(true)
        }
      })
      .catch(() => setError(true))
  }, [diagram, id])

  if (error) return (
    <div className="text-xs text-zinc-600 font-mono p-3 bg-[#111116] rounded border border-[#1e1e2a]">
      Failed to render diagram
    </div>
  )

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-300 overflow-x-auto ${ready ? 'opacity-100' : 'opacity-0'}`}
    />
  )
}
