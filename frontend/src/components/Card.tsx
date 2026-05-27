interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: Readonly<CardProps>) {
  return (
    <div className={`bg-[#111116] border border-[#1e1e2a] rounded-lg ${className}`}>
      {children}
    </div>
  )
}
