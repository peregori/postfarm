import { create } from 'zustand'

const useUIStore = create((set) => ({
  // State
  currentModal: null,
  flags: {},

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
}))

export default useUIStore

