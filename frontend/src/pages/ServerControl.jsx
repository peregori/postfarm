import { useState, useEffect } from 'react'
import { Power, Play, Square, RefreshCw, AlertCircle, CheckCircle, Terminal } from 'lucide-react'
import { serverApi } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function ServerControl() {
  const [status, setStatus] = useState(null)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
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
      setShowStopDialog(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Power className="mr-2" size={24} />
            LLM Server Control
          </CardTitle>
          <CardDescription>
            Start and manage the llama.cpp server from here
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Server Status */}
          <div className="mb-6">
            <Card className={cn(
              status?.running ? "border-green-500/50 bg-green-500/5" : "border-border bg-muted/30"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {status?.running ? (
                      <>
                        <CheckCircle className="text-green-600 dark:text-green-400" size={24} />
                        <div>
                          <div className="font-medium text-foreground">Server Running</div>
                          <div className="text-sm text-muted-foreground">
                            {status.url}
                            {status.model && (
                              <>
                                {' • '}
                                <Badge variant="secondary" className="mr-1">{status.model}</Badge>
                              </>
                            )}
                            {status.pid && ` • PID: ${status.pid}`}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="text-muted-foreground" size={24} />
                        <div>
                          <div className="font-medium text-foreground">Server Stopped</div>
                          <div className="text-sm text-muted-foreground">Not running</div>
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={loadStatus}
                    variant="ghost"
                    size="icon"
                    disabled={loading}
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && 'animate-spin')} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Model Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Model</label>
            {models.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No models found in ~/Library/Caches/llama.cpp
                  <br />
                  <span className="text-xs mt-1 block">
                    Use <code className="px-1 py-0.5 bg-muted rounded text-xs">llama-download</code> to download models
                  </span>
                </AlertDescription>
              </Alert>
            ) : (
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={status?.running}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({formatFileSize(model.size)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {status?.running ? (
              <>
                <Button
                  onClick={() => setShowStopDialog(true)}
                  disabled={actionLoading}
                  variant="destructive"
                  className="flex-1"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Server
                </Button>
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
                            <Spinner className="mr-2 h-4 w-4" />
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
            ) : (
              <Button
                onClick={handleStart}
                disabled={actionLoading || !selectedModel || models.length === 0}
                className="flex-1"
              >
                {actionLoading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Server
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Info */}
          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> The server needs the <code className="px-1 py-0.5 bg-muted rounded text-xs">llama-server</code> binary in your PATH.
              <br />
              If you get an error, make sure llama.cpp is installed and the binary is accessible.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

