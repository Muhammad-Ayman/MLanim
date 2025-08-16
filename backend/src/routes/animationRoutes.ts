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
    code: 'RATE_LIMIT_EXCEEDED'
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
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
router.get('/health', animationController.healthCheck.bind(animationController));

// Generate animation from prompt
router.post('/generate', 
  generateRateLimit,
  animationController.generateAnimation.bind(animationController)
);

// Get job status
router.get('/status/:id', 
  statusRateLimit,
  animationController.getJobStatus.bind(animationController)
);

// Get all jobs (for monitoring)
router.get('/jobs', animationController.getAllJobs.bind(animationController));

export default router;
