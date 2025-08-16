import React from 'react';
import { Clock, Play, CheckCircle, XCircle, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { JobStatus } from '../types';

interface StatusDisplayProps {
  jobStatus: JobStatus | null;
  onDownload?: () => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    text: 'Pending',
    description: 'Your animation is queued and waiting to be processed...'
  },
  running: {
    icon: Play,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    text: 'Processing',
    description: 'Your animation is being generated. This may take a few minutes...'
  },
  done: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    text: 'Complete',
    description: 'Your animation is ready!'
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    text: 'Error',
    description: 'Something went wrong while generating your animation.'
  }
};

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ jobStatus, onDownload }) => {
  if (!jobStatus) return null;

  const config = statusConfig[jobStatus.status];
  const IconComponent = config.icon;

  return (
    <div className={clsx(
      "card max-w-2xl mx-auto animate-fade-in",
      config.bgColor,
      config.borderColor
    )}>
      <div className="flex items-start gap-4">
        <div className={clsx("p-3 rounded-full", config.bgColor)}>
          <IconComponent className={clsx("w-6 h-6", config.color)} />
        </div>
        
        <div className="flex-1">
          <h3 className={clsx("text-lg font-semibold mb-2", config.color)}>
            {config.text}
          </h3>
          
          <p className="text-gray-700 mb-4">
            {config.description}
          </p>

          {/* Progress bar for running status */}
          {jobStatus.status === 'running' && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{jobStatus.progress || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${jobStatus.progress || 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Error details */}
          {jobStatus.status === 'error' && jobStatus.error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Error Details:</p>
              <p className="text-sm text-red-700 mt-1">{jobStatus.error}</p>
            </div>
          )}

          {/* Video player for completed animations */}
          {jobStatus.status === 'done' && jobStatus.videoUrl && (
            <div className="mb-4">
              <video
                controls
                className="w-full rounded-lg shadow-sm"
                preload="metadata"
              >
                <source src={jobStatus.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {jobStatus.status === 'done' && jobStatus.videoUrl && (
              <button
                onClick={onDownload}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Video
              </button>
            )}
            
            {jobStatus.status === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Job info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Job ID: {jobStatus.id}</span>
              <span>Created: {new Date(jobStatus.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
