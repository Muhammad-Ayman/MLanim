import { promises as fs } from 'fs';
import path from 'path';

export class JobLogger {
  static async ensureJobDir(jobId: string): Promise<string> {
    const dir = path.join(process.cwd(), 'logs', 'jobs', jobId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  static async append(jobId: string, message: string, extra?: Record<string, any>): Promise<void> {
    const dir = await this.ensureJobDir(jobId);
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      message,
      ...(extra ? { extra } : {}),
    });
    await fs.appendFile(path.join(dir, 'job.log'), line + '\n', 'utf8');
  }

  static async saveCode(jobId: string, code: string, label: string): Promise<void> {
    const dir = await this.ensureJobDir(jobId);
    const safeLabel = label.replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(dir, `code.${safeLabel}.py`);
    await fs.writeFile(filePath, code, 'utf8');
    await this.append(jobId, 'Saved code snapshot', { label: safeLabel, path: filePath });
  }
}

