/**
 * Sync Context Provider
 *
 * Manages synchronization state and provides sync service to the app.
 * Handles online/offline detection and automatic sync triggers.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createSyncService } from '../services/syncService'
import client, { syncApi } from '../api/client'
import useDraftStore from '../stores/draftStore'

const SyncContext = createContext(null)

export function SyncProvider({ children }) {
  const { isSignedIn, userId } = useAuth()
  const [syncService, setSyncService] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncStatus, setSyncStatus] = useState('idle') // 'idle', 'syncing', 'error'
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncAt, setLastSyncAt] = useState(null)

  // Get store actions
  const mergePulledData = useDraftStore(state => state.mergePulledData)
  const setSyncServiceInStore = useDraftStore(state => state.setSyncService)

  // Track online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Trigger sync when coming back online
      if (syncService && syncEnabled) {
        syncService.triggerSync()
      }
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncService, syncEnabled])

  // Initialize sync service when signed in
  useEffect(() => {
    if (isSignedIn && !syncService) {
      const service = createSyncService(client)

      // Subscribe to sync events
      service.subscribe((event) => {
        switch (event.type) {
          case 'sync-start':
            setSyncStatus('syncing')
            break
          case 'sync-complete':
            setSyncStatus('idle')
            setLastSyncAt(new Date().toISOString())
            setPendingCount(service.getPendingCount())
            break
          case 'sync-error':
            setSyncStatus('error')
            console.error('Sync error:', event.error)
            break
          case 'sync-pull':
            // Merge pulled data into store
            if (mergePulledData && event.drafts) {
              mergePulledData(event.drafts, event.deletedIds || [])
            }
            break
          case 'sync-conflicts':
            // Handle conflicts - for now just log
            console.warn('Sync conflicts:', event.conflicts)
            // Could show a toast or modal here
            break
        }
      })

      setSyncService(service)

      // Also set in the draft store for direct access
      if (setSyncServiceInStore) {
        setSyncServiceInStore(service)
      }
    }

    return () => {
      // Cleanup if needed
    }
  }, [isSignedIn, syncService, mergePulledData, setSyncServiceInStore])

  // Check if sync is enabled on the backend
  useEffect(() => {
    async function checkSyncStatus() {
      if (!isSignedIn || !syncService) return

      try {
        const status = await syncApi.status()
        if (status.enabled) {
          setSyncEnabled(true)
          syncService.enable()

          // Do initial sync
          syncService.fullSync()
        } else {
          setSyncEnabled(false)
          syncService.disable()
        }
      } catch (error) {
        // Sync endpoint might not exist (old backend)
        console.log('Sync not available:', error.message)
        setSyncEnabled(false)
      }
    }

    checkSyncStatus()
  }, [isSignedIn, syncService])

  // Sync on visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        syncService &&
        syncEnabled &&
        isOnline
      ) {
        syncService.triggerSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [syncService, syncEnabled, isOnline])

  // Update pending count periodically
  useEffect(() => {
    if (!syncService) return

    const interval = setInterval(() => {
      setPendingCount(syncService.getPendingCount())
    }, 5000)

    return () => clearInterval(interval)
  }, [syncService])

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (syncService && syncEnabled && isOnline) {
      syncService.triggerSync()
    }
  }, [syncService, syncEnabled, isOnline])

  // Full sync (clear cache and sync everything)
  const fullSync = useCallback(async () => {
    if (syncService && syncEnabled && isOnline) {
      await syncService.fullSync()
    }
  }, [syncService, syncEnabled, isOnline])

  const value = {
    syncService,
    isOnline,
    syncStatus,
    syncEnabled,
    pendingCount,
    lastSyncAt,
    triggerSync,
    fullSync,
  }

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    // Return a default object if used outside provider
    return {
      syncService: null,
      isOnline: navigator.onLine,
      syncStatus: 'idle',
      syncEnabled: false,
      pendingCount: 0,
      lastSyncAt: null,
      triggerSync: () => {},
      fullSync: () => {},
    }
  }
  return context
}

export default SyncContext
