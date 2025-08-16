import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RenderJob } from '../types';
import { ManimRendererService } from './manimRendererService';

export class JobQueueService {
  private queue: Queue;
  private worker: Worker;
  private redis: Redis;
  private manimRenderer: ManimRendererService;

  constructor() {
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxLoadingTimeout: 10000,
    });
    this.queue = new Queue('manim-rendering', { connection: this.redis });
    this.manimRenderer = new ManimRendererService();
    
    this.setupWorker();
    this.setupEventHandlers();
  }

  /**
   * Add a new rendering job to the queue
   */
  async addJob(jobData: Omit<RenderJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<string> {
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
        prompt: jobData.prompt.substring(0, 100)
      });

      return job.id as string;
    } catch (error) {
      logger.error('Failed to add job to queue', { error, jobData });
      throw new Error(`Failed to queue rendering job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get job status and details
   */
  async getJobStatus(jobId: string): Promise<RenderJob | null> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = await job.progress();
      const failedReason = job.failedReason;

      return {
        id: job.id as string,
        prompt: job.data.prompt,
        code: job.data.code,
        status: this.mapJobStateToStatus(state),
        outputPath: job.returnvalue?.outputPath,
        error: failedReason,
        createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get job status', { error, jobId });
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all jobs with their statuses
   */
  async getAllJobs(): Promise<RenderJob[]> {
    try {
      const jobs = await this.queue.getJobs(['active', 'waiting', 'completed', 'failed']);
      
      return Promise.all(
        jobs.map(async (job) => {
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
      throw new Error(`Failed to get all jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          const result = await this.manimRenderer.renderAnimation(
            job.data.code,
            job.id as string
          );
          
          logger.info('Job completed successfully', { 
            jobId: job.id, 
            outputPath: result.outputPath 
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

    this.worker.on('failed', (job: Job, err: Error) => {
      logger.error('Job failed', { jobId: job.id, error: err.message });
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
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.redis.quit();
  }
}
