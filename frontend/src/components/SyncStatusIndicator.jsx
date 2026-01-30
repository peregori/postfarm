/**
 * Sync Status Indicator
 *
 * Shows the current sync status with appropriate icons and tooltips.
 */

import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react'
import { useSync } from '../contexts/SyncContext'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function SyncStatusIndicator({ className, showLabel = false }) {
  const {
    isOnline,
    syncStatus,
    syncEnabled,
    pendingCount,
    triggerSync
  } = useSync()

  // Don't show anything if sync is not enabled
  if (!syncEnabled) {
    return null
  }

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: CloudOff,
        label: 'Offline',
        description: 'Changes will sync when you reconnect',
        color: 'text-yellow-500',
        animate: false
      }
    }

    if (syncStatus === 'syncing') {
      return {
        icon: RefreshCw,
        label: 'Syncing',
        description: 'Syncing your data...',
        color: 'text-blue-500',
        animate: true
      }
    }

    if (syncStatus === 'error') {
      return {
        icon: AlertCircle,
        label: 'Sync Error',
        description: 'Failed to sync. Click to retry.',
        color: 'text-red-500',
        animate: false
      }
    }

    if (pendingCount > 0) {
      return {
        icon: Cloud,
        label: `${pendingCount} pending`,
        description: `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync`,
        color: 'text-yellow-500',
        animate: false
      }
    }

    return {
      icon: Check,
      label: 'Synced',
      description: 'All changes saved to cloud',
      color: 'text-green-500',
      animate: false
    }
  }

  const { icon: Icon, label, description, color, animate } = getStatusInfo()

  const handleClick = () => {
    if (syncStatus === 'error' || pendingCount > 0) {
      triggerSync()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              'flex items-center gap-2 p-1.5 rounded-md transition-colors',
              'hover:bg-sidebar-accent/50',
              (syncStatus === 'error' || pendingCount > 0) && 'cursor-pointer',
              className
            )}
            disabled={syncStatus === 'syncing'}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                color,
                animate && 'animate-spin'
              )}
            />
            {showLabel && (
              <span className={cn('text-xs', color)}>
                {label}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
