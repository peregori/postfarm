import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { serverApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { showToast } from '@/lib/toast'
import { useHealth } from '../contexts/HealthContext'
import { useSidebar } from '@/components/ui/sidebar'

export default function ServerStatus() {
  const { healthStatus, currentProvider, refreshHealth } = useHealth()
  const [actionLoading, setActionLoading] = useState(false)
  const { state: sidebarState } = useSidebar()
  const isCollapsed = sidebarState === 'collapsed'

  const handleToggle = async () => {
    if (healthStatus.isHealthy) {
      // Stop server
      setActionLoading(true)
      try {
        const result = await serverApi.stop()
        if (result.success) {
          showToast.success('Server Stopped', 'Server stopped successfully.')
          refreshHealth()
        } else {
          showToast.error('Failed to Stop Server', result.message || 'Unknown error occurred')
        }
      } catch (error) {
        console.error('Failed to stop server:', error)
        showToast.error(
          'Failed to Stop Server',
          error.response?.data?.detail || error.message || 'Check console for details.'
        )
      } finally {
        setActionLoading(false)
      }
    } else {
      // Start server
      const selectedModel = localStorage.getItem('llama_selected_model')
      if (!selectedModel) {
        showToast.warning(
          'Model Selection Required',
          'Please select a model in Settings before connecting to Llama.cpp.'
        )
        return
      }

      setActionLoading(true)
      try {
        const result = await serverApi.start(selectedModel)
        if (result.success) {
          showToast.success('Server Started', `Server started successfully with model: ${selectedModel}`)
          refreshHealth()
        } else {
          showToast.error('Failed to Start Server', result.message || 'Unknown error occurred')
        }
      } catch (error) {
        console.error('Failed to start server:', error)
        showToast.error(
          'Failed to Start Server',
          error.response?.data?.detail || error.message || 'Check console for details.'
        )
      } finally {
        setActionLoading(false)
      }
    }
  }

  if (healthStatus.loading) {
    return (
      <div className="flex items-center justify-center w-full">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      </div>
    )
  }

  // Determine if AI was previously connected but is now stopped
  // If user has a selected model, they've set up AI before, so if not healthy = stopped
  const hasSelectedModel = localStorage.getItem('llama_selected_model')
  const hasProviderInfo = currentProvider || healthStatus.displayName || healthStatus.provider
  // Consider it "stopped" if: not healthy AND (has provider info OR has selected model)
  const isStopped = !healthStatus.isHealthy && (hasProviderInfo || hasSelectedModel)
  
  // Determine status color: green when running, red when stopped, gray when not connected
  const getStatusColor = () => {
    if (actionLoading) return 'bg-gray-500'
    if (healthStatus.isHealthy) return 'bg-green-500'
    // If stopped (was connected but not healthy now), show red
    if (isStopped) return 'bg-red-500'
    return 'bg-gray-500'
  }

  const getStatusText = () => {
    if (actionLoading) return 'Connecting...'
    if (healthStatus.isHealthy) return 'AI Ready - Click to stop'
    // If stopped, show "Start AI"
    if (isStopped) return 'Start AI - Click to start'
    return 'Connect AI - Click to connect'
  }
  
  const getButtonText = () => {
    if (actionLoading) return 'Connecting...'
    if (healthStatus.isHealthy) return 'AI Ready'
    // If stopped, always show "Start AI"
    if (isStopped) return 'Start AI'
    return 'Connect AI'
  }

  // Shared button style: dark fill with solid, noticeable border
  const buttonClassName = "bg-sidebar-accent/60 border-2 border-sidebar-border hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/40 transition-colors text-sidebar-foreground"

  // Collapsed state: show dot (same size as expanded) with AI label
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-sidebar-foreground font-medium leading-none">AI</span>
        <button
          className={`h-8 w-8 rounded-md flex items-center justify-center ${buttonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={handleToggle}
          disabled={actionLoading}
          title={getStatusText()}
        >
          {actionLoading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-sidebar-foreground" />
          ) : (
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
          )}
        </button>
      </div>
    )
  }

  // Expanded state: show full button with text
  return (
    <button
      className={`w-full h-8 rounded-md px-3 flex items-center gap-2 justify-start text-xs font-medium ${buttonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
      onClick={handleToggle}
      disabled={actionLoading}
    >
      {actionLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span className="text-xs">Connecting...</span>
        </>
      ) : healthStatus.isHealthy ? (
        <>
          <div className={`h-2 w-2 rounded-full ${getStatusColor()} shrink-0`} />
          <span className="text-xs">AI Ready</span>
        </>
      ) : (
        <>
          <div className={`h-2 w-2 rounded-full ${getStatusColor()} shrink-0`} />
          <span className="text-xs">{getButtonText()}</span>
        </>
      )}
    </button>
  )
}

