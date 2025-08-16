import { App } from './app';
import { logger } from './utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Add cleanup logic here if needed
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  // Add cleanup logic here if needed
  process.exit(0);
});

// Start the application
async function main() {
  try {
    const app = new App();
    await app.start();
    
    logger.info('MLanim Backend Server is running', {
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  logger.error('Application startup failed', { error });
  process.exit(1);
});
