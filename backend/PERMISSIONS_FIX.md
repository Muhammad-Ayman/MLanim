# Fixing Docker Permission Issues in MLanim

## Problem

The error `Permission denied during video encoding` occurs when the Manim Docker container cannot write to the output directory. This is typically caused by **Docker-in-Docker** permission issues.

## Root Cause

**The main issue is Docker-in-Docker (DinD):**

- Your backend container runs as user `nodejs` (UID 1001) **inside Docker**
- From **inside that container**, you're trying to spawn a Manim Docker container
- The Manim container needs to mount volumes that are already mounted into the backend container
- Permission issues occur because the backend container doesn't have the right permissions to spawn other containers

## Solutions

### 1. Docker-in-Docker Setup (Recommended)

**Linux/macOS:**

```bash
chmod +x backend/scripts/setup-docker-in-docker.sh
./backend/scripts/setup-docker-in-docker.sh
```

**Windows:**

```cmd
backend\scripts\setup-docker-in-docker.bat
```

### 2. Alternative: Run Backend Locally

Instead of running the backend in Docker, run it locally:

```bash
cd backend
npm install
npm run dev
```

This avoids Docker-in-Docker entirely.

### 3. Manual Docker-in-Docker Fix

#### Linux/macOS:

```bash
# Add your user to the docker group
sudo usermod -aG docker $USER

# Create directories with proper permissions
mkdir -p outputs temp logs
sudo chown -R $USER:$USER outputs temp logs
sudo chmod -R 755 outputs temp logs
sudo chmod -R 775 outputs

# Log out and back in for group changes to take effect
```

#### Windows:

- Ensure Docker Desktop is running as Administrator
- Enable WSL2 integration in Docker Desktop
- Ensure the project is in a WSL2-accessible location

## How Docker-in-Docker Works

### Before (Broken):

```
Host System → Backend Container (nodejs:1001) → Manim Container
     ↓              ↓                              ↓
  /outputs    /app/outputs (mounted)         /output (mounted)
```

### After (Fixed):

```
Host System → Backend Container (nodejs:1001) → Manim Container
     ↓              ↓                              ↓
  /outputs    /app/outputs (mounted)         /output (mounted)
     ↓              ↓                              ↓
Docker Socket → /var/run/docker.sock → Spawn containers
```

## Configuration Changes Made

### 1. Updated `docker-compose.yml`

- Added Docker socket mount: `/var/run/docker.sock:/var/run/docker.sock:rw`
- Added `DOCKER_HOST` environment variable
- Explicit read-write permissions on volumes

### 2. Updated `backend/Dockerfile`

- Installed `docker-cli` package
- Allows the container to spawn other containers

### 3. Updated `manimRendererService.ts`

- Detects Docker-in-Docker scenarios
- Uses host paths for volume mounting
- Mounts Docker socket when needed

## Verification

After fixing, verify the setup:

```bash
# Check Docker socket permissions
ls -la /var/run/docker.sock

# Test Docker-in-Docker
docker run --rm alpine:latest echo "test"

# Test volume mounting
docker run --rm -v "$(pwd)/outputs:/output:rw" alpine:latest sh -c "echo 'test' > /output/test.txt"
```

## Troubleshooting

### Still getting permission errors?

1. **Check Docker socket permissions:**

   ```bash
   ls -la /var/run/docker.sock
   # Should show: srw-rw-rw- 1 root docker 0
   ```

2. **Verify user is in docker group:**

   ```bash
   groups $USER
   # Should include 'docker'
   ```

3. **Check Docker Desktop settings (Windows):**
   - Run as Administrator
   - Enable WSL2 integration
   - Use WSL2 backend

4. **Restart Docker:**
   ```bash
   sudo systemctl restart docker  # Linux
   # Or restart Docker Desktop on Windows
   ```

### Container user mismatch?

The service automatically retries with root user (`--user 0:0`) on permission failures, but this is not recommended for production.

## Production Considerations

- **Security**: Running as root (retry fallback) is not recommended for production
- **User namespaces**: Consider implementing proper Docker user namespaces
- **Volume management**: Use Docker volumes instead of bind mounts for better isolation
- **Alternative**: Consider running the backend service directly on the host instead of in Docker

## Support

If issues persist, check:

1. Docker logs: `docker logs mlanim-backend`
2. Docker socket permissions: `ls -la /var/run/docker.sock`
3. User group membership: `groups $USER`
4. Docker Desktop settings (Windows)
5. WSL2 configuration (Windows)

## Quick Test

Run this command to test if everything is working:

```bash
# Test the complete flow
curl -X POST http://localhost:3001/api/animation/render \
  -H "Content-Type: application/json" \
  -d '{"code": "from manim import *\nclass TestScene(Scene):\n    def construct(self):\n        circle = Circle()\n        self.play(Create(circle))"}'
```
