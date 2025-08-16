import React from 'react';
import { Clock, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface OperationStatusProps {
  status: 'pending' | 'running' | 'done' | 'error' | null;
  progress?: number;
  currentOperation?: string;
  isCompact?: boolean;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    text: 'Queued',
    description: 'Waiting to start...',
  },
  running: {
    icon: Play,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    text: 'Processing',
    description: 'Generating animation...',
  },
  done: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    text: 'Complete',
    description: 'Animation ready!',
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    text: 'Error',
    description: 'Generation failed',
  },
};

export const OperationStatus: React.FC<OperationStatusProps> = ({
  status,
  progress,
  currentOperation,
  isCompact = false,
}) => {
  if (!status) return null;

  const config = statusConfig[status];
  const IconComponent = config.icon;

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm">
        <div className={clsx('p-1.5 rounded-full', config.bgColor)}>
          <IconComponent className={clsx('w-4 h-4', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={clsx('text-sm font-medium', config.color)}>{config.text}</span>
            {status === 'running' && progress !== undefined && (
              <span className="text-xs text-gray-500">{progress}%</span>
            )}
          </div>
          {currentOperation && <p className="text-xs text-gray-600 truncate">{currentOperation}</p>}
        </div>
        {status === 'running' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
      </div>
    );
  }

  return (
    <div className={clsx('p-4 rounded-lg border', config.bgColor, config.borderColor)}>
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-full', config.bgColor)}>
          <IconComponent className={clsx('w-5 h-5', config.color)} />
        </div>
        <div className="flex-1">
          <h3 className={clsx('text-lg font-semibold mb-1', config.color)}>{config.text}</h3>
          <p className="text-gray-700 mb-3">{config.description}</p>

          {status === 'running' && progress !== undefined && (
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {currentOperation && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Current:</span> {currentOperation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
