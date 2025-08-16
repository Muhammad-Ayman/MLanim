import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config, getOutputPath } from '../config';
import { logger } from '../utils/logger';

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
  private readonly containerTimeout = 300000; // 5 minutes - increased for complex animations
  private readonly maxRetries = 2; // Retry failed renders

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

      // Docker run command for Manim - with permission handling
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
        '--user',
        '1000:1000', // Run as non-root user to avoid permission issues
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=500m', // Increased temp space
        '--tmpfs',
        '/var/tmp:rw,noexec,nosuid,size=500m', // Additional temp space
        '-v',
        `${tempDir}:/manim:rw`, // Explicit read-write permissions
        '-v',
        `${outputDir}:/output:rw`, // Explicit read-write permissions
        '-w',
        '/manim',
        this.dockerImage,
        'manim',
        'animation.py',
        '-o',
        '/output',
        '--format',
        'mp4',
        '--quality',
        attempt === 1 ? 'm' : 'l', // Try lower quality on retry
        '--disable_caching', // Disable caching to avoid conflicts
        '--flush_cache', // Flush cache before rendering
      ];

      // On retry attempts, try different permission strategies
      if (attempt > 1) {
        // Remove user restriction on retry to try root access
        dockerArgs.splice(dockerArgs.indexOf('--user'), 2);
        logger.debug('Retrying without user restriction for permission issues', { jobId, attempt });
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
              'Permission denied during video encoding. This may be due to Docker container permissions or directory access issues.';
          } else if (stderr.includes('combine_to_movie') || stderr.includes('mux')) {
            errorMessage =
              'Video encoding failed during frame combination. This may be due to memory constraints or corrupted frames.';
          } else if (stderr.includes('av.container.output') || stderr.includes('OutputContainer')) {
            errorMessage =
              'FFmpeg video encoding failed. This may be due to insufficient memory or disk space.';
          } else if (stderr.includes('scene.render()') || stderr.includes('SceneClass')) {
            errorMessage = 'Scene rendering failed. Check the Manim code for errors.';
          }

          // Add attempt information to error
          if (attempt > 1) {
            errorMessage += ` (Attempt ${attempt}/${this.maxRetries})`;
          }

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
      // On Unix-like systems, ensure directories are writable by Docker
      if (process.platform !== 'win32') {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        try {
          // Make directories writable by all users (for Docker)
          await execAsync(`chmod -R 777 "${tempDir}"`);
          await execAsync(`chmod -R 777 "${outputDir}"`);
          logger.debug('Set directory permissions for Docker mounting', { tempDir, outputDir });
        } catch (chmodError) {
          logger.warn('Failed to set directory permissions, continuing anyway', {
            tempDir,
            outputDir,
            error: chmodError,
          });
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
      const files = await fs.readdir(outputDir);
      const videoFile = files.find(file => file.endsWith('.mp4') && file.includes('animation'));

      if (!videoFile) {
        throw new Error('No video file found');
      }

      return path.join(outputDir, videoFile);
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
}
