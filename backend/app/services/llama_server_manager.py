import subprocess
import os
import signal
import psutil
import httpx
import asyncio
from typing import Optional, Dict
from pathlib import Path
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class LlamaServerManager:
    """Manages llama.cpp server process"""
    
    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.server_url = "http://localhost:8080"
        self.cache_dir = os.path.expanduser("~/Library/Caches/llama.cpp")
        self.port = 8080
        self.model_name: Optional[str] = None
        self.monitor_task: Optional[asyncio.Task] = None
        self.auto_restart_enabled = True
        self.restart_count = 0
        self.max_restarts_per_hour = 5
        self.restart_history: list[datetime] = []
        self.last_health_check: Optional[datetime] = None
        self.health_check_interval = 30  # seconds
        
    def find_llama_server(self) -> Optional[str]:
        """Find llama-server binary in PATH"""
        # Common locations
        possible_paths = [
            "llama-server",
            "llama-cpp-server",
            os.path.expanduser("~/.local/bin/llama-server"),
            "/usr/local/bin/llama-server",
        ]
        
        # Check PATH
        for path in os.environ.get("PATH", "").split(os.pathsep):
            possible_paths.append(os.path.join(path, "llama-server"))
        
        for path in possible_paths:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
        
        # Try to find in common llama.cpp build directories
        home = os.path.expanduser("~")
        possible_dirs = [
            os.path.join(home, "llama.cpp", "build", "bin", "llama-server"),
            os.path.join(home, "llama.cpp", "llama-server"),
            "/opt/llama.cpp/llama-server",
        ]
        
        for path in possible_dirs:
            if os.path.isfile(path) and os.access(path, os.X_OK):
                return path
        
        return None
    
    def get_available_models(self) -> list:
        """Get list of available GGUF models"""
        models = []
        if os.path.exists(self.cache_dir):
            for file in os.listdir(self.cache_dir):
                if file.endswith(".gguf"):
                    model_path = os.path.join(self.cache_dir, file)
                    models.append({
                        "name": file,
                        "path": model_path,
                        "size": os.path.getsize(model_path) if os.path.exists(model_path) else 0
                    })
        return sorted(models, key=lambda x: x["name"])
    
    def is_server_running(self) -> bool:
        """Check if llama.cpp server is running"""
        # Check if we have a process
        if self.process and self.process.poll() is None:
            return True
        
        # Check if port is in use
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'llama-server' in ' '.join(cmdline):
                        # Check if it's listening on our port
                        connections = proc.connections()
                        for conn in connections:
                            if conn.status == psutil.CONN_LISTEN and conn.laddr.port == self.port:
                                return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            logger.error(f"Error checking server status: {e}")
        
        # Try HTTP check
        try:
            response = httpx.get(f"{self.server_url}/health", timeout=2.0)
            return response.status_code == 200
        except:
            pass
        
        return False
    
    async def start_server(self, model_name: str) -> Dict:
        """Start llama.cpp server with specified model"""
        if self.is_server_running():
            return {
                "success": False,
                "message": "Server is already running",
                "status": "running"
            }
        
        # Find model
        model_path = os.path.join(self.cache_dir, model_name)
        if not os.path.exists(model_path):
            return {
                "success": False,
                "message": f"Model not found: {model_path}",
                "status": "error"
            }
        
        # Find llama-server binary
        server_binary = self.find_llama_server()
        if not server_binary:
            return {
                "success": False,
                "message": "llama-server binary not found. Please ensure llama.cpp is installed and llama-server is in your PATH.",
                "status": "error"
            }
        
        try:
            # Start server process
            self.process = subprocess.Popen(
                [
                    server_binary,
                    "--model", model_path,
                    "--port", str(self.port),
                    "--host", "0.0.0.0",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid if os.name != 'nt' else None
            )
            
            # Wait a moment to see if it starts successfully
            import asyncio
            await asyncio.sleep(2)
            
            if self.process.poll() is not None:
                # Process died
                stdout, stderr = self.process.communicate()
                return {
                    "success": False,
                    "message": f"Server failed to start: {stderr.decode() if stderr else 'Unknown error'}",
                    "status": "error"
                }
            
            # Verify it's actually running
            if self.is_server_running():
                self.model_name = model_name
                # Start health monitoring if enabled
                if self.auto_restart_enabled:
                    self._start_monitoring()
                return {
                    "success": True,
                    "message": f"Server started successfully with model: {model_name}",
                    "status": "running",
                    "pid": self.process.pid
                }
            else:
                return {
                    "success": False,
                    "message": "Server process started but not responding",
                    "status": "error"
                }
                
        except Exception as e:
            logger.error(f"Error starting server: {e}")
            return {
                "success": False,
                "message": f"Failed to start server: {str(e)}",
                "status": "error"
            }
    
    def _can_restart(self) -> bool:
        """Check if we can restart (rate limiting)"""
        now = datetime.now()
        # Clean old restart history (older than 1 hour)
        self.restart_history = [
            rt for rt in self.restart_history
            if now - rt < timedelta(hours=1)
        ]
        
        # Check if we've exceeded max restarts per hour
        if len(self.restart_history) >= self.max_restarts_per_hour:
            logger.warning(f"Max restarts per hour ({self.max_restarts_per_hour}) exceeded")
            return False
        
        return True
    
    async def _monitor_health(self):
        """Monitor server health and auto-restart on crash"""
        while self.auto_restart_enabled:
            try:
                await asyncio.sleep(self.health_check_interval)
                
                if not self.model_name:
                    # No model started, nothing to monitor
                    continue
                
                is_running = self.is_server_running()
                
                if not is_running:
                    # Check if we have a process that died
                    if self.process and self.process.poll() is not None:
                        # Process crashed or stopped unexpectedly
                        logger.warning("Server process appears to have crashed")
                        
                        # Clear the process reference
                        self.process = None
                        
                        # Check if we can restart
                        if not self._can_restart():
                            logger.error("Cannot auto-restart: rate limit exceeded")
                            self.model_name = None  # Clear model to stop monitoring
                            continue
                        
                        # Attempt auto-restart
                        if self.model_name:
                            logger.info(f"Attempting to auto-restart server with model: {self.model_name}")
                            self.restart_history.append(datetime.now())
                            saved_model = self.model_name
                            result = await self.start_server(saved_model)
                            
                            if result.get("success"):
                                logger.info("Server auto-restarted successfully")
                                self.restart_count += 1
                            else:
                                logger.error(f"Auto-restart failed: {result.get('message')}")
                                # If restart fails, don't keep trying immediately
                                # Wait for next check cycle
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitor: {e}")
                await asyncio.sleep(self.health_check_interval)
    
    def _start_monitoring(self):
        """Start health monitoring task"""
        if self.monitor_task and not self.monitor_task.done():
            return  # Already monitoring
        
        self.monitor_task = asyncio.create_task(self._monitor_health())
        logger.info("Health monitoring started")
    
    def _stop_monitoring(self):
        """Stop health monitoring task"""
        if self.monitor_task and not self.monitor_task.done():
            self.monitor_task.cancel()
            logger.info("Health monitoring stopped")
    
    async def stop_server(self) -> Dict:
        """Stop llama.cpp server"""
        self._stop_monitoring()
        stopped = False
        
        # Stop our managed process
        if self.process:
            try:
                if os.name != 'nt':
                    os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
                else:
                    self.process.terminate()
                self.process.wait(timeout=5)
                stopped = True
            except Exception as e:
                logger.error(f"Error stopping process: {e}")
                try:
                    if os.name != 'nt':
                        os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                    else:
                        self.process.kill()
                    stopped = True
                except:
                    pass
            finally:
                self.process = None
                self.model_name = None
        
        # Also try to find and kill any other llama-server on our port
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'llama-server' in ' '.join(cmdline):
                        connections = proc.connections()
                        for conn in connections:
                            if conn.status == psutil.CONN_LISTEN and conn.laddr.port == self.port:
                                proc.terminate()
                                proc.wait(timeout=3)
                                stopped = True
                                break
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                    continue
        except Exception as e:
            logger.error(f"Error finding server process: {e}")
        
        if stopped:
            return {
                "success": True,
                "message": "Server stopped successfully",
                "status": "stopped"
            }
        else:
            return {
                "success": False,
                "message": "No server process found to stop",
                "status": "stopped"
            }
    
    async def get_server_status(self) -> Dict:
        """Get current server status"""
        is_running = self.is_server_running()
        
        status = {
            "running": is_running,
            "url": self.server_url,
            "port": self.port,
            "pid": self.process.pid if self.process and self.process.poll() is None else None,
            "model": self.model_name,
            "auto_restart": self.auto_restart_enabled,
            "restart_count": self.restart_count,
        }
        
        # Get resource usage if process is running
        if self.process and self.process.poll() is None:
            try:
                proc = psutil.Process(self.process.pid)
                status["resources"] = {
                    "cpu_percent": proc.cpu_percent(),
                    "memory_mb": proc.memory_info().rss / 1024 / 1024,
                    "num_threads": proc.num_threads(),
                }
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        # Try to get model info from API if server is running
        if is_running:
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    response = await client.get(f"{self.server_url}/v1/models")
                    if response.status_code == 200:
                        data = response.json()
                        if "data" in data and len(data["data"]) > 0:
                            status["model"] = data["data"][0].get("id", self.model_name or "unknown")
            except:
                pass
        
        return status

# Global instance
server_manager = LlamaServerManager()

