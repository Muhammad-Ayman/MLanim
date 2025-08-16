import { Router } from 'express';
import { SystemController } from '../controllers/systemController';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const systemController = new SystemController();

// Rate limiting for system operations
const systemRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 system operations per minute
  message: {
    message: 'Too many system operations from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Get all Docker containers
router.get(
  '/docker/containers',
  systemRateLimit,
  systemController.getDockerContainers.bind(systemController)
);

// Kill a specific Docker container
router.post(
  '/docker/kill/:id',
  systemRateLimit,
  systemController.killDockerContainer.bind(systemController)
);

// Kill all running Docker containers
router.post(
  '/docker/kill-all',
  systemRateLimit,
  systemController.killAllDockerContainers.bind(systemController)
);

// Get system resource usage
router.get(
  '/resources',
  systemRateLimit,
  systemController.getSystemResources.bind(systemController)
);

export default router;
