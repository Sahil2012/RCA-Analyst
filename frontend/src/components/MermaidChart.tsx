import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    background:          'transparent',
    mainBkg:             '#18182a',
    nodeBorder:          '#3b3b5c',
    clusterBkg:          '#1a1a2e',
    titleColor:          '#94a3b8',
    lineColor:           '#6366f1',
    primaryColor:        '#1e1b4b',
    primaryTextColor:    '#c7d2fe',
    primaryBorderColor:  '#4338ca',
    secondaryColor:      '#1e1e2e',
    tertiaryColor:       '#111116',
    edgeLabelBackground: 'transparent',
    fontFamily:          'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize:            '13px',
  },
})

let _seq = 0

// Mermaid 11 chokes on parens/tildes inside [...] node labels
function sanitize(diagram: string): string {
  return diagram.replace(/\[([^\]]+)\]/g, (_, text) =>
    '[' + text.replace(/[()~]/g, '').replace(/\s+/g, ' ').trim() + ']'
  )
}

export function MermaidChart({ diagram }: Readonly<{ diagram: string }>) {
  const [error, setError] = useState(false)
  const [svg, setSvg]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${++_seq}`
    setError(false)
    setSvg(null)

    mermaid.render(id, sanitize(diagram))
      .then(({ svg: rendered }) => { if (!cancelled) setSvg(rendered) })
      .catch(()                 => { if (!cancelled) setError(true)   })

    return () => {
      cancelled = true
      document.getElementById(`d${id}`)?.remove()
    }
  }, [diagram])

  if (error) return (
    <div className="text-xs text-zinc-600 font-mono p-3 bg-[#111116] rounded border border-[#1e1e2a]">
      Failed to render diagram
    </div>
  )

  if (!svg) return null

  return (
    <div
      className="flex justify-center overflow-x-auto py-4 [&_svg]:max-w-full [&_svg]:h-auto"
      // SVG is from Mermaid's own renderer, not raw user input
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
