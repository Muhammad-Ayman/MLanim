import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { AnimationApiService } from '../services/api';

interface HealthStatus {
  backend: boolean;
  lastChecked: Date | null;
  error?: string;
}

export const HealthCheck: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    backend: false,
    lastChecked: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      await AnimationApiService.healthCheck();
      setHealthStatus({
        backend: true,
        lastChecked: new Date(),
        error: undefined,
      });
    } catch (error) {
      setHealthStatus({
        backend: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();

    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (isChecking) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    return healthStatus.backend ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    return healthStatus.backend ? 'Connected' : 'Disconnected';
  };

  const getStatusColor = () => {
    if (isChecking) return 'text-gray-600';
    return healthStatus.backend ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">Backend:</span>
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        <span className={getStatusColor()}>{getStatusText()}</span>
      </div>
      {healthStatus.lastChecked && (
        <span className="text-gray-400 text-xs">
          ({healthStatus.lastChecked.toLocaleTimeString()})
        </span>
      )}
      <button
        onClick={checkHealth}
        disabled={isChecking}
        className="ml-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        title="Check health status"
      >
        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};
