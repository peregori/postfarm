# PostFarm - Local Content Management & Scheduling

A full-stack local application for generating, editing, and scheduling social media content using local GGUF LLMs with llama.cpp. Inspired by LangChain's AgentInbox, PostFarm provides a modern interface for content creation and management.

## Features

- 🤖 **Flexible AI Integration**: Generate content using local GGUF models via llama.cpp or Google Gemini API
- ✍️ **Draft Management**: Create, edit, and manage content drafts
- 📅 **Scheduling**: Schedule posts for Twitter/X and LinkedIn with calendar view
- 🔄 **Multi-Platform Support**: Post to Twitter/X and LinkedIn (extensible to more platforms)
- 💾 **Privacy Options**: Choose between fully local processing (llama.cpp) or cloud AI (Google Gemini)
- 🎨 **Modern UI**: Clean, AgentInbox-inspired interface built with React

## Architecture

### Backend (FastAPI)
- **API Server**: RESTful API for all operations
- **AI Provider System**: Pluggable architecture supporting multiple AI providers:
  - **Llama.cpp**: Local GGUF models for privacy-focused generation
  - **Google Gemini**: Cloud-based AI with latest models (Gemini 2.0/2.5)
- **Scheduler**: Background job scheduler for automated posting
- **Platform Services**: Twitter/X and LinkedIn API integration
- **Database**: SQLite for local data storage

### Frontend (React + Vite)
- **Dashboard**: Overview of drafts, scheduled posts, and LLM status
- **Generate**: Content generation interface with customizable parameters
- **Drafts**: Draft editor with search and management
- **Schedule**: Calendar-based scheduling interface
- **Settings**: Platform API configuration

## Prerequisites

