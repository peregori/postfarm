/**
 * Migration Service for PostFarm
 *
 * Handles migration of existing localStorage data to Supabase
 * when a user first signs in with sync enabled.
 */

const MIGRATION_KEY_PREFIX = 'postfarm-migration-v1-complete'

/**
 * Check if migration has already been completed for a user
 */
export function isMigrationComplete(userId) {
  const key = `${MIGRATION_KEY_PREFIX}-${userId}`
  return localStorage.getItem(key) !== null
}

/**
 * Mark migration as complete for a user
 */
export function markMigrationComplete(userId) {
  const key = `${MIGRATION_KEY_PREFIX}-${userId}`
  localStorage.setItem(key, new Date().toISOString())
}

/**
 * Get existing drafts from localStorage
 */
function getLocalStorageDrafts() {
  try {
    const draftStorage = localStorage.getItem('draft-storage')
    if (!draftStorage) return []

    const { state } = JSON.parse(draftStorage)
    return state?.drafts || []
  } catch (error) {
    console.error('Failed to read localStorage drafts:', error)
    return []
  }
}

/**
 * Migrate localStorage drafts to Supabase
 *
 * @param {Object} syncService - The sync service instance
 * @param {string} userId - The Clerk user ID
 * @returns {Object} Migration result
 */
export async function migrateLocalStorageToSupabase(syncService, userId) {
  // Check if already migrated
  if (isMigrationComplete(userId)) {
    return {
      migrated: false,
      reason: 'already-complete',
      count: 0
    }
  }

  // Get existing localStorage data
  const drafts = getLocalStorageDrafts()

  if (drafts.length === 0) {
    markMigrationComplete(userId)
    return {
      migrated: false,
      reason: 'no-data',
      count: 0
    }
  }

  try {
    // Queue all drafts for sync as 'create' operations
    for (const draft of drafts) {
      // Convert local draft format to server format
      const serverDraft = {
        id: draft.id,
        content: draft.content || '',
        title: draft.title || null,
        tags: draft.tags || [],
        confirmed: draft.confirmed || false,
        scheduled_at: draft.scheduledAt || null,
        created_at: draft.created_at,
        updated_at: draft.updated_at,
      }

      syncService.queueChange('draft', draft.id, 'create', serverDraft)
    }

    // Push changes to server
    const result = await syncService.pushChanges()

    // Mark migration complete regardless of individual failures
    // (conflicts just mean the data already exists on server)
    markMigrationComplete(userId)

    return {
      migrated: true,
      count: drafts.length,
      result: {
        success: result.success,
        conflicts: result.conflicts,
        errors: result.errors
      }
    }
  } catch (error) {
    console.error('Migration failed:', error)
    return {
      migrated: false,
      reason: 'error',
      error: error.message,
      count: 0
    }
  }
}

/**
 * Reset migration status (for testing/debugging)
 */
export function resetMigration(userId) {
  const key = `${MIGRATION_KEY_PREFIX}-${userId}`
  localStorage.removeItem(key)
}

/**
 * Get migration status
 */
export function getMigrationStatus(userId) {
  const key = `${MIGRATION_KEY_PREFIX}-${userId}`
  const timestamp = localStorage.getItem(key)

  return {
    complete: timestamp !== null,
    completedAt: timestamp,
    localDraftCount: getLocalStorageDrafts().length
  }
}

export default {
  isMigrationComplete,
  markMigrationComplete,
  migrateLocalStorageToSupabase,
  resetMigration,
  getMigrationStatus,
}
