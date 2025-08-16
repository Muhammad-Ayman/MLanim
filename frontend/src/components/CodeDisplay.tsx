import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeDisplayProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}

const CodeDisplay: React.FC<CodeDisplayProps> = ({
  code,
  language = 'python',
  title = 'Generated Code',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          {/* Language indicator */}
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-3 text-sm text-gray-300 font-medium">{title}</span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <div className="relative">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '16px',
            paddingLeft: '64px', // Space for line numbers
            backgroundColor: '#1a1a1a',
          }}
          showLineNumbers={true}
          lineNumberStyle={{
            color: '#6b7280',
            backgroundColor: '#374151',
            paddingRight: '16px',
            minWidth: '48px',
            textAlign: 'right',
            userSelect: 'none',
          }}
          wrapLines={true}
          lineProps={{
            style: {
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{language.toUpperCase()}</span>
          <span>{code.split('\n').length} lines</span>
        </div>
      </div>
    </div>
  );
};

export default CodeDisplay;
