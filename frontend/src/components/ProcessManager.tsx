import { useState, useEffect } from 'react';
import { Play, Square, Eye, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Process {
  id: string;
  type: 'job' | 'docker' | 'system';
  name: string;
  status: string;
  progress?: number;
  memory?: string;
  cpu?: string;
  uptime?: string;
  details?: any;
}

interface Job {
  id: string;
  status: string;
  progress: number;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

const ProcessManager: React.FC = () => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dockerContainers, setDockerContainers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all data
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Fetch jobs
      const jobsResponse = await fetch('/api/animations/jobs');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobs(jobsData.jobs || []);
      }

      // Fetch Docker containers
      const dockerResponse = await fetch('/api/system/docker/containers');
      if (dockerResponse.ok) {
        const dockerData = await dockerResponse.json();
        setDockerContainers(dockerData.containers || []);
      }

      // Combine all processes
      const allProcesses: Process[] = [];

      // Add jobs as processes
      jobs.forEach(job => {
        allProcesses.push({
          id: job.id,
          type: 'job',
          name: `Job ${job.id}`,
          status: job.status,
          progress: job.progress,
          uptime: new Date(job.updatedAt).toLocaleTimeString(),
          details: job,
        });
      });

      // Add Docker containers as processes
      dockerContainers.forEach(container => {
        allProcesses.push({
          id: container.Id,
          type: 'docker',
          name: container.Names?.[0] || container.Id.substring(0, 12),
          status: container.State,
          memory: container.MemUsage,
          cpu: container.CPUPerc,
          uptime: container.RunningFor,
          details: container,
        });
      });

      setProcesses(allProcesses);
    } catch (error) {
      console.error('Failed to fetch process data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Manual refresh
  const handleRefresh = () => {
    fetchAllData();
  };

  // Kill a specific process
  const killProcess = async (process: Process) => {
    try {
      if (process.type === 'job') {
        // Kill job
        const response = await fetch(`/api/animations/kill/${process.id}`, {
          method: 'POST',
        });
        if (response.ok) {
          console.log(`Job ${process.id} killed successfully`);
        }
      } else if (process.type === 'docker') {
        // Kill Docker container
        const response = await fetch(`/api/system/docker/kill/${process.id}`, {
          method: 'POST',
        });
        if (response.ok) {
          console.log(`Container ${process.id} killed successfully`);
        }
      }

      // Refresh data
      setTimeout(fetchAllData, 1000);
    } catch (error) {
      console.error(`Failed to kill process ${process.id}:`, error);
    }
  };

  // Kill all processes
  const killAllProcesses = async () => {
    if (
      !confirm(
        'Are you sure you want to kill ALL processes? This will stop all animations and containers.'
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      // Kill all jobs
      for (const job of jobs) {
        if (job.status === 'running' || job.status === 'pending') {
          await fetch(`/api/animations/kill/${job.id}`, { method: 'POST' });
        }
      }

      // Kill all Docker containers
      for (const container of dockerContainers) {
        if (container.State === 'running') {
          await fetch(`/api/system/docker/kill/${container.Id}`, { method: 'POST' });
        }
      }

      // Refresh data
      setTimeout(fetchAllData, 2000);
    } catch (error) {
      console.error('Failed to kill all processes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'pending':
      case 'waiting':
        return 'text-yellow-600 bg-yellow-100';
      case 'completed':
      case 'done':
        return 'text-blue-600 bg-blue-100';
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'active':
        return <Play className="w-4 h-4 text-green-600" />;
      case 'pending':
      case 'waiting':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'completed':
      case 'done':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Process Manager</h1>
          <p className="text-gray-600">Monitor and manage all running processes</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={killAllProcesses}
            disabled={isLoading || processes.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
          >
            <Square className="w-4 h-4" />
            <span>Kill All</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh every 5 seconds
          </label>
          <span className="text-sm text-gray-500">{processes.length} total processes</span>
        </div>
      </div>

      {/* Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {processes.map(process => (
          <div
            key={`${process.type}-${process.id}`}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow"
          >
            {/* Process Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(process.status)}`}
                >
                  {process.type.toUpperCase()}
                </span>
                {getStatusIcon(process.status)}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedProcess(process);
                    setShowDetails(true);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => killProcess(process)}
                  className="p-1 text-red-400 hover:text-red-600"
                  title="Kill Process"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Process Info */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 truncate">{process.name}</h3>
              <p className="text-sm text-gray-600">ID: {process.id}</p>
              <p className="text-sm text-gray-600">Status: {process.status}</p>

              {/* Progress bar for jobs */}
              {process.type === 'job' && process.progress !== undefined && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${process.progress}%` }}
                  ></div>
                </div>
              )}

              {/* Resource usage for Docker containers */}
              {process.type === 'docker' && (
                <div className="text-xs text-gray-500 space-y-1">
                  {process.memory && <p>Memory: {process.memory}</p>}
                  {process.cpu && <p>CPU: {process.cpu}</p>}
                </div>
              )}

              {process.uptime && <p className="text-xs text-gray-500">Uptime: {process.uptime}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {processes.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No processes found</h3>
          <p className="text-gray-500">
            All processes have been stopped or there are no active jobs.
          </p>
        </div>
      )}

      {/* Process Details Modal */}
      {showDetails && selectedProcess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-900">{selectedProcess.name} Details</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="text-sm text-gray-900">{selectedProcess.type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <p className="text-sm text-gray-900">{selectedProcess.status}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ID</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedProcess.id}</p>
                  </div>
                  {selectedProcess.uptime && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Uptime</label>
                      <p className="text-sm text-gray-900">{selectedProcess.uptime}</p>
                    </div>
                  )}
                </div>

                {/* Job-specific details */}
                {selectedProcess.type === 'job' && selectedProcess.details && (
                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Job Information</h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Prompt:</span>{' '}
                        {selectedProcess.details.prompt}
                      </p>
                      <p>
                        <span className="font-medium">Progress:</span>{' '}
                        {selectedProcess.details.progress}%
                      </p>
                      <p>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(selectedProcess.details.createdAt).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-medium">Updated:</span>{' '}
                        {new Date(selectedProcess.details.updatedAt).toLocaleString()}
                      </p>
                      {selectedProcess.details.error && (
                        <p>
                          <span className="font-medium text-red-600">Error:</span>{' '}
                          {selectedProcess.details.error}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Docker-specific details */}
                {selectedProcess.type === 'docker' && selectedProcess.details && (
                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-2">Container Information</h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Image:</span> {selectedProcess.details.Image}
                      </p>
                      <p>
                        <span className="font-medium">Command:</span>{' '}
                        {selectedProcess.details.Command}
                      </p>
                      <p>
                        <span className="font-medium">Ports:</span>{' '}
                        {selectedProcess.details.Ports || 'None'}
                      </p>
                      <p>
                        <span className="font-medium">Created:</span>{' '}
                        {selectedProcess.details.CreatedAt}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      killProcess(selectedProcess);
                      setShowDetails(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                  >
                    <Square className="w-4 h-4" />
                    <span>Kill Process</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessManager;
