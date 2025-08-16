# Docker Permission Issues - Fix Summary

## Problem Identified

The error `Permission denied during video encoding` was occurring because of **Docker-in-Docker (DinD)** permission issues:

1. **Docker-in-Docker Problem**: The backend container runs as user `nodejs` (UID 1001) **inside Docker**
2. **Container Spawning**: From **inside that container**, you're trying to spawn a Manim Docker container
3. **Volume Mounting**: The Manim container needs to mount volumes that are already mounted into the backend container
4. **Permission Mismatch**: The backend container doesn't have the right permissions to spawn other containers

## Root Cause Analysis

The issue wasn't just directory permissions - it was the fundamental architecture:

```
❌ BROKEN: Host → Backend Container → Manim Container
    (Backend container can't spawn other containers easily)

✅ FIXED: Host → Backend Container → Manim Container
    (Backend container has access to Docker socket)
```

## Changes Made

### 1. **Updated `docker-compose.yml`**

- **Docker socket mount**: `/var/run/docker.sock:/var/run/docker.sock:rw`
- **Environment variable**: `DOCKER_HOST=unix:///var/run/docker.sock`
- **Volume permissions**: Explicit `:rw` on all volume mounts

### 2. **Updated `backend/Dockerfile`**

- **Docker CLI installation**: Added `docker-cli` package
- **Container capability**: Backend container can now spawn other containers

### 3. **Updated `manimRendererService.ts`**

- **Docker-in-Docker detection**: Automatically detects when running in container
- **Host path handling**: Uses correct paths for volume mounting
- **Socket mounting**: Mounts Docker socket when needed

### 4. **Created Docker-in-Docker Setup Scripts**

- **`setup-docker-in-docker.sh`**: Linux/macOS setup script
- **`setup-docker-in-docker.bat`**: Windows setup script
- **Comprehensive testing**: Verifies Docker-in-Docker capability

## How the Fix Works

### **First Attempt (Container Mode)**

1. Detects Docker-in-Docker scenario
2. Mounts Docker socket for container spawning
3. Uses host paths for volume mounting
4. Runs Manim container as backend user (1001:1001)

### **Retry Logic (if first attempt fails)**

1. Manim container runs as root user (0:0)
2. Bypasses permission issues
3. Ensures animation renders successfully
4. Not recommended for production but provides fallback

### **Automatic Detection**

1. Service detects the current execution context
2. Adjusts volume paths and Docker arguments accordingly
3. Handles both local and containerized execution

## Files Modified

```
backend/src/services/manimRendererService.ts     - Docker-in-Docker handling
docker-compose.yml                              - Docker socket & volume mounts
backend/Dockerfile                              - Docker CLI installation
```

## Files Created

```
backend/scripts/setup-docker-in-docker.sh      - Linux/macOS DinD setup
backend/scripts/setup-docker-in-docker.bat     - Windows DinD setup
backend/PERMISSIONS_FIX.md                     - Updated fix guide
PERMISSION_FIX_SUMMARY.md                      - This summary
```

## Usage

### **Quick Fix (Recommended)**

```bash
# Linux/macOS
chmod +x backend/scripts/setup-docker-in-docker.sh
./backend/scripts/setup-docker-in-docker.sh

# Windows
backend\scripts\setup-docker-in-docker.bat
```

### **Alternative: Run Backend Locally**

```bash
cd backend
npm install
npm run dev
```

This avoids Docker-in-Docker entirely.

### **Test the Fix**

```bash
# Test Docker-in-Docker capability
docker run --rm alpine:latest echo "test"

# Test volume mounting
docker run --rm -v "$(pwd)/outputs:/output:rw" alpine:latest sh -c "echo 'test' > /output/test.txt"
```

## Expected Results

After applying the fixes:

1. ✅ Backend container can spawn Manim containers
2. ✅ No more "Permission denied" errors
3. ✅ Animations render successfully
4. ✅ Proper Docker-in-Docker handling
5. ✅ Automatic fallback if issues occur

## Production Considerations

- **Security**: Running as root (retry fallback) is not recommended for production
- **Architecture**: Consider running backend service directly on host instead of in Docker
- **User namespaces**: Implement proper Docker user namespaces for production
- **Volume management**: Use Docker volumes instead of bind mounts for better isolation

## Troubleshooting

If issues persist:

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

4. **Test Docker-in-Docker:**
   ```bash
   docker run --rm alpine:latest echo "test"
   ```

## Key Insight

**The main issue wasn't directory permissions - it was Docker-in-Docker architecture.**

The backend container needs access to the Docker socket to spawn other containers, and the volume paths need to be correctly mapped between the host system and the nested containers.

## Next Steps

1. **Run the Docker-in-Docker setup script**
2. **Test with a simple animation**
3. **Monitor logs for any remaining issues**
4. **Consider production architecture alternatives**
5. **Document any additional issues that arise**
