# HandPost - Local Content Management & Scheduling

A full-stack local application for generating, editing, and scheduling social media content using local GGUF LLMs with llama.cpp. Inspired by LangChain's AgentInbox, HandPost provides a modern interface for content creation and management.

## Features

- 🤖 **Local LLM Integration**: Generate content using local GGUF models via llama.cpp
- ✍️ **Draft Management**: Create, edit, and manage content drafts
- 📅 **Scheduling**: Schedule posts for Twitter/X and LinkedIn with calendar view
- 🔄 **Multi-Platform Support**: Post to Twitter/X and LinkedIn (extensible to more platforms)
- 💾 **Local-First**: All data and processing stays on your machine
- 🎨 **Modern UI**: Clean, AgentInbox-inspired interface built with React

## Architecture

### Backend (FastAPI)
- **API Server**: RESTful API for all operations
- **LLM Service**: Integration with llama.cpp server for content generation
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
3. **llama.cpp server** running locally
   - Download and build from [llama.cpp](https://github.com/ggml-org/llama.cpp)
   - Or use pre-built binaries
   - Download a GGUF model from Hugging Face

## Setup

### 1. Start llama.cpp Server

First, you need to have llama.cpp server running. The app will automatically detect models in `~/Library/Caches/llama.cpp`.

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
DATABASE_URL=sqlite:///./handpost.db
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

### 1. Configure Platform APIs

Before scheduling posts, you need to configure your platform credentials:

1. Go to **Settings** in the app
2. Select a platform (Twitter/X or LinkedIn)
3. Enter your API credentials:
   - **Twitter/X**: Bearer Token from Twitter Developer Portal
   - **LinkedIn**: Organization ID and Access Token
4. Test the connection
5. Enable the platform

### 2. Generate Content

1. Go to **Generate** page
2. Enter a prompt describing the content you want
3. Adjust temperature and max tokens if needed
4. Click "Generate Content"
5. Review and edit the generated content
6. Save as draft or schedule directly

### 3. Manage Drafts

1. Go to **Drafts** page
2. View all your saved drafts
3. Click on a draft to edit
4. Save changes or schedule for posting

### 4. Schedule Posts

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
LLAMA_CPP_SERVER_URL=http://localhost:8080
LLAMA_MODEL_NAME=default
DATABASE_URL=sqlite:///./handpost.db
```

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

The database is SQLite located at `backend/handpost.db`. You can inspect it with any SQLite tool:

```bash
sqlite3 backend/handpost.db
```

## Troubleshooting

### LLM Server Not Available

- Ensure llama.cpp server is running on port 8080
- Check `LLAMA_CPP_SERVER_URL` in `.env` matches your server
- Verify the server is accessible: `curl http://localhost:8080/health`

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

