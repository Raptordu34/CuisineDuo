import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext'
import { MiamProvider } from './contexts/MiamContext'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import InventoryPage from './pages/InventoryPage'
import AILogsPage from './pages/AILogsPage'

// Redirige vers /reset-password quand Supabase detecte un lien de recuperation
function AuthNavigationHandler() {
  const { passwordRecovery } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (passwordRecovery) {
      navigate('/reset-password', { replace: true })
    }
  }, [passwordRecovery, navigate])

  return null
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <AuthProvider>
      <UnreadMessagesProvider>
      <MiamProvider>
        <AuthNavigationHandler />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <HomePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Layout>
                  <InventoryPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <Layout>
                  <ChatPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-logs"
            element={
              <ProtectedRoute>
                <AILogsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MiamProvider>
      </UnreadMessagesProvider>
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}

export default App
