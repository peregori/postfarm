import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut } from '@clerk/clerk-react'
import Layout from './components/Layout'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import SignInPage from './pages/SignIn'
import SignUpPage from './pages/SignUp'
import ProfilePage from './pages/Profile'
import { Toaster } from './components/ui/toaster'
import { HealthProvider } from './contexts/HealthContext'
import { HotkeysProvider } from './contexts/HotkeysContext'
import { AuthProvider } from './contexts/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import useUIStore from './stores/uiStore'

// Protected route wrapper - redirects to sign-in if not authenticated
function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

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
          <AuthProvider>
            <Router>
              <Routes>
              {/* Public auth routes - no Layout wrapper */}
              <Route path="/sign-in/*" element={<SignInPage />} />
              <Route path="/sign-up/*" element={<SignUpPage />} />
              
              {/* Protected routes - wrapped in Layout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout><Inbox /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/inbox" element={
                <ProtectedRoute>
                  <Layout><Inbox /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/schedule" element={
                <ProtectedRoute>
                  <Layout><ErrorBoundary><Schedule /></ErrorBoundary></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/profile/*" element={
                <ProtectedRoute>
                  <Layout><ProfilePage /></Layout>
                </ProtectedRoute>
              } />
              </Routes>
              <Toaster />
            </Router>
          </AuthProvider>
        </HealthProvider>
      </HotkeysProvider>
    </ErrorBoundary>
  )
}

export default App

