import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

const useDraftStore = create(
  persist(
    (set, get) => ({
      // State
      drafts: [],
      selectedDraftId: null,

      // Actions
      createDraft: (initialContent = '') => {
        const newDraft = {
          id: uuidv4(),
          content: initialContent,
          title: null,
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          confirmed: false,
          scheduledAt: null,
        }
        
        set((state) => ({
          drafts: [newDraft, ...state.drafts],
          selectedDraftId: newDraft.id,
        }))
        
        return newDraft
      },

      updateDraft: (id, updates) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  ...updates,
                  updated_at: new Date().toISOString(),
                }
              : draft
          ),
        }))
        
        // Return the updated draft
        const updatedDraft = get().drafts.find((d) => d.id === id)
        return updatedDraft
      },

      deleteDraft: (id) => {
        set((state) => {
          const newDrafts = state.drafts.filter((draft) => draft.id !== id)
          const newSelectedId =
            state.selectedDraftId === id ? null : state.selectedDraftId
          
          return {
            drafts: newDrafts,
            selectedDraftId: newSelectedId,
          }
        })
      },

      confirmDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.map((draft) => {
            if (draft.id === id) {
              const tags = draft.tags || []
              const hasConfirmedTag = tags.includes('confirmed')
              const updatedTags = hasConfirmedTag
                ? tags
                : [...tags, 'confirmed']
              
              return {
                ...draft,
                confirmed: true,
                tags: updatedTags,
                updated_at: new Date().toISOString(),
              }
            }
            return draft
          }),
        }))
      },

      scheduleDraft: (id, timestamp) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  scheduledAt: timestamp,
                  updated_at: new Date().toISOString(),
                }
              : draft
          ),
        }))
      },

      unscheduleDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  scheduledAt: null,
                  updated_at: new Date().toISOString(),
                }
              : draft
          ),
        }))
      },

      selectDraft: (id) => {
        set({ selectedDraftId: id })
      },

      // Helper to get selected draft
      getSelectedDraft: () => {
        const state = get()
        return state.drafts.find((d) => d.id === state.selectedDraftId) || null
      },
    }),
    {
      name: 'draft-storage', // localStorage key
      partialize: (state) => ({
        drafts: state.drafts,
        // Don't persist selectedDraftId - it's session-specific
      }),
    }
  )
)

export default useDraftStore

