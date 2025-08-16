import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { config, validateConfig } from './config';
import { logger, loggerStream } from './utils/logger';
import animationRoutes from './routes/animationRoutes';
import systemRoutes from './routes/systemRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export class App {
  public app: express.Application;

  constructor() {
    // Validate configuration before starting
    validateConfig();

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'"],
            connectSrc: ["'self'"],
          },
        },
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === 'production'
            ? ['https://yourdomain.com'] // Replace with your domain
            : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
        optionsSuccessStatus: 200, // Some legacy browsers choke on 204
      })
    );

    // Request logging
    this.app.use(morgan('combined', { stream: loggerStream }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.headers['x-request-id'] =
        req.headers['x-request-id'] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      next();
    });

    // Static file serving for outputs
    this.app.use(
      '/outputs',
      express.static(path.join(process.cwd(), 'outputs'), {
        maxAge: '1h',
        etag: true,
        lastModified: true,
      })
    );
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.nodeEnv,
      });
    });

    // API routes
    this.app.use('/api/animations', animationRoutes);
    this.app.use('/api/system', systemRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'MLanim API Server',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          generate: '/api/animations/generate',
          status: '/api/animations/status/:id',
          jobs: '/api/animations/jobs',
        },
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler for unmatched routes
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Ensure output directories exist
      const fs = await import('fs');
      const outputsDir = path.join(process.cwd(), 'outputs');
      const tempDir = path.join(process.cwd(), 'temp');
      const logsDir = path.join(process.cwd(), 'logs');

      await fs.promises.mkdir(outputsDir, { recursive: true });
      await fs.promises.mkdir(tempDir, { recursive: true });
      await fs.promises.mkdir(logsDir, { recursive: true });

      this.app.listen(config.server.port, () => {
        logger.info(`Server started successfully`, {
          port: config.server.port,
          environment: config.server.nodeEnv,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server gracefully...');

    // Close any open connections here if needed

    process.exit(0);
  }
}
