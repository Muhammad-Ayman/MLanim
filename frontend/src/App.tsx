import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { PromptInput } from './components/PromptInput';
import { StatusDisplay } from './components/StatusDisplay';
import ProcessManager from './components/ProcessManager';
import CodeDisplay from './components/CodeDisplay';
import { AnimationApiService } from './services/api';
import { JobStatus } from './types';
import { AlertCircle, CheckCircle, Sparkles, ExternalLink } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'processes'>('generator');
  const [isLoading, setIsLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Polling interval for job status
  const POLLING_INTERVAL = 3000; // 3 seconds

  // Show notification
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Handle prompt submission
  const handlePromptSubmit = async (prompt: string) => {
    try {
      setIsLoading(true);
      setJobStatus(null);

      const response = await AnimationApiService.generateAnimation(prompt);
      setCurrentJobId(response.jobId);

      // Store the generated code
      setGeneratedCode(response.code);

      // Set initial status
      setJobStatus({
        id: response.jobId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      showNotification('success', 'Animation generation started!');
    } catch (error) {
      showNotification(
        'error',
        error instanceof Error ? error.message : 'Failed to start animation generation'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for job status updates
  useEffect(() => {
    if (!currentJobId) return;

    const pollStatus = async () => {
      try {
        const status = await AnimationApiService.getJobStatus(currentJobId);
        setJobStatus(status);

        // Stop polling if job is complete or failed
        if (status.status === 'done' || status.status === 'error') {
          setCurrentJobId(null);
          if (status.status === 'done') {
            showNotification('success', 'Animation generated successfully!');
          } else {
            showNotification('error', 'Animation generation failed');
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval
    const interval = setInterval(pollStatus, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [currentJobId, showNotification]);

  // Handle video download
  const handleDownload = useCallback(() => {
    if (jobStatus?.videoUrl) {
      const link = document.createElement('a');
      link.href = jobStatus.videoUrl;
      link.download = `mlanim-${jobStatus.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [jobStatus]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 animate-slide-up">
          <div
            className={`
            flex items-center gap-3 p-4 rounded-lg shadow-lg max-w-sm
            ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
          `}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Content */}
        {activeTab === 'generator' ? (
          <>
            {/* Hero section */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Create Mathematical Animations with AI
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Describe any mathematical concept or animation in natural language, and watch as our
                AI generates beautiful Manim animations for you.
              </p>
            </div>

            {/* Main content */}
            <div className="space-y-8">
              {/* Prompt input */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  What would you like to animate?
                </h3>
                <PromptInput onSubmit={handlePromptSubmit} isLoading={isLoading} />
              </div>

              {/* Status display */}
              {jobStatus && <StatusDisplay jobStatus={jobStatus} onDownload={handleDownload} />}

              {/* Generated code display */}
              {generatedCode ? (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Manim Code</h3>
                  <CodeDisplay
                    code={generatedCode}
                    language="python"
                    title="Manim Animation Code"
                  />
                </div>
              ) : (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Manim Code</h3>
                  <div className="text-center py-8 text-gray-500">
                    <p>Enter a prompt above to generate Manim code</p>
                  </div>
                </div>
              )}

              {/* Info section */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="card text-center">
                  <div className="p-3 bg-blue-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI-Powered</h3>
                  <p className="text-gray-600 text-sm">
                    Uses Google Gemini to understand your descriptions and generate accurate Manim
                    code
                  </p>
                </div>

                <div className="card text-center">
                  <div className="p-3 bg-green-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Safe Execution</h3>
                  <p className="text-gray-600 text-sm">
                    All code runs in isolated Docker containers for security and reliability
                  </p>
                </div>

                <div className="card text-center">
                  <div className="p-3 bg-purple-100 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                    <ExternalLink className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">High Quality</h3>
                  <p className="text-gray-600 text-sm">
                    Professional-grade animations rendered with Manim's powerful engine
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <ProcessManager />
        )}
      </main>
    </div>
  );
}

export default App;
