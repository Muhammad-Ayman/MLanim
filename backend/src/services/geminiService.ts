import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { GeminiResponse } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    // Try the latest model names - gemini-1.5-flash or gemini-1.5-pro
    try {
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (error) {
      // Fallback to gemini-1.5-pro if flash is not available
      try {
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      } catch (fallbackError) {
        // Final fallback to the original gemini-pro
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      }
    }
  }

  /**
   * Generate Manim code from a natural language prompt
   */
  async generateManimCode(prompt: string): Promise<GeminiResponse> {
    try {
      logger.info('Generating Manim code from prompt', { prompt: prompt.substring(0, 100) });

      // Test API connection first
      await this.testApiConnection();

      const systemPrompt = `You are an expert in mathematical animations and the Manim library. 
      Generate valid Python code using Manim based on the user's description.
      
      Requirements:
      - Use only standard Manim imports and functions
      - Create a complete, runnable Python script
      - Include proper scene class definition
      - Use meaningful variable names and add comments
      - Keep animations simple but engaging
      - Ensure the code will render without errors
      
      Return ONLY the Python code, no explanations or markdown formatting.
      
      User prompt: ${prompt}`;

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      // Clean up the response to extract just the code
      const code = this.extractCodeFromResponse(text);

      logger.info('Successfully generated Manim code', {
        codeLength: code.length,
        promptLength: prompt.length,
      });

      return {
        code,
        explanation: `Generated Manim code for: ${prompt}`,
      };
    } catch (error) {
      logger.error('Error generating Manim code', { error, prompt });

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('Invalid or expired Gemini API key. Please check your configuration.');
        } else if (error.message.includes('model') || error.message.includes('404')) {
          throw new Error(
            'Gemini model not available. Please check your API access and model availability.'
          );
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
          throw new Error('API quota exceeded or rate limited. Please try again later.');
        } else {
          throw new Error(`Failed to generate Manim code: ${error.message}`);
        }
      } else {
        throw new Error('Failed to generate Manim code: Unknown error occurred');
      }
    }
  }

  /**
   * Test API connection and model availability
   */
  private async testApiConnection(): Promise<void> {
    try {
      // Try a simple test prompt
      const testResult = await this.model.generateContent('Hello');
      await testResult.response;
      logger.info('Gemini API connection test successful');
    } catch (error) {
      logger.error('Gemini API connection test failed', { error });
      throw new Error(
        `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract clean Python code from Gemini response
   */
  private extractCodeFromResponse(response: string): string {
    // Remove markdown code blocks if present
    let code = response.replace(/```python\s*/g, '').replace(/```\s*$/g, '');

    // Remove any leading/trailing whitespace
    code = code.trim();

    // Ensure the code starts with imports
    if (!code.includes('from manim import') && !code.includes('import manim')) {
      // Add basic Manim import if missing
      code = 'from manim import *\n\n' + code;
    }

    // Ensure there's a scene class
    if (!code.includes('class') || !code.includes('Scene')) {
      // Add basic scene structure if missing
      code = code + '\n\nclass GeneratedScene(Scene):\n    def construct(self):\n        pass';
    }

    return code;
  }

  /**
   * Validate that the generated code is safe and contains expected elements
   */
  validateGeneratedCode(code: string): boolean {
    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+sys/,
      /eval\s*\(/,
      /exec\s*\(/,
      /__import__\s*\(/,
      /open\s*\(/,
      /file\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        logger.warn('Generated code contains potentially dangerous patterns', {
          pattern: pattern.source,
        });
        return false;
      }
    }

    // Check for required Manim elements
    const requiredPatterns = [/from\s+manim\s+import/, /class\s+\w+.*Scene/, /def\s+construct/];

    for (const pattern of requiredPatterns) {
      if (!pattern.test(code)) {
        logger.warn('Generated code missing required Manim elements', { pattern: pattern.source });
        return false;
      }
    }

    return true;
  }
}
