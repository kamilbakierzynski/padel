import { HashRouter, Route, Routes } from 'react-router-dom'

import { Shell } from '../components/Shell'
import { TournamentStoreProvider } from '../state/TournamentStore'
import { CreateTournamentPage } from '../pages/CreateTournamentPage'
import { DashboardPage } from '../pages/DashboardPage'
import { TournamentPage } from '../pages/TournamentPage'

export function App() {
  return (
    <TournamentStoreProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/new" element={<CreateTournamentPage />} />
            <Route path="/tournament/:tournamentId" element={<TournamentPage />} />
          </Routes>
        </Shell>
      </HashRouter>
    </TournamentStoreProvider>
  )
}
