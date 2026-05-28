import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Dashboard } from './features/dashboard/Dashboard'
import { IncidentDetail } from './features/incidents/IncidentDetail'

function Nav() {
  return (
    <header className="bg-[#07091f] border-b border-(--border) px-4 sm:px-8 h-14 flex items-center justify-between shrink-0">
      <a href="/" className="flex flex-col leading-none">
        <span className="text-[13px] font-bold tracking-[0.15em] uppercase text-[#dde4f0]">
          RCA Analyst
        </span>
        <span className="text-[9px] tracking-[0.2em] uppercase text-(--accent) font-mono mt-0.5">
          Incident Intelligence
        </span>
      </a>
      <span className="text-xs font-mono hidden sm:block ai-shimmer">AI-powered root cause analysis</span>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
