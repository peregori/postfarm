import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 120000, // 2 minutes timeout for LLM generation (reasoning models can be slow)
});

// Store for the auth token getter function
let getAuthToken = null;

// Function to set the auth token getter (called from React component)
export const setAuthTokenGetter = (getter) => {
  getAuthToken = getter;
};

// Request interceptor to add auth token
client.interceptors.request.use(
  async (config) => {
    if (getAuthToken) {
      try {
        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // Token not available, continue without auth header
        console.warn("Failed to get auth token:", error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle 401 errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to sign-in
      // This is handled by Clerk's SignedOut component, but log for debugging
      console.warn("Unauthorized request - token may be expired");
    }
    return Promise.reject(error);
  },
);

// LLM API
export const llmApi = {
  generate: async (prompt, options = {}) => {
    const response = await client.post("/llm/generate", {
      prompt,
      max_tokens: options.max_tokens || 500,
      temperature: options.temperature || 0.7,
      system_prompt: options.system_prompt,
      platform: options.platform || null,
    });
    return response.data;
  },

  edit: async (originalContent, editInstruction, temperature = 0.5) => {
    const response = await client.post("/llm/edit", {
      original_content: originalContent,
      edit_instruction: editInstruction,
      temperature,
    });
    return response.data;
  },

  generateTitle: async (content) => {
    const response = await client.post("/llm/generate-title", {
      content,
    });
    return response.data;
  },

  health: async () => {
    const response = await client.get("/llm/health");
    return response.data;
  },
};

// Drafts API
export const draftsApi = {
  list: async () => {
    const response = await client.get("/drafts/");
    return response.data;
  },

  get: async (id) => {
    const response = await client.get(`/drafts/${id}`);
    return response.data;
  },

  create: async (draft) => {
    const response = await client.post("/drafts/", draft);
    return response.data;
  },

  update: async (id, draft) => {
    const response = await client.put(`/drafts/${id}`, draft);
    return response.data;
  },

  delete: async (id) => {
    await client.delete(`/drafts/${id}`);
  },
};

// Scheduler API
export const schedulerApi = {
  schedule: async (request) => {
    const response = await client.post("/scheduler/schedule", request);
    return response.data;
  },

  cancel: async (postId) => {
    const response = await client.post(`/scheduler/${postId}/cancel`);
    return response.data;
  },

  calendar: async (startDate, endDate, cacheBust = false) => {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    // Add cache-busting parameter if requested
    if (cacheBust) params._t = Date.now();
    const response = await client.get("/scheduler/calendar", { params });
    return response.data;
  },
};

// Posts API
export const postsApi = {
  list: async (filters = {}) => {
    const response = await client.get("/posts/", { params: filters });
    return response.data;
  },

  get: async (id) => {
    const response = await client.get(`/posts/${id}`);
    return response.data;
  },
};

// Platforms API
export const platformsApi = {
  list: async () => {
    const response = await client.get("/platforms/");
    return response.data;
  },

  get: async (platform) => {
    const response = await client.get(`/platforms/${platform}`);
    return response.data;
  },

  update: async (platform, config) => {
    const response = await client.put(`/platforms/${platform}`, config);
    return response.data;
  },

  test: async (platform) => {
    const response = await client.post(`/platforms/${platform}/test`);
    return response.data;
  },

  publish: async (platform, content) => {
    const response = await client.post(`/platforms/${platform}/publish`, {
      content,
    });
    return response.data;
  },
};

// Models API
export const modelsApi = {
  list: async () => {
    const response = await client.get("/models/");
    return response.data;
  },

  getCacheDir: async () => {
    const response = await client.get("/models/cache-dir");
    return response.data;
  },
};

// Server API
export const serverApi = {
  getStatus: async () => {
    const response = await client.get("/server/status");
    return response.data;
  },

  start: async (modelName) => {
    const response = await client.post("/server/start", {
      model_name: modelName,
    });
    return response.data;
  },

  stop: async () => {
    const response = await client.post("/server/stop");
    return response.data;
  },

  getAvailableModels: async () => {
    const response = await client.get("/server/models");
    return response.data;
  },
};

// Providers API
export const providersApi = {
  list: async () => {
    const response = await client.get("/providers/");
    return response.data;
  },

  getCurrent: async () => {
    const response = await client.get("/providers/current");
    return response.data;
  },

  select: async (providerName) => {
    const response = await client.post("/providers/select", {
      provider_name: providerName,
    });
    return response.data;
  },

  getConfig: async (providerName) => {
    const response = await client.get(`/providers/${providerName}/config`);
    return response.data;
  },

  updateConfig: async (providerName, config) => {
    const response = await client.put(`/providers/${providerName}/config`, {
      config,
    });
    return response.data;
  },

  test: async (providerName) => {
    const response = await client.post(`/providers/${providerName}/test`);
    return response.data;
  },
};

// Sync API
export const syncApi = {
  pull: async (lastSyncAt = null) => {
    const response = await client.post("/sync/pull", {
      last_sync_at: lastSyncAt,
    });
    return response.data;
  },

  push: async (changes) => {
    const response = await client.post("/sync/push", {
      changes,
    });
    return response.data;
  },

  status: async () => {
    const response = await client.get("/sync/status");
    return response.data;
  },
};

// Export API
export const exportApi = {
  drafts: async () => {
    const response = await client.get("/export/drafts");
    return response.data;
  },

  scheduledPosts: async () => {
    const response = await client.get("/export/scheduled-posts");
    return response.data;
  },

  all: async () => {
    const response = await client.get("/export/all");
    return response.data;
  },
};

export default client;
