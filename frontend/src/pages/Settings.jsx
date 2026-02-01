import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Power,
  Settings as SettingsIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  Sun,
  Moon,
  Trash2,
  AlertTriangle,
  Download,
  Cloud,
} from "lucide-react";
import * as simpleIcons from "simple-icons";
import {
  platformsApi,
  modelsApi,
  providersApi,
  exportApi,
  oauthApi,
} from "../api/client";
import { startOAuthFlow } from "../services/oauthService";
import { useSync } from "../contexts/SyncContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { showToast } from "../lib/toast";
import { cn } from "../lib/utils";
import useUIStore from "../stores/uiStore";
import useDraftStore from "../stores/draftStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

// App version - update this when releasing new versions
const APP_VERSION = "1.0.0";

export default function Settings() {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [config, setConfig] = useState({
    bearer_token: "",
    linkedin_org_id: "",
    access_token: "",
    is_active: false,
  });
  const [testing, setTesting] = useState({});
  const [testResult, setTestResult] = useState({});
  const [models, setModels] = useState([]);
  const [cacheDir, setCacheDir] = useState(null);
  const [selectedLlamaModel, setSelectedLlamaModel] = useState("");
  const [editingPlatform, setEditingPlatform] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [platformConfigs, setPlatformConfigs] = useState({});
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [providerConfigs, setProviderConfigs] = useState({});
  const [testingProvider, setTestingProvider] = useState(null);

  // OAuth state
  const [oauthStatus, setOauthStatus] = useState({
    twitter: { connected: false, loading: true },
    linkedin: { connected: false, loading: true },
  });

  // Theme state
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  // Clear data state
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Sync state
  const { syncEnabled, syncStatus, isOnline, fullSync } = useSync();

  // Export data handler
  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await exportApi.all();

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `postfarm-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast.success("Export Complete", "Your data has been downloaded.");
    } catch (error) {
      console.error("Export failed:", error);
      showToast.error(
        "Export Failed",
        error.message || "Failed to export data.",
      );
    } finally {
      setExporting(false);
    }
  };

  // Clear all data handler
  const handleClearAllData = async () => {
    setClearing(true);
    try {
      // Clear draft store (Zustand persist)
      useDraftStore.persist.clearStorage();
      useDraftStore.setState({ drafts: [], selectedDraftId: null });

      // Clear UI store (except theme preference - user might want to keep it)
      useUIStore.setState({ currentModal: null, flags: {} });

      // Clear any other localStorage items (except theme)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== "ui-storage") {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      showToast.success(
        "Data Cleared",
        "All app data has been cleared successfully.",
      );
      setShowClearDataDialog(false);
    } catch (error) {
      console.error("Failed to clear data:", error);
      showToast.error(
        "Clear Failed",
        "Failed to clear app data. Please try again.",
      );
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    loadPlatforms();
    loadModels();
    loadProviders();
    checkOAuthStatus();
    // Load saved model from localStorage
    const savedModel = localStorage.getItem("llama_selected_model");
    if (savedModel) {
      setSelectedLlamaModel(savedModel);
    }
  }, []);

  useEffect(() => {
    // Check for OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) {
      showToast.success("Connected", `${connected} connected successfully!`);
      // Refresh OAuth status
      checkOAuthStatus();
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (error) {
      showToast.error("Connection Failed", decodeURIComponent(error));
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Save model selection to localStorage when it changes
    if (selectedLlamaModel) {
      localStorage.setItem("llama_selected_model", selectedLlamaModel);
    }
  }, [selectedLlamaModel]);

  const loadModels = async () => {
    try {
      const [modelsData, cacheData] = await Promise.all([
        modelsApi.list(),
        modelsApi.getCacheDir(),
      ]);
      console.log("Models loaded:", modelsData);
      console.log("Cache dir:", cacheData);
      setModels(modelsData || []);
      setCacheDir(cacheData);
    } catch (error) {
      console.error("Failed to load models:", error);
      showToast.error(
        "Failed to Load Models",
        error.message || "Could not load models",
      );
      setModels([]);
    }
  };

  const loadPlatformConfig = async (platform) => {
    try {
      const data = await platformsApi.get(platform);
      setPlatformConfigs((prev) => ({
        ...prev,
        [platform]: {
          bearer_token: "",
          linkedin_org_id: "",
          access_token: "",
          is_active: data.is_active,
        },
      }));
      setSelectedPlatform(platform);
    } catch (error) {
      console.error("Failed to load platform config:", error);
    }
  };

  const loadAllPlatformConfigs = async (platformsList) => {
    for (const platform of platformsList) {
      try {
        const data = await platformsApi.get(platform.platform);
        setPlatformConfigs((prev) => ({
          ...prev,
          [platform.platform]: {
            bearer_token: "",
            linkedin_org_id: "",
            access_token: "",
            is_active: data.is_active,
          },
        }));
      } catch (error) {
        console.error(`Failed to load config for ${platform.platform}:`, error);
      }
    }
  };

  const loadPlatforms = async () => {
    try {
      const data = await platformsApi.list();
      setPlatforms(data);
      await loadAllPlatformConfigs(data);
    } catch (error) {
      console.error("Failed to load platforms:", error);
    }
  };

  const loadProviders = async () => {
    try {
      const [providersData, currentData] = await Promise.all([
        providersApi.list(),
        providersApi.getCurrent(),
      ]);
      setProviders(providersData.providers || []);
      setCurrentProvider(currentData);

      // Load configs for all providers
      for (const provider of providersData.providers || []) {
        try {
          const config = await providersApi.getConfig(provider.name);
          setProviderConfigs((prev) => ({
            ...prev,
            [provider.name]: config.config || {},
          }));
        } catch (error) {
          console.error(`Failed to load config for ${provider.name}:`, error);
        }
      }
    } catch (error) {
      console.error("Failed to load providers:", error);
    }
  };

  const handleSelectProvider = async (providerName) => {
    try {
      await providersApi.select(providerName);
      showToast.success("Provider Selected", `${providerName} is now active`);
      await loadProviders();
    } catch (error) {
      showToast.error(
        "Failed to Select Provider",
        error.response?.data?.detail || "Failed to select provider",
      );
    }
  };

  const handleUpdateProviderConfig = async (providerName, config) => {
    try {
      await providersApi.updateConfig(providerName, config);
      setProviderConfigs((prev) => ({
        ...prev,
        [providerName]: config,
      }));
      showToast.success(
        "Configuration Saved",
        `${providerName} configuration updated`,
      );
    } catch (error) {
      showToast.error(
        "Failed to Save",
        error.response?.data?.detail || "Failed to save configuration",
      );
    }
  };

  const handleTestProvider = async (providerName) => {
    setTestingProvider(providerName);
    try {
      const result = await providersApi.test(providerName);
      showToast.success("Connection Test Passed", result.message);
    } catch (error) {
      showToast.error(
        "Connection Test Failed",
        error.response?.data?.detail || "Test failed",
      );
    } finally {
      setTestingProvider(null);
    }
  };

  const checkOAuthStatus = async () => {
    try {
      const [twitterStatus, linkedinStatus] = await Promise.all([
        oauthApi.getStatus("twitter"),
        oauthApi.getStatus("linkedin"),
      ]);
      setOauthStatus({
        twitter: { ...twitterStatus, loading: false },
        linkedin: { ...linkedinStatus, loading: false },
      });
    } catch (error) {
      console.error("Failed to check OAuth status:", error);
      setOauthStatus({
        twitter: { connected: false, loading: false },
        linkedin: { connected: false, loading: false },
      });
    }
  };

  const handleOAuthConnect = async (platform) => {
    try {
      const { auth_url } = await oauthApi.initiate(platform);
      await startOAuthFlow(auth_url, platform);
      // Refresh status after popup closes
      const status = await oauthApi.getStatus(platform);
      setOauthStatus((prev) => ({
        ...prev,
        [platform]: { ...status, loading: false },
      }));
      showToast.success("Connected", `${platform} connected successfully!`);
    } catch (error) {
      console.error(`OAuth ${platform} failed:`, error);
      showToast.error("Connection Failed", error.message);
    }
  };

  const handleOAuthDisconnect = async (platform) => {
    try {
      await oauthApi.disconnect(platform);
      setOauthStatus((prev) => ({
        ...prev,
        [platform]: { connected: false, loading: false },
      }));
      showToast.success("Disconnected", `${platform} disconnected`);
    } catch (error) {
      console.error(`OAuth disconnect ${platform} failed:`, error);
      showToast.error("Disconnect Failed", error.message);
    }
  };

  const handleSave = async (platform) => {
    const config = platformConfigs[platform];
    if (!config) return;

    try {
      await platformsApi.update(platform, config);
      showToast.success(
        "Settings Saved",
        `${platform} configuration saved successfully`,
      );
      setEditingPlatform(null);
      loadPlatforms();
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast.error(
        "Failed to Save",
        error.response?.data?.detail || "Failed to save settings",
      );
    }
  };

  const handleTest = async (platform) => {
    setTesting((prev) => ({ ...prev, [platform]: true }));
    setTestResult((prev) => ({ ...prev, [platform]: null }));
    try {
      const result = await platformsApi.test(platform);
      setTestResult((prev) => ({ ...prev, [platform]: result }));
      if (result.success) {
        showToast.success("Connection Test Passed", result.message);
      } else {
        showToast.error("Connection Test Failed", result.message);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Test failed";
      setTestResult((prev) => ({
        ...prev,
        [platform]: { success: false, message: errorMsg },
      }));
      showToast.error("Connection Test Failed", errorMsg);
    } finally {
      setTesting((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const updatePlatformConfig = (platform, field, value) => {
    setPlatformConfigs((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value,
      },
    }));
  };

  const togglePlatformActive = async (platform) => {
    const currentConfig = platformConfigs[platform] || { is_active: false };
    const newActiveState = !currentConfig.is_active;

    updatePlatformConfig(platform, "is_active", newActiveState);

    try {
      await platformsApi.update(platform, {
        ...currentConfig,
        is_active: newActiveState,
      });
      showToast.success(
        newActiveState ? "Platform Enabled" : "Platform Disabled",
        `${platform} has been ${newActiveState ? "enabled" : "disabled"}`,
      );
      loadPlatforms();
    } catch (error) {
      // Revert on error
      updatePlatformConfig(platform, "is_active", currentConfig.is_active);
      showToast.error(
        "Failed to Update",
        error.response?.data?.detail || "Failed to update platform status",
      );
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

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
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Platform Connections
          </h2>

          {platforms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <SettingsIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-base font-semibold mb-2">
                  No Platforms Available
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Platform configurations are loading. If this persists, check
                  your backend connection.
                </p>
                <Button variant="outline" onClick={loadPlatforms}>
                  Refresh
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {platforms.map((platform) => {
                const platformName = platform.platform;
                const oauthConnected = oauthStatus[platformName]?.connected;
                const oauthLoading = oauthStatus[platformName]?.loading;
                const expiresAt = oauthStatus[platformName]?.expires_at;

                // Platform icon paths (clean, no background)
                const platformIconPath = platformName === "twitter"
                  ? simpleIcons.siX.path
                  : "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

                return (
                  <div
                    key={platformName}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-lg border transition-all",
                      oauthConnected
                        ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50"
                        : "bg-card border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {/* Left: Icon + Info */}
                    <div className="flex items-center gap-4">
                      <svg
                        role="img"
                        viewBox="0 0 24 24"
                        className="h-6 w-6 fill-current text-foreground"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <path d={platformIconPath} />
                      </svg>
                      <div>
                        <h3 className="text-sm font-semibold capitalize">
                          {platformName}
                        </h3>
                        {oauthLoading ? (
                          <p className="text-xs text-muted-foreground">Checking status...</p>
                        ) : oauthConnected ? (
                          <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Connected
                            {expiresAt && (
                              <span className="text-muted-foreground ml-1">
                                · Expires {new Date(expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not connected</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <div>
                      {oauthLoading ? (
                        <Button variant="outline" size="sm" disabled>
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </Button>
                      ) : oauthConnected ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOAuthDisconnect(platformName)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOAuthConnect(platformName)}
                          className="gap-1.5"
                        >
                          Connect
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Configuration - Combined Provider and Model */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            AI Configuration
          </h2>
          <Card>
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Cloud/Local Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">AI Inference Provider</p>
                    <div className="flex items-center gap-1.5">
                      {currentProvider?.provider_name === "google" ? (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                          >
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          <span className="text-xs text-muted-foreground">
                            Google
                          </span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3.5 w-3.5"
                            xmlns="http://www.w3.org/2000/svg"
                            xmlnsXlink="http://www.w3.org/1999/xlink"
                            aria-hidden="true"
                            focusable="false"
                            role="img"
                            preserveAspectRatio="xMidYMid meet"
                            viewBox="0 0 22 28"
                          >
                            <path
                              fill="#FF8236"
                              fillRule="evenodd"
                              d="M8.076.883c.5.246.349.605.207.92l-.156.355c-.283.64-.566 1.282-.912 1.887-.753 1.317-.608 2.57.134 3.82.048.08.09.163.143.267l.103.198c-2.171.578-3.933 2.039-4.937 2.871a25.28 25.28 0 0 1-.401.328c.067-.64.12-1.292.171-1.947.078-.974.156-1.953.284-2.9.189-1.385.628-2.704 1.432-3.87.93-1.347 2.204-2.046 3.932-1.93ZM3.69 12.375c2.092-1.99 4.547-2.983 7.4-2.878 1.907.07 3.682.624 5.3 1.814l-.658 1.128-.001.002-1.023 1.755c-.237-.111-.468-.23-.697-.347-.488-.25-.965-.495-1.47-.654-4.92-1.552-8.474 2.513-7.991 6.727.266 2.332 1.935 3.78 4.309 3.856 1.238.04 2.39-.288 3.503-.784.225-.1.448-.206.69-.321l.376-.178c.09.351.193.73.296 1.114.185.686.375 1.388.51 1.978-2.958 1.498-6.097 2.197-9.24.746C1.777 24.85.428 21.687.813 18.356c.265-2.301 1.233-4.281 2.877-5.981m15.601 8.976v-2.117h1.958v-1.945h-1.973v-2.082h-2.014v2.108H15.26v1.923h2.043v2.113h1.99m-7.015-4.06h2.035v1.924h-2.026v2.141h-1.99V19.24H8.31v-1.93h1.977v-2.113h1.99v2.094M10.845 2.842C9.11 4.19 8.675 6.16 8.257 8.194c1.46-.37 2.936-.29 4.41-.135l-.232-.461-.03-.059c-.544-1.087-.613-2.124.243-3.118.326-.38.595-.812.862-1.24l.057-.091c.29-.463.191-.67-.35-.769-.86-.156-1.683-.014-2.372.521Z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-xs text-muted-foreground">
                            Llama.cpp
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        currentProvider?.provider_name === "google" &&
                          "font-medium text-foreground",
                      )}
                    >
                      Cloud
                    </span>
                    <Switch
                      checked={currentProvider?.provider_name === "llamacpp"}
                      onCheckedChange={(checked) =>
                        handleSelectProvider(checked ? "llamacpp" : "google")
                      }
                    />
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        currentProvider?.provider_name === "llamacpp" &&
                          "font-medium text-foreground",
                      )}
                    >
                      Local
                    </span>
                  </div>
                </div>

                {/* Cloud Configuration (Google) */}
                {currentProvider?.provider_name === "google" && (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        API Key
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={showPasswords.google ? "text" : "password"}
                          value={providerConfigs.google?.api_key || ""}
                          onChange={(e) =>
                            handleUpdateProviderConfig("google", {
                              ...providerConfigs.google,
                              api_key: e.target.value,
                            })
                          }
                          placeholder="AIza..."
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowPasswords((prev) => ({
                              ...prev,
                              google: !prev.google,
                            }))
                          }
                        >
                          {showPasswords.google ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Model
                      </label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={
                          providerConfigs.google?.model || "gemini-2.0-flash"
                        }
                        onChange={(e) =>
                          handleUpdateProviderConfig("google", {
                            ...providerConfigs.google,
                            model: e.target.value,
                          })
                        }
                      >
                        <option value="gemini-2.0-flash">
                          Gemini 2.0 Flash
                        </option>
                        <option value="gemini-2.0-flash-lite">
                          Gemini 2.0 Flash Lite
                        </option>
                        <option value="gemini-2.5-flash">
                          Gemini 2.5 Flash
                        </option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Local Configuration (Llama.cpp) */}
                {currentProvider?.provider_name === "llamacpp" && (
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
                          {!cacheDir?.exists
                            ? "Cache directory not found"
                            : "No models found"}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadModels}
                        >
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

        {/* Data & Sync Section */}
        <div className="space-y-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Data & Sync
          </h2>

          {/* Cloud Sync Status */}
          {syncEnabled && (
            <div className="flex items-center justify-between py-3 border-b">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Cloud Sync</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      isOnline
                        ? "border-green-500/50 text-green-600 dark:text-green-400"
                        : "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
                    )}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {syncStatus === "syncing"
                    ? "Syncing your data..."
                    : isOnline
                      ? "Your data is synced across devices"
                      : "Changes will sync when you reconnect"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fullSync}
                disabled={syncStatus === "syncing" || !isOnline}
              >
                {syncStatus === "syncing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Cloud className="mr-2 h-4 w-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Export Data */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Export Data</p>
              <p className="text-xs text-muted-foreground">
                Download all your drafts and scheduled posts as JSON
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Preferences Section - Minimal Design */}
        <div className="space-y-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Preferences
          </h2>

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
                checked={theme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
              />
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Clear All Data</p>
              <p className="text-xs text-muted-foreground">
                Delete all drafts, scheduled posts, and app settings. This
                cannot be undone.
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
              Are you sure you want to clear all app data? This will permanently
              delete:
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
  );
}
