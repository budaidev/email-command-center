import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { NavRail } from './components/Shell/NavRail'
import { TodayView } from './components/Today/TodayView'
import { InboxView } from './components/Inbox/InboxView'
import { ArchiveView } from './components/Archive/ArchiveView'
import { ReadingView } from './components/Reading/ReadingView'
import { RulesPage } from './components/Rules/RulesPage'
import { TasksView } from './components/Tasks/TasksView'
import { PulseView } from './components/Pulse/PulseView'
import { TriageWorkbench } from './components/Triage/TriageWorkbench'

function AppShell() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'grid',
        gridTemplateColumns: '72px 1fr',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <NavRail />
      <main style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<TodayView />} />
          <Route
            path="/inbox"
            element={<InboxView onOpenEmail={(id) => navigate(`/email/${id}`)} />}
          />
          <Route path="/archive" element={<ArchiveView />} />
          <Route path="/tasks" element={<TasksView />} />
          <Route path="/pulse" element={<PulseView />} />
          <Route path="/triage" element={<TriageWorkbench />} />
          <Route
            path="/email/:id"
            element={<ReadingView />}
          />
          <Route
            path="/settings"
            element={
              <RulesPage
                onClose={() => navigate('/')}
                onSelectEmail={async (id) => navigate(`/email/${id}`)}
              />
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
