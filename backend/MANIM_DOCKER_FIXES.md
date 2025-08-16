# Manim Docker Integration Fixes

## Problem Summary

The original Node.js script had several critical issues when calling Docker to run Manim:

1. **Incorrect flag ordering**: The `-o` (output) flag was placed after the input file, causing Manim to fail
2. **Invalid quality values**: Used `m` and `l` instead of valid quality flags like `medium_quality` and `low_quality`
3. **Wrong output path mapping**: The container output path didn't match the volume mount
4. **Cross-platform permission issues**: User mapping wasn't handled properly across different operating systems

## Key Fixes Applied

### 1. Fixed Docker Command Structure

**Before (incorrect):**

```bash
manim animation.py -o /output --format mp4 --quality m
```

**After (correct):**

```bash
manim -o /manim/outputs.mp4 --format mp4 --quality m temp/animation.py
```

**Key changes:**

- `-o` flag now comes BEFORE the input file
- Output path is `/manim/outputs.mp4` (Manim v0.19.0 creates the file directly)
- Quality flags use valid values: `l`, `m`, `h`, `p`, `k` (for v0.19.0)
- Input file (`temp/animation.py`) comes LAST and is in temp subdirectory

### 2. Fixed Volume Mounting

**Before:**

```bash
-v ${tempDir}:/manim:rw
-v ${outputDir}:/output:rw
```

**After:**

```bash
-v ${tempDir}:/manim/temp:rw
-v ${outputDir}:/manim:rw
```

**Why this matters:**

- Container working directory is `/manim`
- Temp files are in `/manim/temp/`
- Output file is created directly in `/manim/` as `outputs.mp4`
- Volume mounts must match the expected paths exactly

### 3. Cross-Platform User Mapping

**Linux:**

```typescript
if (process.platform === 'linux') {
  userId = (process.getuid?.() || 1000).toString();
  groupId = (process.getgid?.() || 1000).toString();
}
```

**Windows/macOS:**

```typescript
else {
  userId = '1000';
  groupId = '1000';
}
```

**Benefits:**

- Linux: Uses actual process UID/GID for proper file ownership
- Windows/macOS: Uses default values since Docker Desktop handles permissions differently
- Environment variables can override: `BACKEND_UID`, `BACKEND_GID`

### 4. Improved Output File Detection

The `findVideoFile` method now:

- Looks in the correct output directory structure
- Handles different Manim naming patterns
- Provides better error messages with available files
- Falls back to finding any MP4 file if specific patterns fail

## Testing the Fixes

### Manual Testing

Run the test scripts to verify Docker command structure:

**Windows:**

```cmd
cd backend/scripts
test-manim-docker.bat
```

**Linux/macOS:**

```bash
cd backend/scripts
chmod +x test-manim-docker.sh
./test-manim-docker.sh
```

### Expected Behavior

1. Docker container starts successfully
2. Manim renders the test animation
3. MP4 file appears in `test-outputs/` directory
4. No permission errors during video encoding

## Docker Command Breakdown

```bash
docker run --rm \
  --name manim-render-{jobId} \
  --memory 4g \
  --cpus 2 \
  --network none \
  --tmpfs /tmp:rw,noexec,nosuid,size=500m \
  --tmpfs /var/tmp:rw,noexec,nosuid,size=500m \
  -w /manim \
  -v ${tempDir}:/manim/temp:rw \
  -v ${outputDir}:/manim:rw \
  --user ${userId}:${groupId} \
  manimcommunity/manim:latest \
  manim \
  -o /manim/outputs.mp4 \
  --format mp4 \
  --quality m \
  --disable_caching \
  --flush_cache \
  temp/animation.py
```

## Environment Variables

Set these for custom user mapping:

- `BACKEND_UID`: User ID for the container (default: process UID or 1000)
- `BACKEND_GID`: Group ID for the container (default: process GID or 1000)

## Troubleshooting

### Permission Denied Errors

1. Check directory permissions: `ls -la outputs/`
2. Ensure directories are writable: `chmod 775 outputs/`
3. Check user ownership: `chown -R $USER:$USER outputs/`

### No Output File Found

1. Verify volume mounting paths match
2. Check container logs: `docker logs manim-render-{jobId}`
3. Ensure output directory exists and is writable

### Quality Flag Errors

Valid quality values for Manim Community v0.19.0:

- `k` (draft_quality) - lowest quality, fastest
- `l` (low_quality) - low quality, fast
- `m` (medium_quality) - medium quality, balanced (default)
- `h` (high_quality) - high quality, slower
- `p` (production_quality) - highest quality, slowest

## Performance Notes

- **Memory**: 4GB allocated for video encoding
- **CPU**: 2 cores allocated
- **Temp space**: 500MB tmpfs for each temp directory
- **Retry logic**: 2 attempts with quality degradation on retry
- **Timeout**: 5 minutes per render attempt
