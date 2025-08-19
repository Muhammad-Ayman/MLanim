import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface PromptInputProps {
  onSubmit: (prompt: string, provider?: 'gemini' | 'together', model?: string) => void;
  isLoading: boolean;
}

const examplePrompts = [
  'Create a bouncing ball animation with gravity',
  'Show a circle transforming into a square',
  'Animate a sine wave with moving dots',
  'Create a rotating cube with 3D perspective',
  'Show a growing tree with branches',
  'Animate a particle system explosion',
];

export const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [provider, setProvider] = useState<'gemini' | 'together'>('gemini');
  const [model, setModel] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim(), provider, model || undefined);
      setPrompt('');
    }
  };

  const handleExampleClick = (examplePrompt: string) => {
    setPrompt(examplePrompt);
    setIsExpanded(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the animation you want to create... (e.g., 'Create a bouncing ball with gravity')"
            className={clsx(
              'input-field min-h-[120px] resize-none pr-12',
              'text-lg leading-relaxed',
              'focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              isLoading && 'opacity-60 cursor-not-allowed'
            )}
            disabled={isLoading}
            maxLength={1000}
          />

          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className={clsx(
              'absolute right-3 bottom-3 p-2 rounded-lg transition-all duration-200',
              'bg-primary-600 hover:bg-primary-700 text-white',
              'disabled:bg-gray-400 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Character count and provider/model selector */}
        <div className="flex flex-col gap-2 mt-2 text-sm text-gray-500">
          <div className="flex justify-between items-center">
            <span>{prompt.length}/1000 characters</span>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {isExpanded ? 'Hide' : 'Show'} examples
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <div className="flex items-center gap-2">
              <label className="text-gray-600">Provider</label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as 'gemini' | 'together')}
                className="border rounded-md px-2 py-1 text-gray-700"
                disabled={isLoading}
              >
                <option value="gemini">Gemini</option>
                <option value="together">Together</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <label className="text-gray-600">Model</label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder={
                  provider === 'gemini'
                    ? 'gemini-1.5-flash'
                    : 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
                }
                className="border rounded-md px-2 py-1 w-full text-gray-700"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </form>

      {/* Example prompts */}
      {isExpanded && (
        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm animate-slide-up">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Try these examples:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {examplePrompts.map((examplePrompt, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(examplePrompt)}
                className="text-left p-3 text-sm text-gray-600 hover:bg-gray-50 rounded-md transition-colors border border-gray-200 hover:border-primary-300"
              >
                {examplePrompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
