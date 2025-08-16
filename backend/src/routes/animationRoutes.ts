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

// Debug endpoint to get detailed job progress
router.get('/debug/:id', animationController.getJobProgress.bind(animationController));

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

// Force kill a stuck job
router.post(
  '/kill/:id',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 kill requests per windowMs
    message: {
      message: 'Too many kill requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  animationController.forceKillJob.bind(animationController)
);

export default router;
