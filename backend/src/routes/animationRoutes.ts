import { Router } from 'express';
import { AnimationController } from '../controllers/animationController';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const animationController = new AnimationController();

// Rate limiting for generation endpoint
const generateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    message: 'Too many animation generation requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for status checks
const statusRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 status checks per minute
  message: {
    message: 'Too many status check requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
router.get('/health', animationController.healthCheck.bind(animationController));

// Generate animation from prompt
router.post(
  '/generate',
  generateRateLimit,
  animationController.generateAnimation.bind(animationController)
);

// Get job status
router.get(
  '/status/:id',
  statusRateLimit,
  animationController.getJobStatus.bind(animationController)
);

// Get all jobs (for monitoring)
router.get('/jobs', animationController.getAllJobs.bind(animationController));

// Get detailed jobs information (including BullMQ states)
router.get('/jobs/detailed', animationController.getAllJobsDetailed.bind(animationController));

// Debug endpoint to get detailed job progress
router.get('/debug/:id', animationController.getJobProgress.bind(animationController));

// Comprehensive debug endpoint for stuck jobs
router.get(
  '/debug-comprehensive/:id',
  animationController.getJobDebugInfo.bind(animationController)
);

// Get Manim output for a job
router.get('/manim-output/:id', animationController.getJobManimOutput.bind(animationController));

// Live progress endpoint (Server-Sent Events)
router.get(
  '/live/:id',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 live progress requests per windowMs
    message: {
      message: 'Too many live progress requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  animationController.getLiveProgress.bind(animationController)
);

// Delete a job completely
router.delete(
  '/delete/:id',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 delete requests per minute
    message: {
      message: 'Too many delete requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  animationController.deleteJob.bind(animationController)
);

// Force kill a stuck job
router.post(
  '/kill/:id',
  // Skip rate limiting in development mode
  process.env.NODE_ENV === 'development'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 20, // Limit each IP to 20 kill requests per minute
        message: {
          message: 'Too many kill requests from this IP, please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        standardHeaders: true,
        legacyHeaders: false,
      }),
  animationController.forceKillJob.bind(animationController)
);

// Reset stuck job progress
router.post(
  '/reset-progress/:id',
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 progress reset requests per minute
    message: {
      message: 'Too many progress reset requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  animationController.resetJobProgress.bind(animationController)
);

// Development-only endpoint for testing (no rate limiting)
if (process.env.NODE_ENV === 'development') {
  router.post('/kill/:id/dev', animationController.forceKillJob.bind(animationController));
}

export default router;
