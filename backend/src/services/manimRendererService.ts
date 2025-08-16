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

export class ManimRendererService {
  private readonly dockerImage = 'manimcommunity/manim:latest';
  private readonly containerTimeout = 120000; // 2 minutes - reduced for better responsiveness

  /**
   * Render a Manim animation using Docker for safety
   */
  async renderAnimation(code: string, jobId: string): Promise<RenderResult> {
    const startTime = Date.now();
    const tempDir = path.join(process.cwd(), 'temp', jobId);
    const outputDir = path.join(process.cwd(), 'outputs', jobId);

    try {
      // Create temporary and output directories
      await this.ensureDirectories(tempDir, outputDir);

      // Write the Manim code to a temporary file
      const codeFilePath = path.join(tempDir, 'animation.py');
      await fs.writeFile(codeFilePath, code, 'utf8');

      // Render using Docker
      const result = await this.renderWithDocker(tempDir, outputDir, jobId);

      const duration = Date.now() - startTime;
      logger.info('Animation rendered successfully', {
        jobId,
        duration,
        outputPath: result.outputPath,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Animation rendering failed', {
        jobId,
        error,
        duration,
      });
      throw error;
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
    jobId: string
  ): Promise<RenderResult> {
    return new Promise((resolve, reject) => {
      const containerName = `manim-render-${jobId}`;

      // Docker run command for Manim
      const dockerArgs = [
        'run',
        '--rm',
        '--name',
        containerName,
        '--memory',
        '2g',
        '--cpus',
        '2',
        '--network',
        'none', // Isolate network
        '--read-only', // Read-only filesystem
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=100m',
        '-v',
        `${tempDir}:/manim`,
        '-v',
        `${outputDir}:/output`,
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
        'medium_quality',
        '--preview',
      ];

      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let isResolved = false;
      let timeoutId: NodeJS.Timeout;

      // Set up timeout handler
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          logger.warn('Docker process timed out, killing container', { jobId, containerName });

          // Kill the Docker container forcefully
          const killProcess = spawn('docker', ['kill', containerName]);
          killProcess.on('close', () => {
            logger.debug('Container killed due to timeout', { jobId, containerName });
          });

          // Also kill the spawn process
          try {
            dockerProcess.kill('SIGKILL');
          } catch (error) {
            logger.debug('Failed to kill spawn process', { jobId, error });
          }

          reject(new Error('Docker process timed out after 2 minutes'));
        }
      }, this.containerTimeout);

      dockerProcess.stdout?.on('data', data => {
        stdout += data.toString();
        logger.debug('Docker stdout', { jobId, data: data.toString() });
      });

      dockerProcess.stderr?.on('data', data => {
        stderr += data.toString();
        logger.debug('Docker stderr', { jobId, data: data.toString() });
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
          reject(new Error(`Docker process failed with code ${code}: ${stderr}`));
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
