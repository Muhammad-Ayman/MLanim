import { Request, Response } from 'express';
import { spawn } from 'child_process';
import { logger } from '../utils/logger';

export class SystemController {
  /**
   * Get all Docker containers
   */
  async getDockerContainers(req: Request, res: Response): Promise<void> {
    try {
      const containers = await this.listDockerContainers();

      res.status(200).json({
        containers,
        count: containers.length,
        message: 'Docker containers retrieved successfully',
      });
    } catch (error) {
      logger.error('Failed to get Docker containers', { error });
      res.status(500).json({
        message: 'Failed to get Docker containers',
        code: 'DOCKER_CONTAINERS_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Kill a specific Docker container
   */
  async killDockerContainer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Container ID is required',
          code: 'MISSING_CONTAINER_ID',
        });
        return;
      }

      await this.killContainer(id);

      res.status(200).json({
        message: 'Container killed successfully',
        containerId: id,
      });
    } catch (error) {
      logger.error('Failed to kill Docker container', { error, containerId: req.params.id });
      res.status(500).json({
        message: 'Failed to kill Docker container',
        code: 'DOCKER_KILL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Kill all running Docker containers
   */
  async killAllDockerContainers(req: Request, res: Response): Promise<void> {
    try {
      const containers = await this.listDockerContainers();
      const runningContainers = containers.filter(c => c.State === 'running');

      let killedCount = 0;
      for (const container of runningContainers) {
        try {
          await this.killContainer(container.Id);
          killedCount++;
        } catch (error) {
          logger.warn('Failed to kill container', { containerId: container.Id, error });
        }
      }

      res.status(200).json({
        message: 'All running containers killed',
        totalContainers: runningContainers.length,
        killedCount,
      });
    } catch (error) {
      logger.error('Failed to kill all Docker containers', { error });
      res.status(500).json({
        message: 'Failed to kill all Docker containers',
        code: 'DOCKER_KILL_ALL_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get system resource usage
   */
  async getSystemResources(req: Request, res: Response): Promise<void> {
    try {
      const resources = await this.getResourceUsage();

      res.status(200).json({
        resources,
        timestamp: new Date().toISOString(),
        message: 'System resources retrieved successfully',
      });
    } catch (error) {
      logger.error('Failed to get system resources', { error });
      res.status(500).json({
        message: 'Failed to get system resources',
        code: 'SYSTEM_RESOURCES_FAILED',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List Docker containers using docker ps command
   */
  private async listDockerContainers(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const dockerProcess = spawn('docker', ['ps', '-a', '--format', 'json']);

      let stdout = '';
      let stderr = '';

      dockerProcess.stdout?.on('data', data => {
        stdout += data.toString();
      });

      dockerProcess.stderr?.on('data', data => {
        stderr += data.toString();
      });

      dockerProcess.on('close', code => {
        if (code === 0) {
          try {
            // Parse each line as JSON
            const containers = stdout
              .trim()
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                try {
                  return JSON.parse(line);
                } catch (parseError) {
                  logger.warn('Failed to parse container JSON', { line, parseError });
                  return null;
                }
              })
              .filter(container => container !== null);

            resolve(containers);
          } catch (error) {
            reject(new Error(`Failed to parse Docker output: ${error}`));
          }
        } else {
          reject(new Error(`Docker command failed with code ${code}: ${stderr}`));
        }
      });

      dockerProcess.on('error', error => {
        reject(new Error(`Docker command error: ${error.message}`));
      });
    });
  }

  /**
   * Kill a Docker container
   */
  private async killContainer(containerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const killProcess = spawn('docker', ['kill', containerId]);

      killProcess.on('close', code => {
        if (code === 0) {
          logger.info('Container killed successfully', { containerId });
          resolve();
        } else {
          reject(new Error(`Failed to kill container ${containerId} with code ${code}`));
        }
      });

      killProcess.on('error', error => {
        reject(new Error(`Failed to kill container ${containerId}: ${error.message}`));
      });
    });
  }

  /**
   * Get system resource usage
   */
  private async getResourceUsage(): Promise<any> {
    return new Promise((resolve, reject) => {
      // Get Docker stats for running containers
      const dockerProcess = spawn('docker', ['stats', '--no-stream', '--format', 'json']);

      let stdout = '';
      let stderr = '';

      dockerProcess.stdout?.on('data', data => {
        stdout += data.toString();
      });

      dockerProcess.stderr?.on('data', data => {
        stderr += data.toString();
      });

      dockerProcess.on('close', code => {
        if (code === 0) {
          try {
            const containerStats = stdout
              .trim()
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                try {
                  return JSON.parse(line);
                } catch (parseError) {
                  return null;
                }
              })
              .filter(stat => stat !== null);

            // Calculate total resource usage
            const totalStats = containerStats.reduce(
              (acc, stat) => {
                // Parse memory usage (e.g., "1.5GiB" -> 1.5)
                const memoryMatch = stat.MemPerc?.match(/(\d+\.?\d*)/);
                const memory = memoryMatch ? parseFloat(memoryMatch[1]) : 0;

                // Parse CPU usage (e.g., "0.50%" -> 0.5)
                const cpuMatch = stat.CPUPerc?.match(/(\d+\.?\d*)/);
                const cpu = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

                return {
                  memory: acc.memory + memory,
                  cpu: acc.cpu + cpu,
                  containers: acc.containers + 1,
                };
              },
              { memory: 0, cpu: 0, containers: 0 }
            );

            resolve({
              containers: totalStats,
              stats: containerStats,
            });
          } catch (error) {
            reject(new Error(`Failed to parse Docker stats: ${error}`));
          }
        } else {
          // If no containers are running, return empty stats
          resolve({
            containers: { memory: 0, cpu: 0, containers: 0 },
            stats: [],
          });
        }
      });

      dockerProcess.on('error', error => {
        reject(new Error(`Docker stats error: ${error.message}`));
      });
    });
  }
}
