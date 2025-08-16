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
        if (typeof job.progress === 'function') {
          progress = await job.progress();
        } else {
          logger.debug('Progress method not available for job', { jobId });
        }
      } catch (progressError) {
        logger.debug('Progress not available for job', { jobId, error: progressError });
        progress = 0;
      }

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

      const renderJob: RenderJob = {
        id: job.id as string,
        prompt: job.data.prompt,
        code: job.data.code,
        status: this.mapJobStateToStatus(state),
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
          return {
            id: job.id as string,
            prompt: job.data.prompt,
            code: job.data.code,
            status: this.mapJobStateToStatus(state),
            outputPath: job.returnvalue?.outputPath,
            error: job.failedReason,
            createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
            updatedAt: new Date(),
          };
        })
      );
    } catch (error) {
      logger.error('Failed to get all jobs', { error });
      throw new Error(
        `Failed to get all jobs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

        try {
          // Update progress to show job is starting
          await job.updateProgress(10);

          // Simulate progress updates during rendering
          const progressInterval = setInterval(async () => {
            try {
              const currentProgress = job.progress as number;
              if (currentProgress < 90) {
                await job.updateProgress(Math.min(currentProgress + 10, 90));
              }
            } catch (error) {
              logger.debug('Could not update progress', { jobId: job.id, error });
            }
          }, 5000); // Update every 5 seconds

          const result = await this.manimRenderer.renderAnimation(job.data.code, job.id as string);

          // Clear progress interval and set to 100%
          clearInterval(progressInterval);
          await job.updateProgress(100);

          logger.info('Job completed successfully', {
            jobId: job.id,
            outputPath: result.outputPath,
          });

          return result;
        } catch (error) {
          logger.error('Job failed', { jobId: job.id, error });
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
      if (job) {
        logger.error('Job failed', { jobId: job.id, error: err.message });
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
   * Force kill a stuck job
   */
  async forceKillJob(jobId: string): Promise<void> {
    try {
      const job = await this.queue.getJob(jobId);
      if (job) {
        await job.moveToFailed(new Error('Job force killed by user'), '0');
        logger.info('Job force killed', { jobId });
      } else {
        logger.warn('Job not found for force kill', { jobId });
      }
    } catch (error) {
      logger.error('Failed to force kill job', { jobId, error });
      throw error;
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