1. **Python 3.10+**
2. **Node.js 18+** and npm
3. **AI Provider** (choose one or both):
   - **Llama.cpp** (for local models): Download and build from [llama.cpp](https://github.com/ggml-org/llama.cpp) or use pre-built binaries
   - **Google Gemini** (cloud): Get API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

### 1. Choose Your AI Provider

#### Option A: Llama.cpp (Local, Private)

Start llama.cpp server. The app will automatically detect models in `~/Library/Caches/llama.cpp`.

**Using your existing setup:**

```bash
# Use your llama-serve function to select and start a model
llama-serve

# Or manually specify a model
llama-server --model "$LLAMA_CACHE_DIR/your-model.gguf" --port 8080
```

**Manual setup (if not using the aliases):**

```bash
# Download a GGUF model (example)
huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF qwen2.5-7b-instruct-q5_k_m.gguf --local-dir ~/Library/Caches/llama.cpp

# Start the server
llama-server --model ~/Library/Caches/llama.cpp/qwen2.5-7b-instruct-q5_k_m.gguf --port 8080
```

The server should be running on `http://localhost:8080` and provide an OpenAI-compatible API at `/v1/chat/completions`.

#### Option B: Google Gemini (Cloud, Latest Models)

1. Get your API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Configure it in the app's Settings page under "AI Provider"
3. Select from models: Gemini 2.0 Flash (recommended), 2.0 Flash Lite, 2.5 Flash, or 2.5 Pro

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (optional)
cat > .env << EOF
LLAMA_CPP_SERVER_URL=http://localhost:8080
LLAMA_MODEL_NAME=default
DATABASE_URL=sqlite:///./postfarm.db
EOF

# Run the server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Usage

### 1. Configure AI Provider

1. Go to **Settings** in the app
2. Under "AI Provider", select either:
   - **Llama.cpp**: For local, private content generation
   - **Google Gemini**: For cloud-based generation with latest models
3. If using Google Gemini:
   - Enter your API key from [Google AI Studio](https://aistudio.google.com/apikey)
   - Select your preferred model (Gemini 2.0 Flash recommended)
   - Click "Test Connection" to verify
4. If using Llama.cpp:
   - Ensure the server is running on port 8080
   - Select a model from the model selector

### 2. Configure Platform APIs

Before scheduling posts, you need to configure your platform credentials:

1. Go to **Settings** in the app
2. Select a platform (Twitter/X or LinkedIn)
3. Enter your API credentials:
   - **Twitter/X**: Bearer Token from Twitter Developer Portal
   - **LinkedIn**: Organization ID and Access Token
4. Test the connection
5. Enable the platform

### 3. Generate Content

1. Go to **Generate** page
2. Enter a prompt describing the content you want
3. Adjust temperature and max tokens if needed
4. Click "Generate Content" (uses your selected AI provider)
5. Review and edit the generated content
6. Save as draft or schedule directly

### 4. Manage Drafts

1. Go to **Drafts** page
2. View all your saved drafts
3. Click on a draft to edit
4. Save changes or schedule for posting

### 5. Schedule Posts

1. Go to **Schedule** page
2. Select a draft or create new content
3. Choose platform (Twitter/X or LinkedIn)
4. Set date and time
5. Click "Schedule Post"

Scheduled posts will automatically be published at the specified time.

## API Endpoints

### LLM
- `POST /api/llm/generate` - Generate content from prompt
- `POST /api/llm/edit` - Edit existing content
- `GET /api/llm/health` - Check LLM server status

### Drafts
- `GET /api/drafts/` - List all drafts
- `GET /api/drafts/{id}` - Get specific draft
- `POST /api/drafts/` - Create new draft
- `PUT /api/drafts/{id}` - Update draft
- `DELETE /api/drafts/{id}` - Delete draft

### Scheduler
- `POST /api/scheduler/schedule` - Schedule a post
- `POST /api/scheduler/{id}/cancel` - Cancel scheduled post
- `GET /api/scheduler/calendar` - Get calendar view

### Platforms
- `GET /api/platforms/` - List platform configurations
- `GET /api/platforms/{platform}` - Get platform config
- `PUT /api/platforms/{platform}` - Update platform config
- `POST /api/platforms/{platform}/test` - Test connection
- `POST /api/platforms/{platform}/publish` - Publish immediately

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Default AI provider (llamacpp or google)
AI_PROVIDER=llamacpp

# Llama.cpp configuration (if using local models)
LLAMA_CPP_SERVER_URL=http://localhost:8080
LLAMA_MODEL_NAME=default

# Database
DATABASE_URL=sqlite:///./postfarm.db
```

Note: Google Gemini API keys are configured through the Settings UI, not environment variables.

### Model Detection

The app automatically detects all `.gguf` models in `~/Library/Caches/llama.cpp`. You can:
- View available models in the **Settings** page
- Models are automatically detected when you place them in the cache directory
- Use your existing `llama-models`, `llama-use`, and `llama-serve` functions

### Model Recommendations

For content generation, recommended models:
- **Qwen2.5-7B-Instruct-GGUF** (balanced performance)
- **Mistral-7B-Instruct-GGUF** (good quality)
- **Llama-2-7B-Chat-GGUF** (general purpose)

Use Q4_K_M or Q5_K_M quantization for good balance of quality and speed. You can download models using your `llama-download` function.

## Development

### Backend Development

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Database

The database is SQLite located at `backend/postfarm.db`. You can inspect it with any SQLite tool:

```bash
sqlite3 backend/postfarm.db
```

## Troubleshooting

### AI Provider Issues

**For Llama.cpp:**
- Ensure llama.cpp server is running on port 8080
- Check `LLAMA_CPP_SERVER_URL` in `.env` matches your server
- Verify the server is accessible: `curl http://localhost:8080/health`

**For Google Gemini:**
- Verify your API key is valid at [Google AI Studio](https://aistudio.google.com/apikey)
- Check that you've selected a model in Settings
- Use "Test Connection" button to verify connectivity
- Ensure you have API quota available

### Posts Not Publishing

- Check platform API credentials in Settings
- Verify platform is enabled
- Check scheduler service is running (it starts automatically with backend)
- Review error messages in scheduled posts

### Content Generation Issues

- Verify your GGUF model supports chat completions
- Check model is loaded correctly in llama.cpp server
- Adjust temperature and max_tokens if content quality is poor

## License

MIT License - feel free to use and modify for your needs.

## Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

