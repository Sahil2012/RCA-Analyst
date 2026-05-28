import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: Readonly<Props>) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  function pages(): Array<number | '…'> {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4)       return [1, 2, 3, 4, 5, '…', totalPages]
    if (page >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '…', page - 1, page, page + 1, '…', totalPages]
  }

  const btnBase = 'h-8 min-w-8 px-2 flex items-center justify-center text-xs font-mono transition-colors rounded-sm border'

  return (
    <div className="flex items-center justify-between pt-4 mt-1 border-t border-(--border)">
      <span className="text-[11px] font-mono text-[#3d4f6a] tabular-nums">
        {start}–{end} <span className="text-[#1e2d45]">/</span> {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className={`${btnBase} border-(--border) text-[#6b7a94] hover:text-[#dde4f0] hover:border-[#2a3d5a] disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <ChevronLeft size={13} />
        </button>

        {pages().map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="h-8 w-6 flex items-center justify-center text-xs font-mono text-[#3d4f6a]">…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p as number)}
                className={`${btnBase} tabular-nums ${
                  p === page
                    ? 'bg-[var(--accent-bg)] border-[var(--accent-border)] text-(--accent)'
                    : 'border-(--border) text-[#6b7a94] hover:text-[#dde4f0] hover:border-[#2a3d5a]'
                }`}
              >
                {p}
              </button>
            )
        )}

        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className={`${btnBase} border-(--border) text-[#6b7a94] hover:text-[#dde4f0] hover:border-[#2a3d5a] disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
