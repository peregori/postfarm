import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import { Toaster } from './components/ui/toaster'
import { HealthProvider } from './contexts/HealthContext'

function App() {
  return (
    <HealthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Inbox />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          <Toaster />
        </Layout>
      </Router>
    </HealthProvider>
  )
}

export default App

