import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { GeminiResponse } from '../types';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Generate Manim code from a natural language prompt
   */
  async generateManimCode(prompt: string): Promise<GeminiResponse> {
    try {
      logger.info('Generating Manim code from prompt', { prompt: prompt.substring(0, 100) });

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
        promptLength: prompt.length 
      });

      return {
        code,
        explanation: `Generated Manim code for: ${prompt}`
      };
    } catch (error) {
      logger.error('Error generating Manim code', { error, prompt });
      throw new Error(`Failed to generate Manim code: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        logger.warn('Generated code contains potentially dangerous patterns', { pattern: pattern.source });
        return false;
      }
    }

    // Check for required Manim elements
    const requiredPatterns = [
      /from\s+manim\s+import/,
      /class\s+\w+.*Scene/,
      /def\s+construct/,
    ];

    for (const pattern of requiredPatterns) {
      if (!pattern.test(code)) {
        logger.warn('Generated code missing required Manim elements', { pattern: pattern.source });
        return false;
      }
    }

    return true;
  }
}
