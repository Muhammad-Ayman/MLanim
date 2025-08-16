const { GeminiService } = require('../dist/services/geminiService');

async function testCodeRegeneration() {
  try {
    console.log('Testing code regeneration functionality...\n');

    const geminiService = new GeminiService();

    // Test case 1: Original prompt
    const originalPrompt = 'Create a simple circle animation';

    // Test case 2: Failed code (with intentional error)
    const failedCode = `from manim import *

class TestScene(Scene):
    def construct(self):
        # This code has an error - Circle() should be Circle()
        circle = Circle()  # Missing parentheses
        self.play(Create(circle))
        self.wait(2)`;

    // Test case 3: Error message
    const error = "NameError: name 'Circle' is not defined. Did you mean 'Circle'?";

    console.log('Original Prompt:', originalPrompt);
    console.log('Failed Code:', failedCode);
    console.log('Error:', error);
    console.log('\n--- Regenerating Code ---\n');

    // Test the regeneration
    const regeneratedCode = await geminiService.regenerateManimCode(
      originalPrompt,
      failedCode,
      error,
      1
    );

    console.log('Regenerated Code:');
    console.log(regeneratedCode.code);
    console.log('\nExplanation:', regeneratedCode.explanation);

    // Validate the regenerated code
    const isValid = geminiService.validateGeneratedCode(regeneratedCode.code);
    console.log('\nValidation Result:', isValid ? 'PASS' : 'FAIL');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
testCodeRegeneration();
