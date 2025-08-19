import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config, getOutputPath } from '../config';
import { logger } from '../utils/logger';
import { JobLogger } from '../utils/jobLogger';

interface RenderResult {
  outputPath: string;
  duration: number;
}

interface ManimOutput {
  type: 'stdout' | 'stderr' | 'progress' | 'info';
  data: string;
  timestamp: Date;
}

export class ManimRendererService {
  private readonly dockerImage = 'manimcommunity/manim:latest';
  private readonly containerTimeout = 3000000; // 5 minutes - increased for complex animations
  private readonly maxRetries = 1; // Let LLM regeneration handle subsequent attempts

  /**
   * Render a Manim animation using Docker for safety
   */
  async renderAnimation(
    code: string,
    jobId: string,
    onOutput?: (output: ManimOutput) => void
  ): Promise<RenderResult> {
    const startTime = Date.now();
    const tempDir = path.join(process.cwd(), 'temp', jobId);
    const outputDir = path.join(process.cwd(), 'outputs', jobId);

    try {
      // Create temporary and output directories
      await this.ensureDirectories(tempDir, outputDir);

      // Ensure proper permissions for Docker mounting
      await this.ensureDirectoryPermissions(tempDir, outputDir);

      // Validate the Manim code for potential issues
      this.validateManimCode(code);

      // Write the Manim code to a temporary file
      const codeFilePath = path.join(tempDir, 'animation.py');
      await fs.writeFile(codeFilePath, code, 'utf8');
      await JobLogger.append(jobId, 'Wrote code to temp file', { codeFilePath });

      // Try rendering with retry logic
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            logger.info(`Retrying Manim render (attempt ${attempt}/${this.maxRetries})`, { jobId });
            if (onOutput) {
              onOutput({
                type: 'info',
                data: `Retrying render (attempt ${attempt}/${this.maxRetries})`,
                timestamp: new Date(),
              });
            }
          }

          // Render using Docker
          const result = await this.renderWithDocker(tempDir, outputDir, jobId, onOutput, attempt);

          const duration = Date.now() - startTime;
          logger.info('Animation rendered successfully', {
            jobId,
            duration,
            outputPath: result.outputPath,
            attempts: attempt,
          });

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(`Manim render attempt ${attempt} failed`, {
            jobId,
            error: lastError.message,
          });

          if (attempt < this.maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // All attempts failed
      const duration = Date.now() - startTime;
      logger.error('All Manim render attempts failed', {
        jobId,
        error: lastError?.message,
        duration,
        attempts: this.maxRetries,
      });
      throw lastError || new Error('All render attempts failed');
    } finally {
      // Clean up temporary files
      await this.cleanupTempFiles(tempDir);
    }
  }

