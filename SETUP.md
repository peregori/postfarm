# Quick Setup Guide

## Prerequisites

1. **llama.cpp server** must be running on `http://localhost:8080`
2. **Python 3.10+** installed
3. **Node.js 18+** and npm installed

## Step-by-Step Setup

### 1. Start llama.cpp Server

You need to have llama.cpp server running. If you haven't set it up:

```bash
# Clone llama.cpp
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
make

# Download a GGUF model (example - adjust as needed)
# Option 1: Using huggingface-cli
pip install huggingface_hub
huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF qwen2.5-7b-instruct-q5_k_m.gguf --local-dir .

# Option 2: Manual download from Hugging Face
# Visit https://huggingface.co/models?search=gguf
# Download a model that fits your system

# Start the server
./llama-server -m qwen2.5-7b-instruct-q5_k_m.gguf --port 8080
```

**Important**: Keep this terminal open and the server running.

### 2. Start Backend

Open a new terminal:

```bash
cd backend

# Option 1: Use the startup script
./run.sh

# Option 2: Manual setup
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
LLAMA_CPP_SERVER_URL=http://localhost:8080
LLAMA_MODEL_NAME=default
DATABASE_URL=sqlite:///./postfarm.db
EOF

# Start server
uvicorn app.main:app --reload --port 8000
```

Backend will be available at `http://localhost:8000`

### 3. Start Frontend

Open another new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`

## First Use

1. Open `http://localhost:3000` in your browser
2. Go to **Settings** to configure your Twitter/X and LinkedIn API credentials
3. Go to **Generate** to create your first content
4. Go to **Drafts** to edit and manage content
5. Go to **Schedule** to schedule posts

## Troubleshooting

### "LLM server not available"
- Check that llama.cpp server is running: `curl http://localhost:8080/health`
- Verify `LLAMA_CPP_SERVER_URL` in `backend/.env`

### Port already in use
- Change ports in:
  - Backend: Edit `uvicorn` command port (default 8000)
  - Frontend: Edit `vite.config.js` port (default 3000)
  - Update API URL in frontend if needed

### Model not loading
- Check model path is correct
- Verify model is GGUF format
- Check llama.cpp server logs for errors

## Next Steps

- Configure platform APIs in Settings
- Generate your first content
- Schedule posts for future publication

