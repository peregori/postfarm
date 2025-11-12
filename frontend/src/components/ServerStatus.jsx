import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { serverApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { showToast } from '@/lib/toast'
import { useHealth } from '../contexts/HealthContext'

export default function ServerStatus() {
  const { healthStatus, currentProvider, refreshHealth } = useHealth()
  const [actionLoading, setActionLoading] = useState(false)

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
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      </div>
    )
  }

  const providerName = currentProvider?.display_name || healthStatus.displayName || 'AI'

  return (
    <Button
      variant={healthStatus.isHealthy ? "default" : "outline"}
      size="sm"
      className="w-full gap-2 justify-start"
      onClick={handleToggle}
      disabled={actionLoading}
    >
      {healthStatus.isHealthy ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="text-xs">{providerName} Ready</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
          <span className="text-xs">Connect {providerName}</span>
        </>
      )}
      {actionLoading && (
        <Loader2 className="h-3 w-3 animate-spin ml-auto shrink-0" />
      )}
    </Button>
  )
}

