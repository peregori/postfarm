import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Drafts from './pages/Drafts'
import Generate from './pages/Generate'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import ServerControl from './pages/ServerControl'
import Inbox from './pages/Inbox'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/server" element={<ServerControl />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

