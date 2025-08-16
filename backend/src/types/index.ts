export interface GenerateRequest {
  prompt: string;
}

export interface GenerateResponse {
  jobId: string;
  message: string;
  code: string;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress?: number;
  videoUrl?: string;
  error?: string;
  code?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeminiResponse {
  code: string;
  explanation?: string;
}

export interface CodeRegenerationRequest {
  originalPrompt: string;
  failedCode: string;
  error: string;
  jobId: string;
}

export interface CodeRegenerationResponse {
  newCode: string;
  explanation: string;
  originalError: string;
  regenerationCount: number;
}

export interface RenderJob {
  id: string;
  prompt: string;
  code: string;
  status: 'pending' | 'running' | 'done' | 'error';
  outputPath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  regenerationCount?: number;
  originalJobId?: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}
