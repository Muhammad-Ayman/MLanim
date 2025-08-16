import React, { useState, useEffect } from 'react';
import { Download, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { JobStatus } from '../types';
import { AnimationApiService } from '../services/api';
import { OperationStatus } from './OperationStatus';

interface StatusDisplayProps {
  jobStatus: JobStatus | null;
  onDownload?: () => void;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ jobStatus, onDownload }) => {
  const [manimOutputs, setManimOutputs] = useState<any[]>([]);
  const [showOutputs, setShowOutputs] = useState(false);
  const [isLoadingOutputs, setIsLoadingOutputs] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle job deletion
  const handleDelete = async () => {
    if (!jobStatus?.id) return;

    if (
      !window.confirm(
        'Are you sure you want to delete this job? This action cannot be undone and will remove all associated files and data.'
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      await AnimationApiService.deleteJob(jobStatus.id);

      // Show success message and refresh the page
      alert('Job deleted successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert(`Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Fetch Manim outputs when job is running
  useEffect(() => {
    if (jobStatus?.status === 'running' || jobStatus?.status === 'done') {
      const fetchOutputs = async () => {
        try {
          setIsLoadingOutputs(true);
          const response = await AnimationApiService.getManimOutputs(jobStatus.id);
          if (response.outputs) {
            setManimOutputs(response.outputs);
          }
        } catch (error) {
          console.error('Failed to fetch Manim outputs:', error);
        } finally {
          setIsLoadingOutputs(false);
        }
      };

      fetchOutputs();

      // Poll for updates every 2 seconds when running
      if (jobStatus.status === 'running') {
        const interval = setInterval(fetchOutputs, 2000);
        return () => clearInterval(interval);
      }
    }
  }, [jobStatus?.id, jobStatus?.status]);

  if (!jobStatus) return null;

  // Get current operation from Manim outputs
  const currentOperation =
    manimOutputs.length > 0
      ? manimOutputs[manimOutputs.length - 1]?.data
      : jobStatus.status === 'pending'
        ? 'Waiting in queue...'
        : 'Initializing...';

  return (
    <div className="card max-w-2xl mx-auto animate-fade-in">
      {/* Use the new OperationStatus component for clean status display */}
      <OperationStatus
        status={jobStatus.status}
        progress={jobStatus.progress}
        currentOperation={currentOperation}
      />

      {/* Additional details section */}
      <div className="mt-4">
        {/* Queue position indicator for pending jobs */}
        {jobStatus.status === 'pending' && (
          <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
            ⏳ Job is queued and will start processing soon
          </div>
        )}

        {/* Real-time Manim Output Display - Collapsible */}
        <div className="mb-4">
          <button
            onClick={() => setShowOutputs(!showOutputs)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-2"
          >
            {showOutputs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Manim Output ({manimOutputs.length})</span>
            {isLoadingOutputs && (
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
          </button>

          {showOutputs && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
              {manimOutputs.length > 0 ? (
                <div className="space-y-2">
                  {manimOutputs.slice(-20).map((output, index) => (
                    <div key={index} className="text-xs font-mono">
                      <span className="text-gray-500">
                        [{new Date(output.timestamp).toLocaleTimeString()}]
                      </span>
                      <span
                        className={`ml-2 ${
                          output.type === 'progress'
                            ? 'text-blue-600 font-medium'
                            : output.type === 'stderr'
                              ? 'text-red-600'
                              : output.type === 'stdout'
                                ? 'text-gray-700'
                                : 'text-gray-600'
                        }`}
                      >
                        {output.data}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {jobStatus.status === 'pending'
                    ? 'Waiting for Manim output... Output will appear here once processing begins.'
                    : 'No Manim output yet. Output will appear here as the animation processes.'}
                </div>
              )}
              {manimOutputs.length > 20 && (
                <div className="text-xs text-gray-500 mt-2 text-center">
                  Showing last 20 outputs of {manimOutputs.length} total
                </div>
              )}
            </div>
          )}
        </div>

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
            <video controls className="w-full rounded-lg shadow-sm" preload="metadata">
              <source src={jobStatus.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {jobStatus.status === 'done' && jobStatus.videoUrl && (
            <button onClick={onDownload} className="btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Video
            </button>
          )}

          {jobStatus.status === 'error' && (
            <button onClick={() => window.location.reload()} className="btn-secondary">
              Try Again
            </button>
          )}

          {/* Delete button - available for all job statuses */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete Job'}
          </button>
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
  );
};
