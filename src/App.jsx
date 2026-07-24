import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Capture from './pages/Capture'
import Tournaments from './pages/Tournaments'
import Matches from './pages/Matches'
import ApiDestinations from './pages/ApiDestinations'
import Violations from './pages/Violations'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="capture" element={<Capture />} />
        <Route path="tournaments" element={<Tournaments />} />
        <Route path="matches" element={<Matches />} />
        <Route path="api-destinations" element={<ApiDestinations />} />
        <Route path="violations" element={<Violations />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
