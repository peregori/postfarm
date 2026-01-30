/**
 * Sync Service for PostFarm
 *
 * Handles bi-directional synchronization between localStorage and Supabase.
 * Uses a queue-based approach for offline-first support.
 */

const SYNC_QUEUE_KEY = 'postfarm-sync-queue'
const LAST_SYNC_KEY = 'postfarm-last-sync'

/**
 * Debounce utility function
 */
function debounce(fn, ms) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), ms)
  }
}

class SyncService {
  constructor(apiClient) {
    this.apiClient = apiClient
    this.isSyncing = false
    this.listeners = new Set()
    this.enabled = false // Will be set when sync is confirmed available

    // Bind the debounced trigger
    this._debouncedSync = debounce(() => this._executeSync(), 1000)
  }

  /**
   * Enable sync service (call after confirming backend supports it)
   */
  enable() {
    this.enabled = true
  }

  /**
   * Disable sync service
   */
  disable() {
    this.enabled = false
  }

  /**
   * Subscribe to sync events
   * @param {Function} callback - Called with sync events
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of an event
   */
  notify(event) {
    this.listeners.forEach(cb => {
      try {
        cb(event)
      } catch (e) {
        console.error('Sync listener error:', e)
      }
    })
  }

  /**
   * Queue a change for sync
   * @param {string} entityType - 'draft' or 'scheduled_post'
   * @param {string} entityId - UUID of the entity
   * @param {string} action - 'create', 'update', or 'delete'
   * @param {Object} data - Entity data (for create/update)
   */
  queueChange(entityType, entityId, action, data) {
    if (!this.enabled) return

    const queue = this.getQueue()

    // Remove existing entry for same entity to avoid duplicates
    // Keep the latest action (delete trumps update, etc.)
    const filteredQueue = queue.filter(
      item => !(item.entity_id === entityId && item.entity_type === entityType)
    )

    // Don't queue if we're deleting something that was only created locally
    const wasCreatedLocally = queue.some(
      item => item.entity_id === entityId && item.action === 'create'
    )

    if (action === 'delete' && wasCreatedLocally) {
      // Just remove from queue, no need to sync deletion
      this.saveQueue(filteredQueue)
      return
    }

    filteredQueue.push({
      entity_type: entityType,
      entity_id: entityId,
      action,
      data,
      client_updated_at: new Date().toISOString(),
      queued_at: new Date().toISOString()
    })

    this.saveQueue(filteredQueue)
    this.triggerSync()
  }

  /**
   * Get the current sync queue
   */
  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]')
    } catch {
      return []
    }
  }

  /**
   * Save the sync queue
   */
  saveQueue(queue) {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  }

  /**
   * Clear the sync queue
   */
  clearQueue() {
    localStorage.removeItem(SYNC_QUEUE_KEY)
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime() {
    return localStorage.getItem(LAST_SYNC_KEY)
  }

  /**
   * Set last sync timestamp
   */
  setLastSyncTime(timestamp) {
    localStorage.setItem(LAST_SYNC_KEY, timestamp)
  }

  /**
   * Trigger a sync (debounced)
   */
  triggerSync() {
    if (!this.enabled) return
    this._debouncedSync()
  }

  /**
   * Execute the sync operation
   */
  async _executeSync() {
    if (this.isSyncing || !navigator.onLine || !this.enabled) return

    this.isSyncing = true
    this.notify({ type: 'sync-start' })

    try {
      // 1. Push local changes first
      const pushResult = await this.pushChanges()

      // 2. Pull remote changes
      const pullResult = await this.pullChanges()

      this.notify({
        type: 'sync-complete',
        pushed: pushResult,
        pulled: pullResult
      })
    } catch (error) {
      console.error('Sync failed:', error)
      this.notify({ type: 'sync-error', error })
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Push local changes to server
   */
  async pushChanges() {
    const queue = this.getQueue()
    if (queue.length === 0) {
      return { success: 0, conflicts: 0, errors: 0 }
    }

    try {
      const response = await this.apiClient.post('/api/sync/push', {
        changes: queue
      })

      const { results, success_count, conflict_count, error_count } = response.data

      // Remove successful items from queue
      const successIds = new Set(
        results
          .filter(r => r.status === 'success')
          .map(r => r.entity_id)
      )

      const remainingQueue = queue.filter(
        item => !successIds.has(item.entity_id)
      )

      this.saveQueue(remainingQueue)

      // Handle conflicts
      const conflicts = results.filter(r => r.status === 'conflict')
      if (conflicts.length > 0) {
        this.notify({
          type: 'sync-conflicts',
          conflicts: conflicts.map(c => ({
            entityId: c.entity_id,
            serverData: c.server_data,
            message: c.message
          }))
        })
      }

      // Handle errors
      const errors = results.filter(r => r.status === 'error')
      if (errors.length > 0) {
        console.warn('Sync push errors:', errors)
      }

      return {
        success: success_count,
        conflicts: conflict_count,
        errors: error_count
      }
    } catch (error) {
      console.error('Push changes failed:', error)
      throw error
    }
  }

  /**
   * Pull remote changes from server
   */
  async pullChanges() {
    const lastSync = this.getLastSyncTime()

    try {
      const response = await this.apiClient.post('/api/sync/pull', {
        last_sync_at: lastSync
      })

      const { drafts, scheduled_posts, deleted_ids, sync_timestamp } = response.data

      // Notify store to merge changes
      this.notify({
        type: 'sync-pull',
        drafts,
        scheduledPosts: scheduled_posts,
        deletedIds: deleted_ids
      })

      this.setLastSyncTime(sync_timestamp)

      return {
        drafts: drafts.length,
        scheduledPosts: scheduled_posts.length,
        deletions: deleted_ids.length
      }
    } catch (error) {
      console.error('Pull changes failed:', error)
      throw error
    }
  }

  /**
   * Force a full sync (clear last sync time and sync everything)
   */
  async fullSync() {
    localStorage.removeItem(LAST_SYNC_KEY)
    await this._executeSync()
  }

  /**
   * Check sync status from server
   */
  async checkStatus() {
    try {
      const response = await this.apiClient.get('/api/sync/status')
      return response.data
    } catch (error) {
      console.error('Check sync status failed:', error)
      return { enabled: false, error: error.message }
    }
  }

  /**
   * Get pending changes count
   */
  getPendingCount() {
    return this.getQueue().length
  }
}

// Export a factory function
export function createSyncService(apiClient) {
  return new SyncService(apiClient)
}

export default SyncService
