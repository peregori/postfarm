import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, CheckCircle, XCircle, Key, Database } from 'lucide-react'
import { platformsApi, modelsApi } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export default function Settings() {
  const [platforms, setPlatforms] = useState([])
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [config, setConfig] = useState({
    bearer_token: '',
    linkedin_org_id: '',
    access_token: '',
    is_active: false,
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [models, setModels] = useState([])
  const [cacheDir, setCacheDir] = useState(null)

  useEffect(() => {
    loadPlatforms()
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const [modelsData, cacheData] = await Promise.all([
        modelsApi.list(),
        modelsApi.getCacheDir()
      ])
      setModels(modelsData)
      setCacheDir(cacheData)
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  const loadPlatforms = async () => {
    try {
      const data = await platformsApi.list()
      setPlatforms(data)
      if (data.length > 0 && !selectedPlatform) {
        setSelectedPlatform(data[0].platform)
        loadPlatformConfig(data[0].platform)
      }
    } catch (error) {
      console.error('Failed to load platforms:', error)
    }
  }

  const loadPlatformConfig = async (platform) => {
    try {
      const data = await platformsApi.get(platform)
      setConfig({
        bearer_token: '',
        linkedin_org_id: '',
        access_token: '',
        is_active: data.is_active,
      })
      setSelectedPlatform(platform)
    } catch (error) {
      console.error('Failed to load platform config:', error)
    }
  }

  const handleSave = async () => {
    if (!selectedPlatform) return

    try {
      await platformsApi.update(selectedPlatform, config)
      alert('Settings saved successfully!')
      loadPlatforms()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings.')
    }
  }

  const handleTest = async () => {
    if (!selectedPlatform) return

    setTesting(true)
    setTestResult(null)
    try {
      const result = await platformsApi.test(selectedPlatform)
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, message: 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Models Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2" size={24} />
            Available Models
          </CardTitle>
          <CardDescription>
            GGUF models found in {cacheDir?.cache_dir || '~'}/Library/Caches/llama.cpp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cacheDir?.exists ? (
            <div className="text-gray-400 text-sm">
              Model cache directory not found. Make sure models are in <code className="px-2 py-1 bg-gray-800 rounded">~/Library/Caches/llama.cpp</code>
            </div>
          ) : models.length === 0 ? (
            <div className="text-gray-400 text-sm">
              No GGUF models found. Use <code className="px-2 py-1 bg-gray-800 rounded">llama-download</code> to download models.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 mb-4">
                Found {models.length} model{models.length !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {models.map((model) => (
                  <div
                    key={model.name}
                    className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="font-medium text-white mb-1">{model.name}</div>
                    <div className="text-xs text-gray-400">
                      {formatFileSize(model.size)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg text-xs text-gray-400">
                <strong>Note:</strong> To use a model, start llama.cpp server with: <br />
                <code className="px-2 py-1 bg-gray-900 rounded mt-1 inline-block">
                  llama-server --model "$LLAMA_CACHE_DIR/your-model.gguf" --port 8080
                </code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SettingsIcon className="mr-2" size={24} />
            Platform Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Platform Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Select Platform</label>
            <div className="flex gap-4">
              {platforms.map((platform) => (
                <button
                  key={platform.platform}
                  onClick={() => loadPlatformConfig(platform.platform)}
                  className={`flex-1 p-4 rounded-lg border transition-colors ${
                    selectedPlatform === platform.platform
                      ? 'border-primary-500 bg-primary-500/20 text-primary-400'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    {platform.platform === 'twitter' ? '🐦' : '💼'}
                  </div>
                  <div className="text-sm font-medium capitalize">
                    {platform.platform}
                  </div>
                  <div className="text-xs mt-1">
                    {platform.has_credentials ? (
                      <span className="text-green-400">Configured</span>
                    ) : (
                      <span className="text-gray-400">Not configured</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Form */}
          {selectedPlatform && (
            <div className="space-y-6">
              {selectedPlatform === 'twitter' && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Bearer Token (API v2)
                  </label>
                  <Input
                    type="password"
                    value={config.bearer_token}
                    onChange={(e) =>
                      setConfig({ ...config, bearer_token: e.target.value })
                    }
                    placeholder="Enter your Twitter Bearer Token"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Get this from{' '}
                    <a
                      href="https://developer.twitter.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 hover:underline"
                    >
                      Twitter Developer Portal
                    </a>
                  </p>
                </div>
              )}

              {selectedPlatform === 'linkedin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      LinkedIn Organization ID
                    </label>
                    <Input
                      type="text"
                      value={config.linkedin_org_id}
                      onChange={(e) =>
                        setConfig({ ...config, linkedin_org_id: e.target.value })
                      }
                      placeholder="Enter LinkedIn Organization ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Access Token
                    </label>
                    <Input
                      type="password"
                      value={config.access_token}
                      onChange={(e) =>
                        setConfig({ ...config, access_token: e.target.value })
                      }
                      placeholder="Enter LinkedIn Access Token"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={config.is_active}
                  onChange={(e) =>
                    setConfig({ ...config, is_active: e.target.checked })
                  }
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm">
                  Enable this platform
                </label>
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleTest}
                  disabled={testing}
                  variant="outline"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                {testResult && (
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <>
                        <CheckCircle className="text-green-400" size={20} />
                        <span className="text-sm text-green-400">
                          {testResult.message}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="text-red-400" size={20} />
                        <span className="text-sm text-red-400">
                          {testResult.message}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <Button onClick={handleSave} className="w-full">
                Save Settings
              </Button>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-800/50 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center">
              <Key className="mr-2" size={18} />
              Setup Instructions
            </h3>
            <div className="text-sm text-gray-400 space-y-2">
              <p>
                <strong>Twitter/X:</strong> Create an app in the{' '}
                <a
                  href="https://developer.twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-400 hover:underline"
                >
                  Twitter Developer Portal
                </a>
                . Use the Bearer Token for API v2 authentication.
              </p>
              <p>
                <strong>LinkedIn:</strong> Create a LinkedIn app and get an OAuth
                access token. You'll also need your Organization ID to post on
                behalf of your organization.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
