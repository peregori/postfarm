import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

const useDraftStore = create(
  persist(
    (set, get) => ({
      // State
      drafts: [],
      selectedDraftId: null,

      // Sync-related state
      syncStatus: "idle", // 'idle', 'syncing', 'error'
      lastSyncAt: null,
      _syncService: null, // Internal reference to sync service

      // Set sync service (called from SyncContext)
      setSyncService: (syncService) => {
        set({ _syncService: syncService });
      },

      // Actions with sync integration
      createDraft: (initialContent = "") => {
        const newDraft = {
          id: uuidv4(),
          content: initialContent,
          title: null,
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          confirmed: false,
          scheduledAt: null,
        };

        set((state) => ({
          drafts: [newDraft, ...state.drafts],
          selectedDraftId: newDraft.id,
        }));

        // Queue for sync
        const syncService = get()._syncService;
        if (syncService) {
          syncService.queueChange("draft", newDraft.id, "create", newDraft);
        }

        return newDraft;
      },

      updateDraft: (id, updates) => {
        const updatedAt = new Date().toISOString();

        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? {
                  ...draft,
                  ...updates,
                  updated_at: updatedAt,
                }
              : draft,
          ),
        }));

        // Queue for sync
        const syncService = get()._syncService;
        const draft = get().drafts.find((d) => d.id === id);
        if (syncService && draft) {
          syncService.queueChange("draft", id, "update", draft);
        }

        return draft;
      },

      deleteDraft: (id) => {
        // Queue for sync BEFORE removing from state
        const syncService = get()._syncService;
        if (syncService) {
          syncService.queueChange("draft", id, "delete", null);
        }

        set((state) => {
          const newDrafts = state.drafts.filter((draft) => draft.id !== id);
          const newSelectedId =
            state.selectedDraftId === id ? null : state.selectedDraftId;

          return {
            drafts: newDrafts,
            selectedDraftId: newSelectedId,
          };
        });
      },

      confirmDraft: (id) => {
        set((state) => ({
          drafts: state.drafts.map((draft) => {
            if (draft.id === id) {
              const tags = draft.tags || [];
              const hasConfirmedTag = tags.includes("confirmed");
              const updatedTags = hasConfirmedTag
                ? tags
                : [...tags, "confirmed"];

              return {
                ...draft,
                confirmed: true,
                tags: updatedTags,
                updated_at: new Date().toISOString(),
              };
            }
            return draft;
          }),
        }));

        // Queue for sync
        const syncService = get()._syncService;
        const draft = get().drafts.find((d) => d.id === id);
        if (syncService && draft) {
          syncService.queueChange("draft", id, "update", draft);
        }
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
              : draft,
          ),
        }));

        // Queue for sync
        const syncService = get()._syncService;
        const draft = get().drafts.find((d) => d.id === id);
        if (syncService && draft) {
          syncService.queueChange("draft", id, "update", draft);
        }
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
              : draft,
          ),
        }));

        // Queue for sync
        const syncService = get()._syncService;
        const draft = get().drafts.find((d) => d.id === id);
        if (syncService && draft) {
          syncService.queueChange("draft", id, "update", draft);
        }
      },

      selectDraft: (id) => {
        set({ selectedDraftId: id });
      },

      // Helper to get selected draft
      getSelectedDraft: () => {
        const state = get();
        return state.drafts.find((d) => d.id === state.selectedDraftId) || null;
      },

      // Sync-related actions

      /**
       * Merge pulled data from server into local state
       * Uses last-write-wins based on updated_at timestamp
       */
      mergePulledData: (serverDrafts, deletedIds = []) => {
        set((state) => {
          const localDraftsMap = new Map(state.drafts.map((d) => [d.id, d]));

          // Apply server updates
          for (const serverDraft of serverDrafts) {
            const local = localDraftsMap.get(serverDraft.id);

            // If no local version or server is newer, use server version
            if (
              !local ||
              new Date(serverDraft.updated_at) > new Date(local.updated_at)
            ) {
              // Convert server format to local format
              localDraftsMap.set(serverDraft.id, {
                id: serverDraft.id,
                content: serverDraft.content || "",
                title: serverDraft.title || null,
                tags: serverDraft.tags || [],
                created_at: serverDraft.created_at,
                updated_at: serverDraft.updated_at,
                confirmed: serverDraft.confirmed || false,
                scheduledAt: serverDraft.scheduled_at || null,
              });
            }
          }

          // Remove deleted entities
          for (const deletedId of deletedIds) {
            localDraftsMap.delete(deletedId);
          }

          // Convert back to array, sorted by created_at (newest first)
          const mergedDrafts = Array.from(localDraftsMap.values()).sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );

          // Update selected draft if it was deleted
          let newSelectedId = state.selectedDraftId;
          if (deletedIds.includes(state.selectedDraftId)) {
            newSelectedId = null;
          }

          return {
            drafts: mergedDrafts,
            selectedDraftId: newSelectedId,
            lastSyncAt: new Date().toISOString(),
          };
        });
      },

      /**
       * Set sync status
       */
      setSyncStatus: (status) => {
        set({ syncStatus: status });
      },

      /**
       * Replace all drafts (used for full sync or reset)
       */
      setDrafts: (drafts) => {
        set({
          drafts: drafts.map((d) => ({
            id: d.id,
            content: d.content || "",
            title: d.title || null,
            tags: d.tags || [],
            created_at: d.created_at,
            updated_at: d.updated_at,
            confirmed: d.confirmed || false,
            scheduledAt: d.scheduled_at || null,
          })),
          lastSyncAt: new Date().toISOString(),
        });
      },

      /**
       * Get draft by ID
       */
      getDraftById: (id) => {
        return get().drafts.find((d) => d.id === id) || null;
      },
    }),
    {
      name: "draft-storage", // localStorage key
      partialize: (state) => ({
        drafts: state.drafts,
        lastSyncAt: state.lastSyncAt,
        // Don't persist: selectedDraftId, syncStatus, _syncService
      }),
    },
  ),
);

export default useDraftStore;
