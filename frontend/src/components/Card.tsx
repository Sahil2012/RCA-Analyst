interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: Readonly<CardProps>) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-sm ${className}`}>
      {children}
    </div>
  )
}
