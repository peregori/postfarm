#!/bin/bash
# Script to run the entire PostFarm application (backend + frontend)

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    # Kill backend process if running
    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${BLUE}Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill frontend process if running
    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Starting PostFarm Application${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Start Backend
echo -e "${BLUE}Starting backend...${NC}"
cd "$SCRIPT_DIR/backend"

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    pip install -r requirements.txt > /dev/null 2>&1
    touch venv/.installed
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating backend .env file...${NC}"
    cat > .env << EOF
LLAMA_CPP_SERVER_URL=http://localhost:8080
LLAMA_MODEL_NAME=default
DATABASE_URL=sqlite:///./postfarm.db
EOF
fi

# Start backend in background
echo -e "${GREEN}Backend starting on http://localhost:8000${NC}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/postfarm-backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend failed to start${NC}"
    cat /tmp/postfarm-backend.log
    exit 1
fi

# Start Frontend
echo -e "${BLUE}Starting frontend...${NC}"
cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists, install if not
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend in background
echo -e "${GREEN}Frontend starting on http://localhost:3000${NC}"
npm run dev > /tmp/postfarm-frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 2

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Frontend failed to start${NC}"
    cat /tmp/postfarm-frontend.log
    cleanup
    exit 1
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  PostFarm is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Backend:${NC}  http://localhost:8000"
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}API Docs:${NC} http://localhost:8000/docs"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"
echo -e "${YELLOW}View logs:${NC}"
echo -e "  Backend:  tail -f /tmp/postfarm-backend.log"
echo -e "  Frontend: tail -f /tmp/postfarm-frontend.log\n"

# Keep script running and wait for either process to exit
while kill -0 $BACKEND_PID 2>/dev/null && kill -0 $FRONTEND_PID 2>/dev/null; do
    sleep 1
done
