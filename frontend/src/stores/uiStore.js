import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Helper to get initial theme
const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  
  // Check localStorage first
  const stored = localStorage.getItem('ui-storage')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed.state?.theme) {
        return parsed.state.theme
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  
  return 'light'
}

// Apply theme to document
const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const useUIStore = create(
  persist(
    (set, get) => ({
      // State
      currentModal: null,
      flags: {},
      theme: getInitialTheme(),

      // Actions
      openModal: (modalName) => {
        set({ currentModal: modalName })
      },

      closeModal: () => {
        set({ currentModal: null })
      },

      setFlag: (key, value) => {
        set((state) => ({
          flags: {
            ...state.flags,
            [key]: value,
          },
        }))
      },

      // Helper to clear a flag
      clearFlag: (key) => {
        set((state) => {
          const newFlags = { ...state.flags }
          delete newFlags[key]
          return { flags: newFlags }
        })
      },

      // Helper to clear all flags
      clearAllFlags: () => {
        set({ flags: {} })
      },

      // Theme actions
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      toggleTheme: () => {
        const currentTheme = get().theme
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
        applyTheme(newTheme)
        set({ theme: newTheme })
      },

      // Initialize theme on app load
      initializeTheme: () => {
        const theme = get().theme
        applyTheme(theme)
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        // Don't persist modal state or flags
      }),
    }
  )
)

export default useUIStore

