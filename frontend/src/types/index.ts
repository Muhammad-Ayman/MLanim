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
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

export interface AnimationJob {
  id: string;
  prompt: string;
  status: JobStatus['status'];
  videoUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
