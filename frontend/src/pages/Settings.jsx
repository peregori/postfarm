import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Database, ExternalLink, Eye, EyeOff, Power, Settings as SettingsIcon, Sparkles, ArrowRight, Loader2 } from 'lucide-react'
import { platformsApi, modelsApi, providersApi } from '../api/client'
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
  const [providers, setProviders] = useState([])
  const [currentProvider, setCurrentProvider] = useState(null)
  const [providerConfigs, setProviderConfigs] = useState({})
  const [testingProvider, setTestingProvider] = useState(null)

  useEffect(() => {
    loadPlatforms()
    loadModels()
    loadProviders()
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

  const loadProviders = async () => {
    try {
      const [providersData, currentData] = await Promise.all([
        providersApi.list(),
        providersApi.getCurrent()
      ])
      setProviders(providersData.providers || [])
      setCurrentProvider(currentData)
      
      // Load configs for all providers
      for (const provider of providersData.providers || []) {
        try {
          const config = await providersApi.getConfig(provider.name)
          setProviderConfigs(prev => ({
            ...prev,
            [provider.name]: config.config || {}
          }))
        } catch (error) {
          console.error(`Failed to load config for ${provider.name}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load providers:', error)
    }
  }

  const handleSelectProvider = async (providerName) => {
    try {
      await providersApi.select(providerName)
      showToast.success('Provider Selected', `${providerName} is now active`)
      await loadProviders()
    } catch (error) {
      showToast.error('Failed to Select Provider', error.response?.data?.detail || 'Failed to select provider')
    }
  }

  const handleUpdateProviderConfig = async (providerName, config) => {
    try {
      await providersApi.updateConfig(providerName, config)
      setProviderConfigs(prev => ({
        ...prev,
        [providerName]: config
      }))
      showToast.success('Configuration Saved', `${providerName} configuration updated`)
    } catch (error) {
      showToast.error('Failed to Save', error.response?.data?.detail || 'Failed to save configuration')
    }
  }

  const handleTestProvider = async (providerName) => {
    setTestingProvider(providerName)
    try {
      const result = await providersApi.test(providerName)
      showToast.success('Connection Test Passed', result.message)
    } catch (error) {
      showToast.error('Connection Test Failed', error.response?.data?.detail || 'Test failed')
    } finally {
      setTestingProvider(null)
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
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your local AI model and connect social media platforms
          </p>
        </div>

        {/* AI Provider Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Provider</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select AI Provider
                  </label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={currentProvider?.provider_name || 'llamacpp'}
                    onChange={(e) => handleSelectProvider(e.target.value)}
                  >
                    {providers.map((provider) => (
                      <option key={provider.name} value={provider.name}>
                        {provider.display_name} - {provider.description}
                      </option>
                    ))}
                  </select>
                  {currentProvider && (
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <Badge variant={currentProvider.is_active ? "default" : "secondary"}>
                        {currentProvider.is_active ? "Active" : "Default"}
                      </Badge>
                      <span className="text-muted-foreground">
                        {currentProvider.display_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Provider-specific configuration */}
                {currentProvider && (
                  <div className="pt-4 border-t space-y-4">
                    {currentProvider.provider_name === 'openai' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            API Key
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type={showPasswords.openai ? "text" : "password"}
                              value={providerConfigs.openai?.api_key || ''}
                              onChange={(e) => handleUpdateProviderConfig('openai', {
                                ...providerConfigs.openai,
                                api_key: e.target.value
                              })}
                              placeholder="sk-..."
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPasswords(prev => ({ ...prev, openai: !prev.openai }))}
                            >
                              {showPasswords.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            Model
                          </label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={providerConfigs.openai?.model || 'gpt-4o-mini'}
                            onChange={(e) => handleUpdateProviderConfig('openai', {
                              ...providerConfigs.openai,
                              model: e.target.value
                            })}
                          >
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestProvider('openai')}
                          disabled={testingProvider === 'openai'}
                        >
                          {testingProvider === 'openai' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Test Connection
                        </Button>
                      </div>
                    )}

                    {currentProvider.provider_name === 'anthropic' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            API Key
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type={showPasswords.anthropic ? "text" : "password"}
                              value={providerConfigs.anthropic?.api_key || ''}
                              onChange={(e) => handleUpdateProviderConfig('anthropic', {
                                ...providerConfigs.anthropic,
                                api_key: e.target.value
                              })}
                              placeholder="sk-ant-..."
                              className="flex-1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPasswords(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                            >
                              {showPasswords.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            Model
                          </label>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={providerConfigs.anthropic?.model || 'claude-3-5-sonnet-20241022'}
                            onChange={(e) => handleUpdateProviderConfig('anthropic', {
                              ...providerConfigs.anthropic,
                              model: e.target.value
                            })}
                          >
                            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                            <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                          </select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestProvider('anthropic')}
                          disabled={testingProvider === 'anthropic'}
                        >
                          {testingProvider === 'anthropic' ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Test Connection
                        </Button>
                      </div>
                    )}

                    {currentProvider.provider_name === 'llamacpp' && (
                      <div className="text-xs text-muted-foreground">
                        <p>Llama.cpp uses local server configuration. Configure the server URL and model in environment variables or use the model selector below.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Model Section - Prominently Featured */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI Model Configuration</h2>
            {currentProvider?.provider_name === 'llamacpp' && (
              <Badge variant="secondary" className="text-xs">Llama.cpp only</Badge>
            )}
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select AI Model
                  </label>
                  {models.length > 0 ? (
                    <div className="space-y-3">
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Model Selected
                          </Badge>
                          <span className="text-muted-foreground">
                            Ready for content generation
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium mb-1">
                          {!cacheDir?.exists ? 'Cache directory not found' : 'No models found'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cacheDir?.path || 'Place GGUF models in the cache directory'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={loadModels}>
                        Refresh
                      </Button>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Privacy:</strong> All content generation runs entirely on your machine. 
                    No data is sent to external services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Connections */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Platform Connections</h2>
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
    </div>
  )
}
