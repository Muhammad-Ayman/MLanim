import React from 'react';
import { Sparkles, Github, ExternalLink } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MLanim</h1>
              <p className="text-sm text-gray-500">AI-Powered Mathematical Animations</p>
            </div>
          </div>

          {/* Navigation and actions */}
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
    </header>
  );
};
