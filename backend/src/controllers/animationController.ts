import { Request, Response } from 'express';
import { GeminiService } from '../services/geminiService';
import { JobQueueService } from '../services/jobQueueService';
import { logger } from '../utils/logger';
import { GenerateRequest, GenerateResponse, JobStatus, ApiError } from '../types';

export class AnimationController {
  private geminiService: GeminiService;
  private jobQueueService: JobQueueService;

  constructor() {
    this.geminiService = new GeminiService();
    this.jobQueueService = new JobQueueService();
  }

  /**
   * Generate animation from natural language prompt
   */
  async generateAnimation(
    req: Request<{}, {}, GenerateRequest>,
    res: Response<GenerateResponse | ApiError>
  ): Promise<void> {
    try {
      const { prompt } = req.body;

      // Validate input
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        res.status(400).json({
          message: 'Prompt is required and must be a non-empty string',
          code: 'INVALID_PROMPT',
        });
        return;
      }

      if (prompt.length > 1000) {
        res.status(400).json({
          message: 'Prompt is too long. Maximum length is 1000 characters.',
          code: 'PROMPT_TOO_LONG',
        });
        return;
      }

      logger.info('Received animation generation request', {
        prompt: prompt.substring(0, 100),
        requestId: req.headers['x-request-id'] || 'unknown',
      });

      // Generate Manim code using Gemini
      const geminiResponse = await this.geminiService.generateManimCode(prompt);

      // Log the final code that will be used for rendering
      logger.info('Final Manim code for rendering', {
        prompt: prompt.substring(0, 100),
        codeLength: geminiResponse.code.length,
        code: geminiResponse.code,
        hasCode: !!geminiResponse.code,
      });

      // Validate the generated code
      if (!this.geminiService.validateGeneratedCode(geminiResponse.code)) {
        logger.warn('Generated code failed validation', { prompt: prompt.substring(0, 100) });
        res.status(400).json({
          message: 'Generated code failed safety validation. Please try a different prompt.',
          code: 'CODE_VALIDATION_FAILED',
        });
        return;
      }

      // Add job to the rendering queue and get the actual job ID
      const jobId = await this.jobQueueService.addJob({
        prompt: prompt.trim(),
        code: geminiResponse.code,
        outputPath: undefined,
        error: undefined,
      });

      logger.info('Animation generation job queued successfully', {
        jobId,
        prompt: prompt.substring(0, 100),
      });

      res.status(201).json({
        jobId,
        message: 'Animation generation started successfully. Use the job ID to check status.',
        code: geminiResponse.code,
      });
    } catch (error) {
      logger.error('Error in generateAnimation controller', { error, body: req.body });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to generate animation',
        code: 'GENERATION_FAILED',
        details: errorMessage,
      });
    }
  }

  /**
   * Get the status of a rendering job
   */
  async getJobStatus(
    req: Request<{ id: string }>,
    res: Response<JobStatus | ApiError>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          message: 'Valid job ID is required',
          code: 'INVALID_JOB_ID',
        });
        return;
      }

      logger.info('Checking job status', { jobId: id });

      // Get job status from the queue
      const job = await this.jobQueueService.getJobStatus(id);

      if (!job) {
        res.status(404).json({
          message: 'Job not found',
          code: 'JOB_NOT_FOUND',
        });
        return;
      }

      // Transform the job data to match the JobStatus interface
      // Use actual progress from the job instead of hardcoded values
      let progress = 0;

      if (job.status === 'done') {
        progress = 100;
      } else if (job.status === 'running') {
        // Try to get actual progress from the job queue
        try {
          const queueJob = await this.jobQueueService.getJobProgress(id);
          if (queueJob && typeof queueJob.progress === 'number') {
            progress = queueJob.progress;
            logger.debug('Using actual progress from queue', { jobId: id, progress });
          } else {
            // Fallback to estimated progress based on time
            progress = 50; // Default fallback
            logger.debug('Using fallback progress', { jobId: id, progress });
          }
        } catch (error) {
          progress = 50; // Fallback on error
          logger.debug('Error getting progress, using fallback', { jobId: id, error });
        }
      }

      logger.debug('Job status transformation', {
        jobId: id,
        originalStatus: job.status,
        calculatedProgress: progress,
        hasOutputPath: !!job.outputPath,
        outputPath: job.outputPath,
      });

      const jobStatus: JobStatus = {
        id: job.id,
        status: job.status,
        progress: progress,
        videoUrl:
          job.status === 'done' && job.outputPath
            ? `/outputs/${id}/${job.outputPath.split('/').pop()}`
            : undefined,
        error: job.error,
        code: job.code,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };

      logger.info('Job status retrieved successfully', {
        jobId: id,
        status: job.status,
      });

      res.status(200).json(jobStatus);
    } catch (error) {
      logger.error('Error in getJobStatus controller', { error, jobId: req.params.id });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to get job status',
        code: 'STATUS_RETRIEVAL_FAILED',
        details: errorMessage,
      });
    }
  }

  /**
   * Get all jobs (for admin/monitoring purposes)
   */
  async getAllJobs(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving all jobs');

      const jobs = await this.jobQueueService.getAllJobs();

      logger.info('All jobs retrieved successfully', { count: jobs.length });

      res.status(200).json({
        jobs,
        count: jobs.length,
        message: 'Jobs retrieved successfully',
      });
    } catch (error) {
      logger.error('Error in getAllJobs controller', { error });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to retrieve jobs',
        code: 'JOBS_RETRIEVAL_FAILED',
        details: errorMessage,
      });
    }
  }

  /**
   * Get detailed information about all jobs including BullMQ states
   */
  async getAllJobsDetailed(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Retrieving detailed jobs information');

      const jobs = await this.jobQueueService.getAllJobsDetailed();

      logger.info('Detailed jobs retrieved successfully', { count: jobs.length });

      res.status(200).json({
        jobs,
        count: jobs.length,
        message: 'Detailed jobs retrieved successfully',
      });
    } catch (error) {
      logger.error('Error in getAllJobsDetailed controller', { error });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to retrieve detailed jobs',
        code: 'DETAILED_JOBS_RETRIEVAL_FAILED',
        details: errorMessage,
      });
    }
  }

  /**
   * Get detailed job progress information (debug endpoint)
   */
  async getJobProgress(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      const progressInfo = await this.jobQueueService.getJobProgress(id);

      // Add enhanced progress information
      const enhancedProgress = {
        ...progressInfo,
        timestamp: new Date().toISOString(),
        estimatedTimeRemaining: this.estimateTimeRemaining(progressInfo),
        progressDetails: this.getProgressDetails(progressInfo),
      };

      res.status(200).json(enhancedProgress);
    } catch (error) {
      logger.error('Failed to get job progress', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to get job progress',
        code: 'PROGRESS_RETRIEVAL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get live progress updates with Server-Sent Events
   */
  async getLiveProgress(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial progress
      const initialProgress = await this.jobQueueService.getJobProgress(id);
      res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);

      // Set up progress polling
      const progressInterval = setInterval(async () => {
        try {
          const progress = await this.jobQueueService.getJobProgress(id);
          res.write(`data: ${JSON.stringify(progress)}\n\n`);

          // Stop if job is complete
          if (progress.status === 'done' || progress.status === 'failed') {
            clearInterval(progressInterval);
            res.end();
          }
        } catch (error) {
          logger.error('Error in live progress update', { error, jobId: id });
          clearInterval(progressInterval);
          res.end();
        }
      }, 1000); // Update every second

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(progressInterval);
        res.end();
      });
    } catch (error) {
      logger.error('Failed to get live progress', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to get live progress',
        code: 'LIVE_PROGRESS_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Estimate time remaining based on progress
   */
  private estimateTimeRemaining(progressInfo: any): string | null {
    if (!progressInfo.createdAt || progressInfo.status !== 'running') {
      return null;
    }

    const elapsed = Date.now() - new Date(progressInfo.createdAt).getTime();
    const progress = progressInfo.progress || 0;

    if (progress <= 0) return 'Unknown';

    const estimatedTotal = elapsed / (progress / 100);
    const remaining = estimatedTotal - elapsed;

    if (remaining <= 0) return 'Almost done';

    const minutes = Math.ceil(remaining / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  /**
   * Get human-readable progress details
   */
  private getProgressDetails(progressInfo: any): string {
    const status = progressInfo.status;
    const progress = progressInfo.progress || 0;

    switch (status) {
      case 'pending':
        return 'Waiting in queue...';
      case 'running':
        if (progress < 25) return 'Initializing Manim...';
        if (progress < 50) return 'Rendering frames...';
        if (progress < 75) return 'Processing animation...';
        if (progress < 90) return 'Finalizing output...';
        return 'Almost complete...';
      case 'done':
        return 'Animation complete!';
      case 'failed':
        return 'Rendering failed';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Delete a job completely from the system
   */
  async deleteJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      await this.jobQueueService.deleteJob(id);

      res.status(200).json({
        message: 'Job deleted successfully',
        jobId: id,
      });
    } catch (error) {
      logger.error('Failed to delete job', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to delete job',
        code: 'DELETE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Force kill a stuck job
   */
  async forceKillJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      await this.jobQueueService.forceKillJob(id);

      res.status(200).json({
        message: 'Job force killed successfully',
        jobId: id,
      });
    } catch (error) {
      logger.error('Failed to force kill job', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to force kill job',
        code: 'FORCE_KILL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get comprehensive debugging information for a job
   */
  async getJobDebugInfo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      const debugInfo = await this.jobQueueService.getJobDebugInfo(id);

      res.status(200).json({
        message: 'Job debug info retrieved successfully',
        debugInfo,
      });
    } catch (error) {
      logger.error('Failed to get job debug info', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to get job debug info',
        code: 'DEBUG_INFO_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get Manim output for a job
   */
  async getJobManimOutput(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      const manimOutput = await this.jobQueueService.getJobManimOutput(id);

      res.status(200).json({
        message: 'Manim output retrieved successfully',
        jobId: id,
        outputs: manimOutput,
        count: manimOutput.length,
      });
    } catch (error) {
      logger.error('Failed to get Manim output', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to get Manim output',
        code: 'MANIM_OUTPUT_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Reset stuck job progress
   */
  async resetJobProgress(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Job ID is required',
          code: 'MISSING_JOB_ID',
        });
        return;
      }

      await this.jobQueueService.resetJobProgress(id);

      res.status(200).json({
        message: 'Job progress reset successfully',
        jobId: id,
      });
    } catch (error) {
      logger.error('Failed to reset job progress', { error, jobId: req.params.id });
      res.status(500).json({
        message: 'Failed to reset job progress',
        code: 'PROGRESS_RESET_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if services are healthy
      const dockerAvailable = await this.jobQueueService['manimRenderer'].validateDocker();

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          gemini: 'connected',
          jobQueue: 'connected',
          docker: dockerAvailable ? 'available' : 'unavailable',
        },
      });
    } catch (error) {
      logger.error('Health check failed', { error });

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Manually regenerate code for a failed job
   */
  async regenerateCode(
    req: Request<{ id: string }>,
    res: Response<{ message: string; newJobId?: string; error?: string } | ApiError>
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string') {
        res.status(400).json({
          message: 'Valid job ID is required',
          code: 'INVALID_JOB_ID',
        });
        return;
      }

      logger.info('Manual code regeneration requested', { jobId: id });

      // Attempt to regenerate code and retry
      const newJobId = await this.jobQueueService.regenerateCodeAndRetry(id);

      if (newJobId) {
        logger.info('Manual code regeneration successful', {
          originalJobId: id,
          newJobId,
        });

        res.status(200).json({
          message: 'Code regenerated successfully. New job created with corrected code.',
          newJobId,
        });
      } else {
        logger.warn('Manual code regeneration failed', { jobId: id });

        res.status(400).json({
          message:
            'Code regeneration failed. The job may not be in a failed state, or maximum regeneration attempts have been reached.',
          code: 'REGENERATION_FAILED',
        });
      }
    } catch (error) {
      logger.error('Error in regenerateCode controller', { error, jobId: req.params.id });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to regenerate code',
        code: 'REGENERATION_ERROR',
        details: errorMessage,
      });
    }
  }

  /**
   * Automatically regenerate code for all failed jobs
   */
  async regenerateAllFailedJobs(
    req: Request,
    res: Response<{ message: string; regeneratedJobs: string[]; failedJobs: string[] } | ApiError>
  ): Promise<void> {
    try {
      logger.info('Automatic regeneration of all failed jobs requested');

      // Get all failed jobs
      const allJobs = await this.jobQueueService.getAllJobs();
      const failedJobs = allJobs.filter(job => job.status === 'error');

      if (failedJobs.length === 0) {
        res.status(200).json({
          message: 'No failed jobs found to regenerate',
          regeneratedJobs: [],
          failedJobs: [],
        });
        return;
      }

      const regeneratedJobs: string[] = [];
      const failedRegenerations: string[] = [];

      // Attempt to regenerate each failed job
      for (const failedJob of failedJobs) {
        try {
          const newJobId = await this.jobQueueService.regenerateCodeAndRetry(failedJob.id);
          if (newJobId) {
            regeneratedJobs.push(failedJob.id);
          } else {
            failedRegenerations.push(failedJob.id);
          }
        } catch (error) {
          logger.error('Failed to regenerate job', { jobId: failedJob.id, error });
          failedRegenerations.push(failedJob.id);
        }
      }

      logger.info('Bulk code regeneration completed', {
        totalFailedJobs: failedJobs.length,
        successfullyRegenerated: regeneratedJobs.length,
        failedRegenerations: failedRegenerations.length,
      });

      res.status(200).json({
        message: `Code regeneration completed. ${regeneratedJobs.length} jobs regenerated, ${failedRegenerations.length} failed.`,
        regeneratedJobs,
        failedJobs: failedRegenerations,
      });
    } catch (error) {
      logger.error('Error in regenerateAllFailedJobs controller', { error });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.status(500).json({
        message: 'Failed to regenerate failed jobs',
        code: 'BULK_REGENERATION_ERROR',
        details: errorMessage,
      });
    }
  }
}
