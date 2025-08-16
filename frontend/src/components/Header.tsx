import React from 'react';
import { Sparkles, Github, ExternalLink, Play, Settings } from 'lucide-react';
import { HealthCheck } from './HealthCheck';
import { OperationStatus } from './OperationStatus';

interface HeaderProps {
  activeTab: 'generator' | 'processes';
  onTabChange: (tab: 'generator' | 'processes') => void;
  currentOperation?: {
    status: 'pending' | 'running' | 'done' | 'error' | null;
    progress?: number;
    currentOperation?: string;
  };
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, currentOperation }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MLanim</h1>
              <p className="text-sm text-gray-500">AI-Powered Mathematical Animations</p>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange('generator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'generator'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>Generator</span>
            </button>

            <button
              onClick={() => onTabChange('processes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'processes'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Processes</span>
            </button>
          </div>

          {/* Current Operation Status */}
          {currentOperation?.status && (
            <OperationStatus
              status={currentOperation.status}
              progress={currentOperation.progress}
              currentOperation={currentOperation.currentOperation}
              isCompact={true}
            />
          )}

          {/* Health check and external links */}
          <div className="flex items-center gap-4">
            <HealthCheck />

            <nav className="flex items-center gap-4">
              <a
                href="https://github.com/yourusername/mlanim"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <Github className="w-4 h-4" />
                <span className="hidden sm:inline">GitHub</span>
              </a>

              <a
                href="https://docs.manim.community/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Manim Docs</span>
              </a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
