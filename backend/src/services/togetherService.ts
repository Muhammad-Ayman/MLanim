import fetch from 'node-fetch';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface TogetherResponse {
  code: string;
  explanation?: string;
}

export class TogetherService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(modelOverride?: string) {
    this.apiKey = config.together.apiKey;
    this.baseUrl = config.together.baseUrl;
    // Sensible default general LLM; user can override from UI
    this.defaultModel = modelOverride || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
  }

  async regenerateManimCode(
    originalPrompt: string,
    failedCode: string,
    error: string,
    regenerationCount: number = 1,
    model?: string
  ): Promise<TogetherResponse> {
    if (!this.apiKey) {
      throw new Error('Together API key is not configured');
    }

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

    const chosenModel = model || this.defaultModel;

    try {
      logger.info('Calling Together API for regeneration', {
        model: chosenModel,
        regenerationCount,
      });
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [
            { role: 'system', content: 'You generate only Python code for manim.' },
            { role: 'user', content: systemPrompt },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Together API error (regeneration)', { status: response.status, errorText });
        throw new Error(`Together API error: ${response.status} ${errorText}`);
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const code = this.extractCodeFromResponse(content);

      return { code, explanation: `Regenerated code using Together: ${chosenModel}` };
    } catch (err) {
      logger.error('Failed Together regeneration', { error: err });
      if (err instanceof Error) {
        throw new Error(`Together regeneration failed: ${err.message}`);
      }
      throw new Error('Together regeneration failed: Unknown error');
    }
  }

  async generateManimCode(prompt: string, model?: string): Promise<TogetherResponse> {
    if (!this.apiKey) {
      throw new Error('Together API key is not configured');
    }

    const systemPrompt = `You are an expert in mathematical animations and the Manim library.
Generate valid Python code using the manimcommunity/manim package.

Validation rules:
- Imports: use only "from manim import *" plus standard library modules when needed (e.g., import random, import math)
- Must define exactly one Scene subclass with a construct(self) method
- Only use functions and classes that actually exist in manimcommunity/manim
- If a standard library function is used, include the correct import
- Do NOT invent helpers, aliases, or outdated Manim APIs
- Use clear and meaningful variable names
- Add concise comments explaining steps
- Keep animations simple but visually engaging
- Ensure the script is complete, runnable, and will render without syntax or runtime errors
- Output ONLY the final Python code, no markdown or explanations

User prompt: ${prompt}`;

    const chosenModel = model || this.defaultModel;

    try {
      logger.info('Calling Together API for generation', { model: chosenModel });
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [
            { role: 'system', content: 'You generate only Python code for manim.' },
            { role: 'user', content: systemPrompt },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Together API error', { status: response.status, errorText });
        throw new Error(`Together API error: ${response.status} ${errorText}`);
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content || '';

      const code = this.extractCodeFromResponse(content);

      return { code, explanation: `Generated Manim code using Together: ${chosenModel}` };
    } catch (error) {
      logger.error('Failed Together generation', { error });
      if (error instanceof Error) {
        throw new Error(`Together generation failed: ${error.message}`);
      }
      throw new Error('Together generation failed: Unknown error');
    }
  }

  validateGeneratedCode(code: string): boolean {
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
        logger.warn('Together generated code contains potentially dangerous patterns', {
          pattern: pattern.source,
        });
        return false;
      }
    }

    const requiredPatterns = [/from\s+manim\s+import/, /class\s+\w+.*Scene/, /def\s+construct/];
    for (const pattern of requiredPatterns) {
      if (!pattern.test(code)) {
        logger.warn('Together generated code missing required Manim elements', {
          pattern: pattern.source,
        });
        return false;
      }
    }

    return true;
  }

  private extractCodeFromResponse(response: string): string {
    let code = response.replace(/```python\s*/g, '').replace(/```\s*$/g, '');
    code = code.trim();

    if (!code.includes('from manim import') && !code.includes('import manim')) {
      code = 'from manim import *\n\n' + code;
    }

    if (!code.includes('class') || !code.includes('Scene')) {
      code = code + '\n\nclass GeneratedScene(Scene):\n    def construct(self):\n        pass';
    }

    return code;
  }
}
