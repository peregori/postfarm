import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Database, ExternalLink, Eye, EyeOff, Power, Settings as SettingsIcon, Sparkles, ArrowRight } from 'lucide-react'
import { platformsApi, modelsApi } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { showToast } from '../lib/toast'
import { cn } from '../lib/utils'

export default function Settings() {
  const [platforms, setPlatforms] = useState([])
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [config, setConfig] = useState({
    bearer_token: '',
    linkedin_org_id: '',
    access_token: '',
    is_active: false,
  })
  const [testing, setTesting] = useState({})
  const [testResult, setTestResult] = useState({})
  const [models, setModels] = useState([])
  const [cacheDir, setCacheDir] = useState(null)
  const [selectedLlamaModel, setSelectedLlamaModel] = useState('')
  const [editingPlatform, setEditingPlatform] = useState(null)
  const [showPasswords, setShowPasswords] = useState({})
  const [platformConfigs, setPlatformConfigs] = useState({})

  useEffect(() => {
    loadPlatforms()
    loadModels()
    // Load saved model from localStorage
    const savedModel = localStorage.getItem('llama_selected_model')
    if (savedModel) {
      setSelectedLlamaModel(savedModel)
    }
  }, [])

  useEffect(() => {
    // Save model selection to localStorage when it changes
    if (selectedLlamaModel) {
      localStorage.setItem('llama_selected_model', selectedLlamaModel)
    }
  }, [selectedLlamaModel])

  const loadModels = async () => {
    try {
      const [modelsData, cacheData] = await Promise.all([
        modelsApi.list(),
        modelsApi.getCacheDir()
      ])
      console.log('Models loaded:', modelsData)
      console.log('Cache dir:', cacheData)
      setModels(modelsData || [])
      setCacheDir(cacheData)
    } catch (error) {
      console.error('Failed to load models:', error)
      showToast.error('Failed to Load Models', error.message || 'Could not load models')
      setModels([])
    }
  }

  const loadPlatformConfig = async (platform) => {
    try {
      const data = await platformsApi.get(platform)
      setPlatformConfigs(prev => ({
        ...prev,
        [platform]: {
          bearer_token: '',
          linkedin_org_id: '',
          access_token: '',
          is_active: data.is_active,
        }
      }))
      setSelectedPlatform(platform)
    } catch (error) {
      console.error('Failed to load platform config:', error)
    }
  }

  const loadAllPlatformConfigs = async (platformsList) => {
    for (const platform of platformsList) {
      try {
        const data = await platformsApi.get(platform.platform)
        setPlatformConfigs(prev => ({
          ...prev,
          [platform.platform]: {
            bearer_token: '',
            linkedin_org_id: '',
            access_token: '',
            is_active: data.is_active,
          }
        }))
      } catch (error) {
        console.error(`Failed to load config for ${platform.platform}:`, error)
      }
    }
  }

  const loadPlatforms = async () => {
    try {
      const data = await platformsApi.list()
      setPlatforms(data)
      await loadAllPlatformConfigs(data)
    } catch (error) {
      console.error('Failed to load platforms:', error)
    }
  }

  const handleSave = async (platform) => {
    const config = platformConfigs[platform]
    if (!config) return

    try {
      await platformsApi.update(platform, config)
      showToast.success('Settings Saved', `${platform} configuration saved successfully`)
      setEditingPlatform(null)
      loadPlatforms()
    } catch (error) {
      console.error('Failed to save settings:', error)
      showToast.error('Failed to Save', error.response?.data?.detail || 'Failed to save settings')
    }
  }

  const handleTest = async (platform) => {
    setTesting(prev => ({ ...prev, [platform]: true }))
    setTestResult(prev => ({ ...prev, [platform]: null }))
    try {
      const result = await platformsApi.test(platform)
      setTestResult(prev => ({ ...prev, [platform]: result }))
      if (result.success) {
        showToast.success('Connection Test Passed', result.message)
      } else {
        showToast.error('Connection Test Failed', result.message)
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Test failed'
      setTestResult(prev => ({ ...prev, [platform]: { success: false, message: errorMsg } }))
      showToast.error('Connection Test Failed', errorMsg)
    } finally {
      setTesting(prev => ({ ...prev, [platform]: false }))
    }
  }

  const updatePlatformConfig = (platform, field, value) => {
    setPlatformConfigs(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }))
  }

  const togglePlatformActive = async (platform) => {
    const currentConfig = platformConfigs[platform] || { is_active: false }
    const newActiveState = !currentConfig.is_active
    
    updatePlatformConfig(platform, 'is_active', newActiveState)
    
    try {
      await platformsApi.update(platform, {
        ...currentConfig,
        is_active: newActiveState
      })
      showToast.success(
        newActiveState ? 'Platform Enabled' : 'Platform Disabled',
        `${platform} has been ${newActiveState ? 'enabled' : 'disabled'}`
      )
      loadPlatforms()
    } catch (error) {
      // Revert on error
      updatePlatformConfig(platform, 'is_active', currentConfig.is_active)
      showToast.error('Failed to Update', error.response?.data?.detail || 'Failed to update platform status')
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown'
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your AI model and connect social media platforms
        </p>
      </div>

      {/* AI Model - Compact */}
      <Card className="border-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">AI Model</div>
                <div className="text-xs text-muted-foreground">For content generation</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {models.length > 0 ? (
                <>
                  <select
                    className="min-w-[280px] rounded-lg border-2 border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={selectedLlamaModel}
                    onChange={(e) => setSelectedLlamaModel(e.target.value)}
                  >
                    <option value="">Select model...</option>
                    {models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name} ({formatFileSize(model.size)})
                      </option>
                    ))}
                  </select>
                  {selectedLlamaModel && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {!cacheDir?.exists ? 'No cache directory' : 'No models found'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={loadModels}>
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Connections - Main Focus */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <SettingsIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Platform Connections</h2>
            <p className="text-sm text-muted-foreground">
              Connect your accounts to enable automated posting
            </p>
          </div>
        </div>

        {platforms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <SettingsIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-base font-semibold mb-2">No Platforms Available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Platform configurations are loading. If this persists, check your backend connection.
              </p>
              <Button variant="outline" onClick={loadPlatforms}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5">
            {platforms.map((platform) => {
              const platformName = platform.platform
              const isEditing = editingPlatform === platformName
              const config = platformConfigs[platformName] || { is_active: false }
              const isConnected = platform.has_credentials
              const isActive = config.is_active && isConnected
              const platformIcon = platformName === 'twitter' ? '🐦' : '💼'
              const platformColors = platformName === 'twitter'
                ? {
                    bg: 'bg-blue-500/10',
                    border: 'border-blue-500/30',
                    text: 'text-blue-600 dark:text-blue-400',
                    hover: 'hover:bg-blue-500/20'
                  }
                : {
                    bg: 'bg-indigo-500/10',
                    border: 'border-indigo-500/30',
                    text: 'text-indigo-600 dark:text-indigo-400',
                    hover: 'hover:bg-indigo-500/20'
                  }
              
              return (
                <Card 
                  key={platformName} 
                  className={cn(
                    "transition-all duration-200",
                    isActive && "border-2 border-green-500/50 shadow-lg shadow-green-500/5",
                    !isEditing && "hover:shadow-md"
                  )}
                >
                  <CardContent className="p-6">
                    <div className="space-y-5">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={cn("p-3 rounded-xl text-2xl", platformColors.bg, platformColors.border, "border")}>
                            {platformIcon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="text-base font-bold capitalize">{platformName}</h3>
                              <div className="flex items-center gap-2 flex-wrap">
                                {isConnected ? (
                                  <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Connected
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                    Not Connected
                                  </Badge>
                                )}
                                {isActive && (
                                  <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
                                    <Power className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {isConnected 
                                ? (isActive 
                                  ? 'Ready to automatically post content' 
                                  : 'Configured but posting is disabled')
                                : `Click "Connect" to set up ${platformName} integration`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isEditing ? (
                            <>
                              {isConnected && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => togglePlatformActive(platformName)}
                                  className={cn(
                                    "transition-colors",
                                    isActive && "text-green-600 dark:text-green-400 hover:text-green-700"
                                  )}
                                  title={isActive ? 'Disable posting' : 'Enable posting'}
                                >
                                  <Power className={cn("h-4 w-4", isActive ? "" : "opacity-40")} />
                                </Button>
                              )}
                              <Button
                                variant={isConnected ? "outline" : "default"}
                                size="sm"
                                onClick={() => {
                                  if (!platformConfigs[platformName]) {
                                    loadPlatformConfig(platformName)
                                  }
                                  setEditingPlatform(platformName)
                                }}
                                className="gap-2"
                              >
                                {isConnected ? 'Edit' : 'Connect'}
                                  {!isConnected && <ArrowRight className="h-4 w-4 shrink-0" />}
                              </Button>
                            </>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingPlatform(null)
                                  loadPlatformConfig(platformName)
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSave(platformName)}
                              >
                                Save Changes
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Configuration Form */}
                      {isEditing && (
                        <div className="pt-5 border-t space-y-5 bg-muted/30 -mx-6 px-6 py-5 rounded-b-lg">
                          {platformName === 'twitter' && (
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold">
                                Bearer Token (API v2)
                              </label>
                              <div className="relative">
                                <Input
                                  type={showPasswords[`${platformName}_bearer`] ? 'text' : 'password'}
                                  value={config.bearer_token || ''}
                                  onChange={(e) => updatePlatformConfig(platformName, 'bearer_token', e.target.value)}
                                  placeholder="Enter your Twitter Bearer Token"
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, [`${platformName}_bearer`]: !prev[`${platformName}_bearer`] }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {showPasswords[`${platformName}_bearer`] ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Get your Bearer Token from{' '}
                                <a
                                  href="https://developer.twitter.com"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                                >
                                  Twitter Developer Portal
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              </p>
                            </div>
                          )}

                          {platformName === 'linkedin' && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold">
                                  LinkedIn Organization ID
                                </label>
                                <Input
                                  type="text"
                                  value={config.linkedin_org_id || ''}
                                  onChange={(e) => updatePlatformConfig(platformName, 'linkedin_org_id', e.target.value)}
                                  placeholder="Enter LinkedIn Organization ID"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold">
                                  Access Token
                                </label>
                                <div className="relative">
                                  <Input
                                    type={showPasswords[`${platformName}_token`] ? 'text' : 'password'}
                                    value={config.access_token || ''}
                                    onChange={(e) => updatePlatformConfig(platformName, 'access_token', e.target.value)}
                                    placeholder="Enter LinkedIn Access Token"
                                    className="pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPasswords(prev => ({ ...prev, [`${platformName}_token`]: !prev[`${platformName}_token`] }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    {showPasswords[`${platformName}_token`] ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-3 border-t">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`active_${platformName}`}
                                checked={config.is_active || false}
                                onChange={(e) => updatePlatformConfig(platformName, 'is_active', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
                              />
                              <label htmlFor={`active_${platformName}`} className="text-sm font-medium cursor-pointer">
                                Enable automatic posting to {platformName}
                              </label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTest(platformName)}
                              disabled={testing[platformName]}
                              className="shrink-0"
                            >
                              {testing[platformName] ? (
                                <span className="flex items-center gap-2">
                                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  Testing...
                                </span>
                              ) : (
                                'Test Connection'
                              )}
                            </Button>
                          </div>

                          {testResult[platformName] && (
                            <div className={cn(
                              "flex items-start gap-3 p-4 rounded-lg border-2",
                              testResult[platformName].success 
                                ? 'bg-green-500/10 border-green-500/30' 
                                : 'bg-red-500/10 border-red-500/30'
                            )}>
                              {testResult[platformName].success ? (
                                <>
                                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                                      Connection Successful
                                    </p>
                                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-0.5">
                                      {testResult[platformName].message}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                      Connection Failed
                                    </p>
                                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                                      {testResult[platformName].message}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
