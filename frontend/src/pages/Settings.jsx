import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Database, ExternalLink, Eye, EyeOff, Power, Settings as SettingsIcon, Sparkles, ArrowRight, Loader2, Sun, Moon, Trash2, AlertTriangle } from 'lucide-react'
import { platformsApi, modelsApi, providersApi } from '../api/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import { showToast } from '../lib/toast'
import { cn } from '../lib/utils'
import useUIStore from '../stores/uiStore'
import useDraftStore from '../stores/draftStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'

// App version - update this when releasing new versions
const APP_VERSION = '1.0.0'

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

  // Theme state
  const theme = useUIStore((state) => state.theme)
  const setTheme = useUIStore((state) => state.setTheme)

  // Clear data state
  const [showClearDataDialog, setShowClearDataDialog] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Clear all data handler
  const handleClearAllData = async () => {
    setClearing(true)
    try {
      // Clear draft store (Zustand persist)
      useDraftStore.persist.clearStorage()
      useDraftStore.setState({ drafts: [], selectedDraftId: null })

      // Clear UI store (except theme preference - user might want to keep it)
      useUIStore.setState({ currentModal: null, flags: {} })

      // Clear any other localStorage items (except theme)
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key !== 'ui-storage') {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      showToast.success('Data Cleared', 'All app data has been cleared successfully.')
      setShowClearDataDialog(false)
    } catch (error) {
      console.error('Failed to clear data:', error)
      showToast.error('Clear Failed', 'Failed to clear app data. Please try again.')
    } finally {
      setClearing(false)
    }
  }

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
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your local AI model and connect social media platforms
          </p>
        </div>

        {/* Platform Connections */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Platform Connections</h2>

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
          <div className="grid gap-4">
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
                  <CardContent className="p-5">
                    <div className="space-y-4">
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
                                className="h-4 w-4 rounded border-gray-300 text-primary"
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

        {/* AI Configuration - Combined Provider and Model */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Configuration</h2>
          <Card>
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Cloud/Local Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">AI Inference Provider</p>
                    <div className="flex items-center gap-1.5">
                      {currentProvider?.provider_name === 'google' ? (
                        <>
                          <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span className="text-xs text-muted-foreground">Google</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false" role="img" preserveAspectRatio="xMidYMid meet" viewBox="0 0 22 28">
                            <path fill="#FF8236" fillRule="evenodd" d="M8.076.883c.5.246.349.605.207.92l-.156.355c-.283.64-.566 1.282-.912 1.887-.753 1.317-.608 2.57.134 3.82.048.08.09.163.143.267l.103.198c-2.171.578-3.933 2.039-4.937 2.871a25.28 25.28 0 0 1-.401.328c.067-.64.12-1.292.171-1.947.078-.974.156-1.953.284-2.9.189-1.385.628-2.704 1.432-3.87.93-1.347 2.204-2.046 3.932-1.93ZM3.69 12.375c2.092-1.99 4.547-2.983 7.4-2.878 1.907.07 3.682.624 5.3 1.814l-.658 1.128-.001.002-1.023 1.755c-.237-.111-.468-.23-.697-.347-.488-.25-.965-.495-1.47-.654-4.92-1.552-8.474 2.513-7.991 6.727.266 2.332 1.935 3.78 4.309 3.856 1.238.04 2.39-.288 3.503-.784.225-.1.448-.206.69-.321l.376-.178c.09.351.193.73.296 1.114.185.686.375 1.388.51 1.978-2.958 1.498-6.097 2.197-9.24.746C1.777 24.85.428 21.687.813 18.356c.265-2.301 1.233-4.281 2.877-5.981m15.601 8.976v-2.117h1.958v-1.945h-1.973v-2.082h-2.014v2.108H15.26v1.923h2.043v2.113h1.99m-7.015-4.06h2.035v1.924h-2.026v2.141h-1.99V19.24H8.31v-1.93h1.977v-2.113h1.99v2.094M10.845 2.842C9.11 4.19 8.675 6.16 8.257 8.194c1.46-.37 2.936-.29 4.41-.135l-.232-.461-.03-.059c-.544-1.087-.613-2.124.243-3.118.326-.38.595-.812.862-1.24l.057-.091c.29-.463.191-.67-.35-.769-.86-.156-1.683-.014-2.372.521Z" clipRule="evenodd"/>
                          </svg>
                          <span className="text-xs text-muted-foreground">Llama.cpp</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs text-muted-foreground", currentProvider?.provider_name === 'google' && "font-medium text-foreground")}>
                      Cloud
                    </span>
                    <Switch
                      checked={currentProvider?.provider_name === 'llamacpp'}
                      onCheckedChange={(checked) => handleSelectProvider(checked ? 'llamacpp' : 'google')}
                    />
                    <span className={cn("text-xs text-muted-foreground", currentProvider?.provider_name === 'llamacpp' && "font-medium text-foreground")}>
                      Local
                    </span>
                  </div>
                </div>

                {/* Cloud Configuration (Google) */}
                {currentProvider?.provider_name === 'google' && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        API Key
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showPasswords.google ? "text" : "password"}
                          value={providerConfigs.google?.api_key || ''}
                          onChange={(e) => handleUpdateProviderConfig('google', {
                            ...providerConfigs.google,
                            api_key: e.target.value
                          })}
                          placeholder="AIza..."
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPasswords(prev => ({ ...prev, google: !prev.google }))}
                        >
                          {showPasswords.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Model
                      </label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={providerConfigs.google?.model || 'gemini-2.0-flash'}
                        onChange={(e) => handleUpdateProviderConfig('google', {
                          ...providerConfigs.google,
                          model: e.target.value
                        })}
                      >
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Local Configuration (Llama.cpp) */}
                {currentProvider?.provider_name === 'llamacpp' && (
                  <div className="pt-3 border-t">
                    <label className="text-sm font-medium mb-1.5 block">
                      Model
                    </label>
                    {models.length > 0 ? (
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                          {!cacheDir?.exists ? 'Cache directory not found' : 'No models found'}
                        </p>
                        <Button variant="outline" size="sm" onClick={loadModels}>
                          Refresh
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preferences Section - Minimal Design */}
        <div className="space-y-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Preferences</h2>
          
          {/* Appearance */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">
                Switch between light and dark themes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Clear All Data</p>
              <p className="text-xs text-muted-foreground">
                Delete all drafts, scheduled posts, and app settings. This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDataDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </div>
        </div>

        {/* Version Label */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground text-center">
            Postfarm v{APP_VERSION}
          </p>
        </div>
      </div>

      {/* Clear Data Confirmation Dialog */}
      <Dialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all app data? This will permanently delete:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>All drafts and their content</li>
              <li>All scheduled posts</li>
              <li>Platform connection settings</li>
              <li>AI model preferences</li>
            </ul>
            <p className="mt-4 text-sm font-medium text-destructive">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDataDialog(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllData}
              disabled={clearing}
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
