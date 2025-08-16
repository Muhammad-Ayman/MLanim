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
      const jobStatus: JobStatus = {
        id: job.id,
        status: job.status,
        progress: job.status === 'running' ? 50 : job.status === 'done' ? 100 : 0,
        videoUrl:
          job.status === 'done' && job.outputPath
            ? `/outputs/${id}/${job.outputPath.split('/').pop()}`
            : undefined,
        error: job.error,
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
}
