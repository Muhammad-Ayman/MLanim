import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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

  // Simple syntax highlighting for Python/Manim code using inline styles
  const highlightCode = (code: string): string => {
    return code
      .replace(
        /\b(import|from|class|def|if|else|elif|for|while|try|except|finally|with|as|return|yield|break|continue|pass|raise|assert|del|global|nonlocal|lambda|and|or|not|is|in|True|False|None)\b/g,
        '<span style="color: #2563eb; font-weight: 600;">$1</span>'
      )
      .replace(/\b(self|cls)\b/g, '<span style="color: #9333ea; font-weight: 600;">$1</span>')
      .replace(
        /\b(Scene|Circle|Square|Rectangle|Line|Text|NumberPlane|Axes|Graph|VGroup|Animation|Create|Write|ShowCreation|FadeIn|FadeOut|Transform|MoveToTarget|GrowFromCenter|ShrinkToCenter|Rotate|Scale|Shift|ApplyMethod|Wait|UpdateFromFunc|AnimationGroup|Succession|LaggedStart|LaggedStartMap|TransformFromCopy|CopyFromCopy|ReplacementTransform|TransformMatchingParts|TransformMatchingTex|FadeTransform|FadeTransformPieces|ClockwiseTransform|CounterclockwiseTransform)\b/g,
        '<span style="color: #16a34a; font-weight: 600;">$1</span>'
      )
      .replace(
        /\b(UP|DOWN|LEFT|RIGHT|ORIGIN|PI|TAU|E|INF|NEG_INF)\b/g,
        '<span style="color: #ea580c; font-weight: 600;">$1</span>'
      )
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #dc2626;">$1</span>')
      .replace(/(#.*$)/gm, '<span style="color: #6b7280; font-style: italic;">$1</span>')
      .replace(
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*')/g,
        '<span style="color: #ca8a04;">$1</span>'
      );
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

      {/* Code content */}
      <div className="relative">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-800 text-right text-gray-500 text-sm select-none">
          {code.split('\n').map((_, index) => (
            <div key={index} className="px-2 py-0.5">
              {index + 1}
            </div>
          ))}
        </div>

        {/* Code with syntax highlighting */}
        <div className="ml-12 p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100 font-mono leading-relaxed">
            <code
              dangerouslySetInnerHTML={{
                __html: highlightCode(code),
              }}
            />
          </pre>
        </div>
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
