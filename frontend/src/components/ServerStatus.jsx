import { useState, useEffect } from 'react'
import { Power, CheckCircle, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { serverApi } from '../api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { showToast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function ServerStatus() {
  const [status, setStatus] = useState(null)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showStopDialog, setShowStopDialog] = useState(false)

  useEffect(() => {
    loadStatus()
    loadModels()
    // Poll status every 5 seconds
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const data = await serverApi.getStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load server status:', error)
      setStatus({ running: false, url: 'http://localhost:8080', port: 8080 })
    }
  }

  const loadModels = async () => {
    try {
      const data = await serverApi.getAvailableModels()
      setModels(data.models || [])
      if (data.models && data.models.length > 0 && !selectedModel) {
        setSelectedModel(data.models[0].name)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const handleStart = async () => {
    if (!selectedModel) {
      showToast.warning('Model Selection Required', 'Please select a model before starting the server.')
      return
    }

    setActionLoading(true)
    try {
      const result = await serverApi.start(selectedModel)
      if (result.success) {
        showToast.success('Server Started', `Server started successfully with model: ${selectedModel}`)
        setShowStartDialog(false)
        await loadStatus()
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

  const handleStop = async () => {
    setActionLoading(true)
    try {
      const result = await serverApi.stop()
      if (result.success) {
        showToast.success('Server Stopped', 'Server stopped successfully.')
        setShowStopDialog(false)
        await loadStatus()
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
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            {status.running ? (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="hidden sm:inline">Llama.cpp</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {status.model ? status.model.split('/').pop().split('.')[0] : 'Online'}
                </Badge>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="hidden sm:inline">Connect Llama.cpp</span>
              </>
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>
            LLM Server Status
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {status.running ? (
            <>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-medium">Connected</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {status.model && (
                    <div className="truncate" title={status.model}>
                      Model: {status.model.split('/').pop()}
                    </div>
                  )}
                  <div>{status.url}</div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowStopDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Power className="mr-2 h-4 w-4" />
                Stop Server
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <div className="px-2 py-1.5 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="font-medium">Disconnected</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Click below to start the server
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowStartDialog(true)}>
                <Power className="mr-2 h-4 w-4" />
                Start Server
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Start Server Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Llama.cpp Server</DialogTitle>
            <DialogDescription>
              Select a model to start the LLM server. The server needs the llama-server binary in your PATH.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {models.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No models found in ~/Library/Caches/llama.cpp
                <br />
                <span className="text-xs mt-1 block">
                  Use <code className="px-1 py-0.5 bg-muted rounded text-xs">llama-download</code> to download models
                </span>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-2">Select Model</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {models.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({formatFileSize(model.size)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStartDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStart}
              disabled={actionLoading || !selectedModel || models.length === 0}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Power className="mr-2 h-4 w-4" />
                  Start Server
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Server Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop the LLM server? This will stop all running inference operations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStopDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleStop}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                'Stop Server'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

