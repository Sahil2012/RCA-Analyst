import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Dashboard } from './features/dashboard/Dashboard'
import { IncidentDetail } from './features/incidents/IncidentDetail'

function Nav() {
  return (
    <header className="border-b border-[#1e1e2a] px-4 sm:px-6 h-14 flex items-center justify-between">
      <a href="/" className="flex items-center gap-2.5 group">
        <div className="size-6 rounded bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <div className="size-2 rounded-sm bg-violet-400" />
        </div>
        <span className="text-[15px] font-semibold text-zinc-100 tracking-tight">
          RCA <span className="text-violet-400 font-normal">Analyst</span>
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
