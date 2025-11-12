import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { llmApi, providersApi } from '../api/client'

const HealthContext = createContext(null)

export function HealthProvider({ children }) {
  const [healthStatus, setHealthStatus] = useState({
    isHealthy: false,
    provider: null,
    displayName: null,
    loading: true,
  })
  
  const [currentProvider, setCurrentProvider] = useState(null)
  const intervalRef = useRef(null)
  const backoffRef = useRef(5000) // Start with 5 seconds
  const consecutiveFailuresRef = useRef(0)
  const isVisibleRef = useRef(true)

  const checkHealth = async () => {
    try {
      const [health, provider] = await Promise.all([
        llmApi.health(),
        providersApi.getCurrent().catch(() => null)
      ])
      
      setHealthStatus({
        isHealthy: true,
        provider: health.provider,
        displayName: health.display_name || provider?.display_name || 'AI',
        loading: false,
      })
      setCurrentProvider(provider)
      
      // Reset backoff on success
      if (backoffRef.current > 5000) {
        backoffRef.current = 5000
        // Restart polling with new interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        if (isVisibleRef.current) {
          intervalRef.current = setInterval(() => {
            if (isVisibleRef.current) {
              checkHealth()
            }
          }, backoffRef.current)
        }
      }
      consecutiveFailuresRef.current = 0
    } catch (error) {
      setHealthStatus(prev => ({
        ...prev,
        isHealthy: false,
        loading: false,
      }))
      
      // Exponential backoff: increase interval when server is down
      consecutiveFailuresRef.current += 1
      if (consecutiveFailuresRef.current > 1) {
        const newBackoff = Math.min(backoffRef.current * 1.5, 30000) // Max 30 seconds
        if (newBackoff !== backoffRef.current) {
          backoffRef.current = newBackoff
          // Restart polling with new interval
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
          }
          if (isVisibleRef.current) {
            intervalRef.current = setInterval(() => {
              if (isVisibleRef.current) {
                checkHealth()
              }
            }, backoffRef.current)
          }
        }
      }
    }
  }

  useEffect(() => {
    // Initial check
    checkHealth()

    // Handle page visibility
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      if (document.hidden) {
        // Stop polling when page is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else {
        // Resume polling when page becomes visible
        if (!intervalRef.current) {
          checkHealth()
          intervalRef.current = setInterval(() => {
            if (isVisibleRef.current) {
              checkHealth()
            }
          }, backoffRef.current)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Start polling
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        checkHealth()
      }
    }, backoffRef.current)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const refreshHealth = () => {
    checkHealth()
  }

  return (
    <HealthContext.Provider value={{ healthStatus, currentProvider, refreshHealth }}>
      {children}
    </HealthContext.Provider>
  )
}

export function useHealth() {
  const context = useContext(HealthContext)
  if (!context) {
    throw new Error('useHealth must be used within HealthProvider')
  }
  return context
}

