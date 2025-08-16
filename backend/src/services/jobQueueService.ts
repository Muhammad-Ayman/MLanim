import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RenderJob } from '../types';
import { ManimRendererService } from './manimRendererService';

export class JobQueueService {
  private queue: Queue;
  private worker!: Worker;
  private redis: Redis;
  private manimRenderer: ManimRendererService;

  constructor() {
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
    });
    this.queue = new Queue('manim-rendering', { connection: this.redis });
    this.manimRenderer = new ManimRendererService();

    this.setupWorker();
    this.setupEventHandlers();
  }

  /**
   * Add a new rendering job to the queue
   */
  async addJob(
    jobData: Omit<RenderJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const job = await this.queue.add('render', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      logger.info('Added new rendering job to queue', {
        jobId: job.id,
        prompt: jobData.prompt.substring(0, 100),
      });

      return job.id as string;
    } catch (error) {
      logger.error('Failed to add job to queue', { error, jobData });
      throw new Error(
        `Failed to queue rendering job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get job status and details
   */
  async getJobStatus(jobId: string): Promise<RenderJob | null> {
    try {
      // Try to parse jobId as number if it's numeric (BullMQ sometimes expects numeric IDs)
      let parsedJobId: string | number = jobId;
      if (/^\d+$/.test(jobId)) {
        parsedJobId = parseInt(jobId, 10);
        logger.debug('Parsed numeric job ID', { originalJobId: jobId, parsedJobId });
      }

      const job = await this.queue.getJob(parsedJobId.toString());

      if (!job) {
        logger.warn('Job not found in queue', { jobId, parsedJobId });

        // Try to get some queue information for debugging
        try {
          const waitingCount = await this.queue.getWaitingCount();
          const activeCount = await this.queue.getActiveCount();
          const completedCount = await this.queue.getCompletedCount();
          const failedCount = await this.queue.getFailedCount();

          logger.debug('Queue status', {
            waitingCount,
            activeCount,
            completedCount,
            failedCount,
          });
        } catch (queueError) {
          logger.debug('Could not get queue status', { error: queueError });
        }

        return null;
      }

      logger.debug('Retrieved job from queue', {
        jobId,
        jobExists: !!job,
        jobData: job.data,
        jobType: typeof job,
        jobKeys: Object.keys(job),
      });

      const state = await job.getState();
      logger.debug('Job state retrieved', { jobId, state });

      // Handle progress safely - it might not be available for all job states
      let progress = 0;
      try {
        logger.debug('Attempting to get job progress', {
          jobId,
          hasProgressMethod: typeof job.progress === 'function',
          progressValue: job.progress,
          progressType: typeof job.progress,
        });

        if (typeof job.progress === 'function') {
          progress = await job.progress();
          logger.debug('Progress retrieved via method', { jobId, progress });
        } else {
          // Try to get progress as a property
          progress = (job.progress as number) || 0;
          logger.debug('Progress retrieved as property', { jobId, progress });
        }
      } catch (progressError) {
        logger.error('Progress retrieval failed', {
          jobId,
          error: progressError instanceof Error ? progressError.message : progressError,
          stack: progressError instanceof Error ? progressError.stack : undefined,
        });
        progress = 0;
      }

      logger.debug('Final progress value', { jobId, progress });

      const failedReason = job.failedReason;

      // Validate job data structure
      if (!job.data || typeof job.data !== 'object') {
        logger.error('Job data is invalid', { jobId, jobData: job.data });
        throw new Error('Job data structure is invalid');
      }

      if (!job.data.prompt || !job.data.code) {
        logger.error('Job data missing required fields', {
          jobId,
          hasPrompt: !!job.data.prompt,
          hasCode: !!job.data.code,
          dataKeys: Object.keys(job.data),
        });
        throw new Error('Job data missing required fields');
      }

      const mappedStatus = this.mapJobStateToStatus(state);
      logger.debug('Job state mapping', {
        jobId,
        originalState: state,
        mappedStatus,
        progress,
        hasOutputPath: !!job.returnvalue?.outputPath,
        outputPath: job.returnvalue?.outputPath,
      });

      const renderJob: RenderJob = {
        id: job.id as string,
        prompt: job.data.prompt,
        code: job.data.code,
        status: mappedStatus,
        outputPath: job.returnvalue?.outputPath,
        error: failedReason,
        createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
        updatedAt: new Date(),
      };

      logger.debug('Mapped job to RenderJob', { jobId, renderJob });
      return renderJob;
    } catch (error) {
      logger.error('Failed to get job status', { error, jobId });
      throw new Error(
        `Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all jobs with their statuses
   */
  async getAllJobs(): Promise<RenderJob[]> {
    try {
      const jobs = await this.queue.getJobs(['active', 'waiting', 'completed', 'failed']);

      return Promise.all(
        jobs.map(async job => {
          const state = await job.getState();
          const progress = (job.progress as number) || 0;

          return {
            id: job.id as string,
            prompt: job.data.prompt,
            code: job.data.code,
            status: this.mapJobStateToStatus(state),
            progress: progress,
            outputPath: job.returnvalue?.outputPath,
            error: job.failedReason,
            createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
            updatedAt: new Date(),
          };
        })
      );
    } catch (error) {
      logger.error('Failed to get all jobs', { error });
      throw error;
    }
  }

  /**
   * Get detailed information about all jobs including their BullMQ states
   */
  async getAllJobsDetailed(): Promise<any[]> {
    try {
      const jobs = await this.queue.getJobs(['active', 'waiting', 'completed', 'failed']);

      return Promise.all(
        jobs.map(async job => {
          const state = await job.getState();
          const progress = (job.progress as number) || 0;

          return {
            id: job.id as string,
            bullmqState: state, // Raw BullMQ state
            status: this.mapJobStateToStatus(state),
            progress: progress,
            prompt: job.data.prompt,
            code: job.data.code,
            outputPath: job.returnvalue?.outputPath,
            error: job.failedReason,
            createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
            updatedAt: new Date(),
            // Additional BullMQ metadata
            delay: job.delay,
            priority: job.priority,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
            finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
          };
        })
      );
    } catch (error) {
      logger.error('Failed to get detailed jobs', { error });
      throw error;
    }
  }

  /**
   * Setup the worker to process jobs
   */
  private setupWorker(): void {
    this.worker = new Worker(
      'manim-rendering',
      async (job: Job) => {
        logger.info('Processing rendering job', { jobId: job.id });

        // Declare progressInterval at function scope so it's accessible in catch block
        let progressInterval: NodeJS.Timeout | undefined;

        try {
          // Update progress to show job is starting
          logger.debug('Setting initial progress to 10%', { jobId: job.id });
          await job.updateProgress(10);
          logger.debug('Initial progress set successfully', { jobId: job.id, progress: 10 });

          // Set initial progress to show job is starting
          await job.updateProgress(5);
          logger.debug('Initial progress set to 5%', { jobId: job.id });

          logger.debug('Starting Manim rendering', { jobId: job.id });

          // Collect Manim output for real-time progress
          const manimOutputs: any[] = [];
          const onManimOutput = (output: any) => {
            manimOutputs.push(output);
            logger.debug('Manim output received', { jobId: job.id, output });

            // Store Manim output in Redis for later retrieval
            if (job.id) {
              this.storeManimOutput(job.id.toString(), output).catch(error => {
                logger.warn('Failed to store Manim output', { jobId: job.id, error });
              });
            }

            // Update progress based on Manim output
            if (output.type === 'progress') {
              let progressPercent = 0;

              // Extract progress percentage from Manim output with multiple patterns
              const frameMatch = output.data.match(/Rendering frame (\d+)\/(\d+)/);
              if (frameMatch) {
                const currentFrame = parseInt(frameMatch[1]);
                const totalFrames = parseInt(frameMatch[2]);
                progressPercent = Math.round((currentFrame / totalFrames) * 100);
              } else {
                // Estimate progress based on output type and content
                const currentProgress = (job.progress as number) || 5;

                if (output.data.includes('Scene') || output.data.includes('Building')) {
                  progressPercent = Math.min(currentProgress + 15, 40);
                } else if (
                  output.data.includes('Processing') ||
                  output.data.includes('Compiling')
                ) {
                  progressPercent = Math.min(currentProgress + 10, 60);
                } else if (output.data.includes('Rendering')) {
                  progressPercent = Math.min(currentProgress + 20, 80);
                } else if (output.data.includes('Writing') || output.data.includes('Frame')) {
                  progressPercent = Math.min(currentProgress + 25, 90);
                } else {
                  // Increment progress slightly for other outputs
                  progressPercent = Math.min(currentProgress + 5, 85);
                }
              }

              // Update job progress with actual Manim progress
              if (progressPercent > 0) {
                job.updateProgress(Math.min(progressPercent, 95)).catch(error => {
                  logger.warn('Failed to update progress from Manim output', {
                    jobId: job.id,
                    error,
                  });
                });
              }
            }
          };

          const result = await this.manimRenderer.renderAnimation(
            job.data.code,
            job.id as string,
            onManimOutput
          );

          logger.debug('Manim rendering completed', {
            jobId: job.id,
            result,
            outputCount: manimOutputs.length,
          });

          // Clear progress interval and set to 100%
          logger.debug('Clearing progress interval and setting to 100%', { jobId: job.id });
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = undefined;
          }

          // Ensure progress reaches 100% with retry logic
          try {
            await job.updateProgress(100);
            logger.debug('Final progress set to 100%', { jobId: job.id });
          } catch (progressError) {
            logger.warn('Failed to set final progress to 100%, retrying', {
              jobId: job.id,
              error: progressError instanceof Error ? progressError.message : progressError,
            });

            // Retry once more
            try {
              await job.updateProgress(100);
              logger.debug('Final progress retry successful', { jobId: job.id });
            } catch (retryError) {
              logger.error('Failed to set final progress even after retry', {
                jobId: job.id,
                error: retryError instanceof Error ? retryError.message : retryError,
              });
            }
          }

          logger.info('Job completed successfully', {
            jobId: job.id,
            outputPath: result.outputPath,
          });

          return result;
        } catch (error) {
          // Ensure progress interval is cleared even on error
          if (progressInterval) {
            clearInterval(progressInterval);
          }

          logger.error('Job failed', {
            jobId: job.id,
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      },
      { connection: this.redis }
    );
  }

  /**
   * Setup event handlers for job monitoring
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      logger.info('Job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job && job.id) {
        logger.error('Job failed', { jobId: job.id, error: err.message });
        // Clean up any stuck Docker containers
        this.cleanupStuckContainers(job.id.toString());
      } else {
        logger.error('Job failed with unknown job', { error: err.message });
      }
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Worker error', { error: err.message });
    });

    this.queue.on('error', (err: Error) => {
      logger.error('Queue error', { error: err.message });
    });
  }

  /**
   * Map BullMQ job state to our status enum
   */
  private mapJobStateToStatus(state: string): RenderJob['status'] {
    switch (state) {
      case 'waiting':
      case 'delayed':
        return 'pending';
      case 'active':
        return 'running';
      case 'completed':
        return 'done';
      case 'failed':
        return 'error';
      default:
        return 'pending';
    }
  }

  /**
   * Get detailed job information including progress
   */
  async getJobProgress(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return { error: 'Job not found' };
      }

      const state = await job.getState();
      const progress = job.progress;
      const data = job.data;
      const returnValue = job.returnvalue;
      const failedReason = job.failedReason;

      logger.debug('Detailed job progress info', {
        jobId,
        state,
        progress,
        progressType: typeof progress,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasReturnValue: !!returnValue,
        returnValueKeys: returnValue ? Object.keys(returnValue) : [],
        failedReason,
      });

      return {
        jobId,
        state,
        progress,
        progressType: typeof progress,
        data,
        returnValue,
        failedReason,
        timestamp: job.timestamp,
      };
    } catch (error) {
      logger.error('Failed to get job progress details', { jobId, error });
      throw error;
    }
  }

  /**
   * Delete a job completely from the system
   */
  async deleteJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn('Job not found for deletion', { jobId });
        return;
      }

      const currentState = await job.getState();
      logger.info('Deleting job completely', { jobId, currentState });

      try {
        // Remove the job completely from the queue
        await job.remove();
        logger.info('Job deleted successfully', { jobId, previousState: currentState });
      } catch (removeError) {
        logger.warn('Failed to remove job, trying to discard', {
          jobId,
          currentState,
          removeError,
        });

        // If remove fails, try to discard
        try {
          await job.discard();
          logger.info('Job discarded successfully', { jobId, previousState: currentState });
        } catch (discardError) {
          logger.error('Failed to discard job', { jobId, currentState, discardError });
          throw new Error(
            `Failed to delete job: ${discardError instanceof Error ? discardError.message : 'Unknown error'}`
          );
        }
      }

      // Clean up associated resources
      await this.cleanupJobResources(jobId);
    } catch (error) {
      logger.error('Failed to delete job', { jobId, error });
      throw new Error(
        `Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Force kill a stuck job
   */
  async forceKillJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn('Job not found for force kill', { jobId });
        return;
      }

      const currentState = await job.getState();
      logger.info('Force killing job', { jobId, currentState });

      try {
        // Try to move to failed state first
        await job.moveToFailed(new Error('Job force killed by user'), '0');
        logger.info('Job force killed successfully', { jobId, previousState: currentState });
      } catch (moveError) {
        logger.warn('Failed to move job to failed state', { jobId, currentState, moveError });

        // If moving to failed fails, try to remove the job completely
        try {
          await job.remove();
          logger.info('Job removed successfully', { jobId, previousState: currentState });
        } catch (removeError) {
          logger.warn('Failed to remove job', { jobId, currentState, removeError });

          // Last resort: try to discard the job
          try {
            await job.discard();
            logger.info('Job discarded successfully', { jobId, previousState: currentState });
          } catch (discardError) {
            logger.error('Failed to discard job', { jobId, currentState, discardError });
            const errorMessage =
              discardError instanceof Error ? discardError.message : 'Unknown discard error';
            throw new Error(`Failed to force kill job in state ${currentState}: ${errorMessage}`);
          }
        }
      }

      // Clean up any associated Docker containers
      await this.cleanupStuckContainers(jobId);
    } catch (error) {
      logger.error('Failed to force kill job', { jobId, error });
      throw new Error(
        `Failed to force kill job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean up all resources associated with a job
   */
  private async cleanupJobResources(jobId: string): Promise<void> {
    try {
      // Clean up Docker containers
      await this.cleanupStuckContainers(jobId);

      // Clean up Redis data
      const outputKey = `manim:output:${jobId}`;
      await this.redis.del(outputKey);
      logger.debug('Cleaned up Redis data for job', { jobId });

      // Clean up file system resources
      await this.cleanupJobFiles(jobId);
    } catch (error) {
      logger.warn('Failed to cleanup some job resources', { jobId, error });
    }
  }

  /**
   * Clean up file system resources for a job
   */
  private async cleanupJobFiles(jobId: string): Promise<void> {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      const path = require('path');

      // Clean up output directory
      const outputDir = path.join(process.cwd(), 'outputs', jobId);
      try {
        await execAsync(`rm -rf "${outputDir}"`);
        logger.debug('Cleaned up output directory', { jobId, outputDir });
      } catch (error) {
        logger.debug('Output directory cleanup failed (may not exist)', {
          jobId,
          outputDir,
          error,
        });
      }

      // Clean up temp directory
      const tempDir = path.join(process.cwd(), 'temp', jobId);
      try {
        await execAsync(`rm -rf "${tempDir}"`);
        logger.debug('Cleaned up temp directory', { jobId, tempDir });
      } catch (error) {
        logger.debug('Temp directory cleanup failed (may not exist)', { jobId, tempDir, error });
      }
    } catch (error) {
      logger.warn('Failed to cleanup job files', { jobId, error });
    }
  }

  /**
   * Clean up stuck Docker containers for a failed job
   */
  private async cleanupStuckContainers(jobId: string): Promise<void> {
    try {
      // Try to find and kill any Docker containers related to this job
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      // Look for containers with the job ID in the name
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=mlanim-${jobId}" --format "{{.ID}}"`
      );

      if (stdout.trim()) {
        const containerIds = stdout.trim().split('\n');
        for (const containerId of containerIds) {
          if (containerId) {
            try {
              await execAsync(`docker kill ${containerId}`);
              logger.info('Cleaned up stuck Docker container', { jobId, containerId });
            } catch (killError) {
              logger.warn('Failed to kill Docker container', { jobId, containerId, killError });
            }
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup Docker containers', { jobId, error });
    }
  }

  /**
   * Get comprehensive debugging information for a job
   */
  async getJobDebugInfo(jobId: string): Promise<any> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return { error: 'Job not found' };
      }

      const state = await job.getState();
      const progress = (job.progress as number) || 0;
      const data = job.data;
      const returnValue = job.returnvalue;
      const failedReason = job.failedReason;

      // Get queue statistics
      const waitingCount = await this.queue.getWaitingCount();
      const activeCount = await this.queue.getActiveCount();
      const completedCount = await this.queue.getCompletedCount();
      const failedCount = await this.queue.getFailedCount();

      // Get worker information
      const workerInfo = {
        isActive: this.worker.isRunning(),
        workerId: this.worker.id,
        concurrency: this.worker.concurrency,
      };

      // Get Redis connection status
      const redisStatus = {
        isConnected: this.redis.status === 'ready',
        status: this.redis.status,
        host: this.redis.options.host,
        port: this.redis.options.port,
      };

      // Get Docker container status for this job
      let dockerInfo = null;
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);

        const { stdout } = await execAsync(
          `docker ps -a --filter "name=mlanim-${jobId}" --format "{{.ID}} {{.Names}} {{.Status}} {{.Image}}"`
        );

        if (stdout.trim()) {
          dockerInfo = stdout
            .trim()
            .split('\n')
            .map((line: string) => {
              const [id, name, status, image] = line.split(' ');
              return { id, name, status, image };
            });
        }
      } catch (dockerError) {
        dockerInfo = {
          error: dockerError instanceof Error ? dockerError.message : 'Unknown Docker error',
        };
      }

      logger.debug('Comprehensive job debug info', {
        jobId,
        state,
        progress,
        progressType: typeof progress,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        hasReturnValue: !!returnValue,
        returnValueKeys: returnValue ? Object.keys(returnValue) : [],
        failedReason,
        queueStats: { waitingCount, activeCount, completedCount, failedCount },
        workerInfo,
        redisStatus,
        dockerInfo,
      });

      return {
        jobId,
        state,
        progress,
        progressType: typeof progress,
        data,
        returnValue,
        failedReason,
        timestamp: job.timestamp,
        queueStats: { waitingCount, activeCount, completedCount, failedCount },
        workerInfo,
        redisStatus,
        dockerInfo,
        // Additional debugging info
        jobKeys: Object.keys(job),
        jobMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(job)),
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
        delay: job.delay,
        priority: job.priority,
      };
    } catch (error) {
      logger.error('Failed to get job debug info', { jobId, error });
      throw error;
    }
  }

  /**
   * Store Manim output for a job in Redis
   */
  private async storeManimOutput(jobId: string, output: any): Promise<void> {
    try {
      const key = `manim:output:${jobId}`;
      const outputData = {
        ...output,
        timestamp: output.timestamp || new Date(),
      };

      // Store the output in a Redis list
      await this.redis.lpush(key, JSON.stringify(outputData));

      // Keep only the last 100 outputs to prevent memory issues
      await this.redis.ltrim(key, 0, 99);

      // Set expiration to 24 hours
      await this.redis.expire(key, 24 * 60 * 60);

      logger.debug('Manim output stored in Redis', { jobId, outputType: output.type });
    } catch (error) {
      logger.error('Failed to store Manim output in Redis', { jobId, error });
    }
  }

  /**
   * Get Manim output for a job (if available)
   */
  async getJobManimOutput(jobId: string): Promise<any[]> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return [];
      }

      // Get stored Manim outputs from Redis
      const key = `manim:output:${jobId}`;
      const outputs = await this.redis.lrange(key, 0, -1);

      if (outputs && outputs.length > 0) {
        // Parse the stored outputs and sort by timestamp
        const parsedOutputs = outputs
          .map(output => {
            try {
              return JSON.parse(output);
            } catch (parseError) {
              logger.warn('Failed to parse stored Manim output', { jobId, parseError });
              return null;
            }
          })
          .filter(output => output !== null)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        logger.debug('Retrieved Manim outputs from Redis', { jobId, count: parsedOutputs.length });
        return parsedOutputs;
      }

      // Fallback to placeholder if no outputs stored
      const state = await job.getState();
      if (state === 'active' || state === 'completed') {
        return [
          {
            type: 'info',
            data: 'No Manim output stored yet. Outputs are captured during rendering.',
            timestamp: new Date(),
          },
        ];
      }

      return [];
    } catch (error) {
      logger.error('Failed to get Manim output', { jobId, error });
      return [];
    }
  }

  /**
   * Get current Manim operation for a job
   */
  async getCurrentManimOperation(jobId: string): Promise<string | null> {
    try {
      const outputs = await this.getJobManimOutput(jobId);
      if (outputs.length > 0) {
        const lastOutput = outputs[outputs.length - 1];
        return lastOutput.data || null;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get current Manim operation', { jobId, error });
      return null;
    }
  }

  /**
   * Reset stuck progress for a job
   */
  async resetJobProgress(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn('Job not found for progress reset', { jobId });
        return;
      }

      const currentState = await job.getState();
      logger.info('Resetting job progress', { jobId, currentState });

      // Reset progress to 0
      await job.updateProgress(0);
      logger.info('Job progress reset successfully', { jobId });
    } catch (error) {
      logger.error('Failed to reset job progress', { jobId, error });
      throw new Error(
        `Failed to reset job progress: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
  }
}
