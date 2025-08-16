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
Generate valid Python code using the manimcommunity/manim package.

Validation rules:
- Imports: use only "from manim import *" plus standard library modules when needed (e.g., import random, import math)
- Must define exactly one Scene subclass with a construct(self) method
- If a standard library function (like random, math.sin, etc.) is used, include the correct import
- Do NOT invent helpers or functions that don't exist in manimcommunity/manim or the Python standard library
- Use clear and meaningful variable names
- Add concise comments explaining steps
- Keep animations simple but visually engaging
- Ensure the script is complete, runnable, and will render without syntax or runtime errors
- Output ONLY the final Python code, no markdown or explanations

User prompt: ${prompt}`;

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      // Log the full Gemini response for debugging
      logger.info('Gemini API response received', {
        prompt: prompt.substring(0, 100),
        responseLength: text.length,
        fullResponse: text,
        responseType: typeof text,
      });

      // Clean up the response to extract just the code
      const code = this.extractCodeFromResponse(text);

      logger.info('Code extraction completed', {
        prompt: prompt.substring(0, 100),
        extractedCodeLength: code ? code.length : 0,
        extractedCode: code,
        hasCode: !!code,
      });

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
   * Regenerate Manim code when the original code fails, using error context
   */
  async regenerateManimCode(
    originalPrompt: string,
    failedCode: string,
    error: string,
    regenerationCount: number = 1
  ): Promise<GeminiResponse> {
    try {
      logger.info('Regenerating Manim code due to failure', {
        originalPrompt: originalPrompt.substring(0, 100),
        error: error.substring(0, 200),
        regenerationCount,
      });

      // Test API connection first
      await this.testApiConnection();

      const systemPrompt = `You are an expert in mathematical animations and the Manim library. 
The previous code generation failed with an error. Please analyze the error and generate corrected code.

ORIGINAL PROMPT: ${originalPrompt}

FAILED CODE:
\`\`\`python
${failedCode}
\`\`\`

ERROR MESSAGE: ${error}

INSTRUCTIONS:
1. Analyze the error message carefully
2. Identify what went wrong in the failed code
3. Fix the specific issues that caused the error
4. Generate corrected Python code using the manimcommunity/manim package
5. Ensure the corrected code addresses the specific error that occurred
6. Keep the same animation concept but fix the implementation issues

Validation rules:
- Imports: use only "from manim import *" plus standard library modules when needed
- Must define exactly one Scene subclass with a construct(self) method
- Do NOT invent helpers or functions that don't exist in manimcommunity/manim or the Python standard library
- Use clear and meaningful variable names
- Add concise comments explaining the fixes made
- Keep animations simple but visually engaging
- Ensure the script is complete, runnable, and will render without the previous error
- Output ONLY the corrected Python code, no markdown or explanations

This is regeneration attempt #${regenerationCount}. Make sure to fix the specific error that occurred.`;

      const result = await this.model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      // Log the regeneration response for debugging
      logger.info('Gemini regeneration response received', {
        originalPrompt: originalPrompt.substring(0, 100),
        error: error.substring(0, 200),
        responseLength: text.length,
        regenerationCount,
      });

      // Clean up the response to extract just the code
      const code = this.extractCodeFromResponse(text);

      logger.info('Code regeneration completed', {
        originalPrompt: originalPrompt.substring(0, 100),
        extractedCodeLength: code ? code.length : 0,
        regenerationCount,
      });

      return {
        code,
        explanation: `Regenerated Manim code (attempt #${regenerationCount}) to fix error: ${error.substring(0, 100)}`,
      };
    } catch (error) {
      logger.error('Error regenerating Manim code', {
        error,
        originalPrompt: originalPrompt.substring(0, 100),
        failedCode: failedCode.substring(0, 200),
        regenerationCount,
      });

      // Provide more specific error messages for regeneration
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
          throw new Error(`Failed to regenerate Manim code: ${error.message}`);
        }
      } else {
        throw new Error('Failed to regenerate Manim code: Unknown error occurred');
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
