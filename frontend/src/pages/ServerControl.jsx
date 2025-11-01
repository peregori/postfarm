import { useState, useEffect } from 'react'
import { Power, Play, Square, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { serverApi } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export default function ServerControl() {
  const [status, setStatus] = useState(null)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

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
      alert('Please select a model')
      return
    }

    setActionLoading(true)
    try {
      const result = await serverApi.start(selectedModel)
      if (result.success) {
        await loadStatus()
      } else {
        alert(`Failed to start server: ${result.message}`)
      }
    } catch (error) {
      console.error('Failed to start server:', error)
      alert('Failed to start server. Check console for details.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop the server?')) return

    setActionLoading(true)
    try {
      const result = await serverApi.stop()
      if (result.success) {
        await loadStatus()
      } else {
        alert(`Failed to stop server: ${result.message}`)
      }
    } catch (error) {
      console.error('Failed to stop server:', error)
      alert('Failed to stop server. Check console for details.')
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
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                {status?.running ? (
                  <>
                    <CheckCircle className="text-green-400" size={24} />
                    <div>
                      <div className="font-medium text-white">Server Running</div>
                      <div className="text-sm text-gray-400">
                        {status.url}
                        {status.model && ` • Model: ${status.model}`}
                        {status.pid && ` • PID: ${status.pid}`}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-gray-400" size={24} />
                    <div>
                      <div className="font-medium text-gray-300">Server Stopped</div>
                      <div className="text-sm text-gray-400">Not running</div>
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
                <RefreshCw className={loading ? 'animate-spin' : ''} size={20} />
              </Button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Model</label>
            {models.length === 0 ? (
              <div className="p-4 bg-gray-800 rounded-lg text-gray-400 text-sm">
                No models found in ~/Library/Caches/llama.cpp
                <br />
                <span className="text-xs mt-1 block">
                  Use <code className="px-1 bg-gray-900 rounded">llama-download</code> to download models
                </span>
              </div>
            ) : (
              <select
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <Button
                onClick={handleStop}
                disabled={actionLoading}
                variant="destructive"
                className="flex-1"
              >
                {actionLoading ? (
                  <>
                    <Spinner className="mr-2" size={20} />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="mr-2" size={20} />
                    Stop Server
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleStart}
                disabled={actionLoading || !selectedModel || models.length === 0}
                className="flex-1"
              >
                {actionLoading ? (
                  <>
                    <Spinner className="mr-2" size={20} />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2" size={20} />
                    Start Server
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="text-sm text-blue-300">
              <strong>Note:</strong> The server needs the <code className="px-1 bg-gray-900 rounded">llama-server</code> binary in your PATH.
              <br />
              If you get an error, make sure llama.cpp is installed and the binary is accessible.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

