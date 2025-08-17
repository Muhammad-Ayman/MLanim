import axios, { AxiosResponse } from 'axios';
import { GenerateRequest, GenerateResponse, JobStatus } from '../types';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  config => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  error => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export class AnimationApiService {
  /**
   * Generate animation from prompt
   */
  static async generateAnimation(prompt: string): Promise<GenerateResponse> {
    try {
      const response = await api.post<GenerateResponse>('/animations/generate', {
        prompt,
      } as GenerateRequest);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(error.response.data.message || 'Failed to generate animation');
      }
      throw new Error('Network error occurred');
    }
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await api.get<JobStatus>(`/animations/status/${jobId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(error.response.data.message || 'Failed to get job status');
      }
      throw new Error('Network error occurred');
    }
  }

  /**
   * Delete a job completely
   */
  static async deleteJob(jobId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/animations/delete/${jobId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(error.response.data.message || 'Failed to delete job');
      }
      throw new Error('Network error occurred');
    }
  }

  /**
   * Get Manim outputs for a job
   */
  static async getManimOutputs(jobId: string): Promise<{ outputs: any[] }> {
    try {
      const response = await api.get<{ outputs: any[] }>(`/animations/manim-output/${jobId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(error.response.data.message || 'Failed to get Manim outputs');
      }
      throw new Error('Network error occurred');
    }
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{ status: string }> {
    try {
      const response = await api.get<{ status: string }>('/health');
      return response.data;
    } catch (error) {
      throw new Error('Health check failed');
    }
  }
}

export default api;
