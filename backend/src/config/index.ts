import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  together: {
    apiKey: process.env.TOGETHER_API_KEY || '',
    baseUrl: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  storage: {
    outputDir: process.env.OUTPUT_DIR || './outputs',
    maxFileSize: process.env.MAX_FILE_SIZE || '100mb',
  },
  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

// Validate required configuration
export function validateConfig(): void {
  // Require at least one provider to be configured
  if (!config.gemini.apiKey && !config.together.apiKey) {
    throw new Error(
      'At least one provider API key is required: set GEMINI_API_KEY or TOGETHER_API_KEY'
    );
  }

  if (!config.redis.url) {
    throw new Error('REDIS_URL is required');
  }
}

// Ensure output directory exists
export function getOutputPath(filename: string): string {
  return path.join(config.storage.outputDir, filename);
}
