import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import { Toaster } from './components/ui/toaster'
import { HealthProvider } from './contexts/HealthContext'
import { HotkeysProvider } from './contexts/HotkeysContext'
import ErrorBoundary from './components/ErrorBoundary'
import useUIStore from './stores/uiStore'

function App() {
  const initializeTheme = useUIStore((state) => state.initializeTheme)

  // Initialize theme on app mount
  useEffect(() => {
    initializeTheme()
  }, [initializeTheme])

  return (
    <ErrorBoundary>
      <HotkeysProvider>
        <HealthProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Inbox />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/schedule" element={<ErrorBoundary><Schedule /></ErrorBoundary>} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
              <Toaster />
            </Layout>
          </Router>
        </HealthProvider>
      </HotkeysProvider>
    </ErrorBoundary>
  )
}

export default App