  /**
   * Render animation using Docker container
   */
  private async renderWithDocker(
    tempDir: string,
    outputDir: string,
    jobId: string,
    onOutput?: (output: ManimOutput) => void,
    attempt: number = 1
  ): Promise<RenderResult> {
    return new Promise((resolve, reject) => {
      const containerName = `manim-render-${jobId}`;

      // Check if we're running inside a Docker container
      const isRunningInContainer = this.isRunningInDockerContainer();

      // Docker run command for Manim - with proper flag ordering
      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        containerName,
        '--memory',
        '4g', // Increased memory for video encoding
        '--cpus',
        '2',
        '--network',
        'none', // Isolate network
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=500m', // Increased temp space
        '--tmpfs',
        '/var/tmp:rw,noexec,nosuid,size=500m', // Additional temp space
        '-w',
        '/manim',
        this.dockerImage,
        'manim',
        '-o',
        '/manim/outputs.mp4', // Output file - Manim v0.19.0 creates the file directly
        '--format',
        'mp4',
        '--quality',
        attempt === 1 ? 'm' : 'l', // Use valid quality values for v0.19.0: l, m, h, p, k
        '--disable_caching', // Disable caching to avoid conflicts
        '--flush_cache', // Flush cache before rendering
        'temp/animation.py', // Input file comes LAST, now in temp subdirectory
      ];

      // Handle Docker-in-Docker scenario
      if (isRunningInContainer) {
        // We're running inside a container, need to use host paths
        // Mount the Docker socket to allow spawning containers
        dockerArgs.splice(6, 0, '-v', '/var/run/docker.sock:/var/run/docker.sock');

        // Use host paths for volumes (these are the paths on the host system)
        const hostTempDir = tempDir.replace('/app/', './');
        const hostOutputDir = outputDir.replace('/app/', './');

        dockerArgs.splice(8, 0, '-v', `${hostTempDir}:/manim/temp:rw`);
        // Mount output directory to /manim so the output file appears there
        dockerArgs.splice(10, 0, '-v', `${hostOutputDir}:/manim:rw`);

        logger.debug('Running in Docker-in-Docker mode with host paths', {
          hostTempDir,
          hostOutputDir,
          jobId,
          isRunningInContainer,
        });
      } else {
        // Running locally, use direct paths
        dockerArgs.splice(6, 0, '-v', `${tempDir}:/manim/temp:rw`);
        // Mount output directory to /manim so the output file appears there
        dockerArgs.splice(8, 0, '-v', `${outputDir}:/manim:rw`);

        logger.debug('Running in local mode with direct paths', {
          tempDir,
          outputDir,
          jobId,
          isRunningInContainer,
        });
      }

      // Handle user mapping for cross-platform compatibility
      if (attempt > 1) {
        // For retry attempts, run as root to bypass permission issues
        dockerArgs.splice(6, 0, '--user', '0:0');
        logger.debug('Retrying with root user for permission issues', {
          jobId,
          attempt,
        });
      } else {
        // First attempt: try to run as the same user as the backend process
        try {
          // Cross-platform user ID handling
          let userId: string;
          let groupId: string;

          if (process.platform === 'linux') {
            // On Linux, use actual process UID/GID
            userId = (process.getuid?.() || 1000).toString();
            groupId = (process.getgid?.() || 1000).toString();
          } else {
            // On Windows/macOS, use default values since Docker Desktop handles permissions differently
            userId = '1000';
            groupId = '1000';
          }

          // Override with environment variables if set
          userId = process.env.BACKEND_UID || userId;
          groupId = process.env.BACKEND_GID || groupId;

          dockerArgs.splice(6, 0, '--user', `${userId}:${groupId}`);

          logger.debug('Running Manim container with user mapping', {
            uid: userId,
            gid: groupId,
            platform: process.platform,
            jobId,
          });
        } catch (error) {
          logger.warn('Failed to set user mapping, running as default', {
            error,
            jobId,
          });
        }
      }

      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;
      let timeoutId: NodeJS.Timeout;

      // Set up timeout handler
      timeoutId = setTimeout(async () => {
        if (!isResolved) {
          isResolved = true;
          logger.warn('Docker process timed out, killing container', { jobId, containerName });

          try {
            // Kill the Docker container forcefully
            const killProcess = spawn('docker', ['kill', containerName]);
            await new Promise<void>(resolveKill => {
              killProcess.on('close', () => {
                logger.debug('Container killed due to timeout', { jobId, containerName });
                resolveKill();
              });
            });

            // Also kill the spawn process
            try {
              dockerProcess.kill('SIGKILL');
            } catch (error) {
              logger.debug('Failed to kill spawn process', { jobId, error });
            }

            // Clean up temporary files
            try {
              await fs.rm(tempDir, { recursive: true, force: true });
              logger.debug('Cleaned up temp directory after timeout', { jobId, tempDir });
            } catch (cleanupError) {
              logger.warn('Failed to cleanup temp directory after timeout', {
                jobId,
                cleanupError,
              });
            }

            reject(new Error('Docker process timed out after 5 minutes'));
          } catch (timeoutError) {
            logger.error('Error during timeout cleanup', { jobId, timeoutError });
            reject(new Error('Docker process timed out and cleanup failed'));
          }
        }
      }, this.containerTimeout);

      dockerProcess.stdout?.on('data', data => {
        const output = data.toString();
        stdout += output;
        JobLogger.append(jobId, 'stdout', { chunk: output.substring(0, 1000) }).catch(() => {});

        // Parse Manim progress information with more comprehensive patterns
        const progressMatch = output.match(/Rendering\s+(\d+)\/(\d+)\s+frames/);
        const sceneMatch = output.match(/Scene\s+(\w+)/);
        const animationMatch = output.match(/Animation\s+(\d+)\/(\d+)/);
        const fileMatch = output.match(/Writing\s+(\S+)/);
        const frameMatch = output.match(/Frame\s+(\d+)/);
        const timeMatch = output.match(/(\d+\.\d+)s/);
        const qualityMatch = output.match(/quality\s+(\w+)/i);
        const formatMatch = output.match(/format\s+(\w+)/i);

        // Additional Manim progress patterns
        const renderingMatch = output.match(/Rendering\s+(\w+)/);
        const processingMatch = output.match(/Processing\s+(\w+)/);
        const buildingMatch = output.match(/Building\s+(\w+)/);
        const compilingMatch = output.match(/Compiling\s+(\w+)/);

        if (progressMatch) {
          const currentFrame = parseInt(progressMatch[1]);
          const totalFrames = parseInt(progressMatch[2]);
          const progressPercent = Math.round((currentFrame / totalFrames) * 100);

          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Rendering frame ${currentFrame}/${totalFrames} (${progressPercent}%)`,
              timestamp: new Date(),
            });
          }
        } else if (sceneMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Processing scene: ${sceneMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (animationMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Processing animation ${animationMatch[1]}/${animationMatch[2]}`,
              timestamp: new Date(),
            });
          }
        } else if (renderingMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Rendering: ${renderingMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (processingMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Processing: ${processingMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (buildingMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Building: ${buildingMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (compilingMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Compiling: ${compilingMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (fileMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Writing file: ${fileMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (frameMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Processing frame ${frameMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (timeMatch) {
          if (onOutput) {
            onOutput({
              type: 'progress',
              data: `Time elapsed: ${timeMatch[1]}s`,
              timestamp: new Date(),
            });
          }
        } else if (qualityMatch) {
          if (onOutput) {
            onOutput({
              type: 'info',
              data: `Quality setting: ${qualityMatch[1]}`,
              timestamp: new Date(),
            });
          }
        } else if (formatMatch) {
          if (onOutput) {
            onOutput({
              type: 'info',
              data: `Output format: ${formatMatch[1]}`,
              timestamp: new Date(),
            });
          }
        }

        // Send stdout output
        if (onOutput) {
          onOutput({
            type: 'stdout',
            data: output,
            timestamp: new Date(),
          });
        }

        logger.debug('Docker stdout', { jobId, data: output });
      });

      dockerProcess.stderr?.on('data', data => {
        const output = data.toString();
        stderr += output;
        JobLogger.append(jobId, 'stderr', { chunk: output.substring(0, 1000) }).catch(() => {});

        // Send stderr output
        if (onOutput) {
          onOutput({
            type: 'stderr',
            data: output,
            timestamp: new Date(),
          });
        }

        logger.debug('Docker stderr', { jobId, data: output });
      });

      dockerProcess.on('close', async code => {
        if (isResolved) return; // Already handled by timeout

        clearTimeout(timeoutId);
        isResolved = true;

        if (code === 0) {
          try {
            // Find the generated video file
            const videoPath = await this.findVideoFile(outputDir);
            if (videoPath) {
              resolve({
                outputPath: videoPath,
                duration: 0, // Will be calculated by caller
              });
            } else {
              reject(new Error('No video file found in output directory'));
            }
          } catch (error) {
            reject(new Error(`Failed to locate output file: ${error}`));
          }
        } else {
          // Enhanced error analysis for video encoding failures
          let errorMessage = `Docker process failed with code ${code}`;

          if (stderr.includes('Permission denied') || stderr.includes('PermissionError')) {
            errorMessage =
              'Permission denied during video encoding. This may be due to Docker container permissions or directory access issues. ' +
              'Please ensure the output and temp directories have proper permissions (775 or 777). ' +
              'You can run the setup-permissions script to fix this.';
          } else if (stderr.includes('combine_to_movie') || stderr.includes('mux')) {
            errorMessage =
              'Video encoding failed during frame combination. This may be due to memory constraints or corrupted frames. ' +
              'Try reducing animation complexity or increasing Docker memory limits.';
          } else if (stderr.includes('av.container.output') || stderr.includes('OutputContainer')) {
            errorMessage =
              'FFmpeg video encoding failed. This may be due to insufficient memory or disk space. ' +
              'Check available system resources and Docker memory limits.';
          } else if (stderr.includes('scene.render()') || stderr.includes('SceneClass')) {
            errorMessage = 'Scene rendering failed. Check the Manim code for errors.';
          }

          // Add attempt information to error
          if (attempt > 1) {
            errorMessage += ` (Attempt ${attempt}/${this.maxRetries})`;
          }

          await JobLogger.append(jobId, 'Render error', {
            errorMessage,
            stderr: stderr.substring(0, 4000),
          });
          reject(new Error(`${errorMessage}\n\nFull error: ${stderr}`));
        }
      });

      dockerProcess.on('error', error => {
        if (isResolved) return; // Already handled by timeout

        clearTimeout(timeoutId);
        isResolved = true;
        reject(new Error(`Docker process error: ${error.message}`));
      });
    });
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(...dirs: string[]): Promise<void> {
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error('Failed to create directory', { dir, error });
        throw new Error(`Failed to create directory ${dir}: ${error}`);
      }
    }
  }

  /**
   * Ensure directories have proper permissions for Docker mounting
   */
  private async ensureDirectoryPermissions(tempDir: string, outputDir: string): Promise<void> {
    try {
      // Ensure directories exist and are writable
      await this.ensureDirectories(tempDir, outputDir);

      // On Unix-like systems, ensure directories are writable by Docker
      if (process.platform !== 'win32') {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        try {
          // Cross-platform user ID handling
          let backendUid: string;
          let backendGid: string;

          if (process.platform === 'linux') {
            // On Linux, use actual process UID/GID
            backendUid = (process.getuid?.() || 1000).toString();
            backendGid = (process.getgid?.() || 1000).toString();
          } else {
            // On macOS, use default values
            backendUid = '1000';
            backendGid = '1000';
          }

          // Override with environment variables if set
          backendUid = process.env.BACKEND_UID || backendUid;
          backendGid = process.env.BACKEND_GID || backendGid;

          logger.debug('Setting directory permissions for backend user', {
            uid: backendUid,
            gid: backendGid,
            tempDir,
            outputDir,
            platform: process.platform,
          });

          // Make directories owned by backend user and writable
          await execAsync(`chown -R ${backendUid}:${backendGid} "${tempDir}"`);
          await execAsync(`chown -R ${backendUid}:${backendGid} "${outputDir}"`);

          // Set permissions to 755 (rwxr-xr-x) for directories
          await execAsync(`chmod -R 755 "${tempDir}"`);
          await execAsync(`chmod -R 755 "${outputDir}"`);

          // Ensure output directory is writable by owner and group
          await execAsync(`chmod -R 775 "${outputDir}"`);

          logger.debug('Set directory ownership and permissions for Docker mounting', {
            tempDir,
            outputDir,
            uid: backendUid,
            gid: backendGid,
          });
        } catch (chmodError) {
          logger.warn('Failed to set directory permissions, trying fallback', {
            tempDir,
            outputDir,
            error: chmodError,
          });

          // Fallback: try to make directories writable by all users
          try {
            await execAsync(`chmod -R 777 "${tempDir}"`);
            await execAsync(`chmod -R 777 "${outputDir}"`);
            logger.debug('Applied fallback permissions (777)', { tempDir, outputDir });
          } catch (fallbackError) {
            logger.warn('Fallback permissions also failed', {
              tempDir,
              outputDir,
              error: fallbackError,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to ensure directory permissions', { error });
      // Don't throw error for permission issues, continue anyway
    }
  }

  /**
   * Find the generated video file in the output directory
   */
  private async findVideoFile(outputDir: string): Promise<string> {
    try {
      // Since we're mounting the output directory to /manim in the container,
      // and the container's working directory is /manim, the output files will be
      // in the outputDir that we mounted
      const files = await fs.readdir(outputDir);

      // Look for MP4 files - Manim typically names them with the scene class name
      // or with 'animation' in the filename
      const videoFile = files.find(
        file =>
          file.endsWith('.mp4') &&
          (file.includes('animation') || file.includes('CircleToSquare') || file.includes('Scene'))
      );

      if (!videoFile) {
        // If no specific file found, look for any MP4 file
        const anyMp4 = files.find(file => file.endsWith('.mp4'));
        if (anyMp4) {
          logger.info('Found MP4 file with different naming pattern', {
            foundFile: anyMp4,
            allFiles: files,
          });
          // Return just the filename for static file serving
          return anyMp4;
        }

        throw new Error(`No video file found. Available files: ${files.join(', ')}`);
      }

      // Return just the filename for static file serving
      return videoFile;
    } catch (error) {
      logger.error('Failed to find video file', { outputDir, error });
      throw new Error(`Failed to find video file: ${error}`);
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      logger.debug('Temporary files cleaned up', { tempDir });
    } catch (error) {
      logger.warn('Failed to clean up temporary files', { tempDir, error });
      // Don't throw error for cleanup failures
    }
  }

  /**
   * Validate Manim code for potential issues
   */
  private validateManimCode(code: string): void {
    // Check for common issues that might cause rendering failures
    const issues: string[] = [];

    if (code.includes('import *')) {
      issues.push('Wildcard imports may cause conflicts');
    }

    if (code.includes('self.wait()') && !code.includes('self.wait(')) {
      issues.push('Infinite wait detected - this will cause rendering to hang');
    }

    if (code.includes('while True') || code.includes('for _ in range(1000)')) {
      issues.push('Potential infinite loops detected');
    }

    if (code.includes('os.system') || code.includes('subprocess')) {
      issues.push('System commands detected - these are blocked for security');
    }

    if (issues.length > 0) {
      logger.warn('Potential Manim code issues detected', { issues });
    }
  }

  /**
   * Validate that Docker is available
   */
  async validateDocker(): Promise<boolean> {
    return new Promise(resolve => {
      const dockerProcess = spawn('docker', ['--version']);

      dockerProcess.on('close', code => {
        resolve(code === 0);
      });

      dockerProcess.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Check if the current process is running inside a Docker container.
   * This is a heuristic and might not be 100% accurate.
   */
  private isRunningInDockerContainer(): boolean {
    // Check if the process is running inside a Docker container
    // This is a heuristic and might not be 100% accurate.
    // A more robust check would involve inspecting Docker socket permissions.
    // For now, we'll assume if DOCKER_HOST is set, we're in a container.
    // This is a simplification and might need refinement based on actual Docker setup.
    return !!process.env.DOCKER_HOST;
  }
}
