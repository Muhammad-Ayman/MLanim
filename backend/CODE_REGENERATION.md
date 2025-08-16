# Code Regeneration Feature

## Overview

The code regeneration feature automatically handles failed Manim rendering jobs by analyzing the error, capturing the failed code, and sending it back to Gemini AI to generate corrected code. This creates a self-healing system that can recover from common coding errors without manual intervention.

## How It Works

### 1. Automatic Error Detection

When a Manim rendering job fails, the system:

- Captures the error message and stack trace
- Stores the failed code
- Records the original prompt
- Automatically triggers the regeneration process

### 2. Error Context Analysis

The system sends to Gemini AI:

- The original user prompt
- The failed code that caused the error
- The specific error message
- Context about what went wrong

### 3. Intelligent Code Regeneration

Gemini AI analyzes the error and:

- Identifies the specific issue in the failed code
- Generates corrected code that addresses the error
- Maintains the same animation concept
- Fixes implementation issues

### 4. Automatic Retry

The system:

- Creates a new job with the corrected code
- Tracks regeneration attempts
- Limits regeneration to prevent infinite loops
- Provides detailed logging of the process

## API Endpoints

### Manual Code Regeneration

```http
POST /api/animation/regenerate/:id
```

Regenerates code for a specific failed job.

**Rate Limit:** 5 requests per 5 minutes per IP

### Bulk Code Regeneration

```http
POST /api/animation/regenerate-all-failed
```

Regenerates code for all failed jobs in the system.

**Rate Limit:** 3 requests per 10 minutes per IP

## Configuration

### Maximum Regeneration Attempts

Default: 3 attempts per job

- Prevents infinite regeneration loops
- Can be configured in the `regenerateCodeAndRetry` method

### Automatic vs Manual

- **Automatic:** Triggers immediately when a job fails
- **Manual:** User-initiated via API endpoints
- Both use the same underlying regeneration logic

## Error Handling

### Supported Error Types

- Syntax errors in Manim code
- Runtime errors during rendering
- Import errors
- Missing dependencies
- Invalid Manim syntax

### Error Context Preservation

- Original prompt maintained
- Failed code captured exactly
- Error message preserved
- Regeneration count tracked

## Logging and Monitoring

### Detailed Logs

- Regeneration attempts logged
- Error context captured
- Success/failure tracking
- Performance metrics

### Monitoring

- Track regeneration success rates
- Monitor error patterns
- Identify common failure modes
- Performance optimization opportunities

## Example Workflow

1. **User submits prompt:** "Create a bouncing ball animation"
2. **Gemini generates code:** Creates initial Manim code
3. **Rendering fails:** Code has syntax error
4. **System captures error:** Stores failed code and error message
5. **Automatic regeneration:** Sends error context to Gemini
6. **Gemini fixes code:** Generates corrected version
7. **New job created:** Corrected code queued for rendering
8. **Success:** Animation renders successfully

## Benefits

### For Users

- Automatic error recovery
- No manual intervention needed
- Faster animation generation
- Better success rates

### For System

- Reduced manual support
- Self-healing capabilities
- Better resource utilization
- Improved user experience

### For Development

- Error pattern identification
- Code quality improvement
- Automated testing scenarios
- Performance optimization

## Testing

### Test Script

Run the test script to verify functionality:

```bash
cd backend
npm run build
node scripts/test-code-regeneration.js
```

### Manual Testing

1. Create a job with intentionally broken code
2. Let it fail
3. Check logs for regeneration attempts
4. Verify new job is created with corrected code

## Future Enhancements

### Planned Features

- Machine learning error pattern recognition
- Custom error handling rules
- Performance optimization based on error types
- Integration with external code analysis tools

### Potential Improvements

- Error categorization and prioritization
- Adaptive regeneration strategies
- User feedback integration
- Advanced error context analysis

## Troubleshooting

### Common Issues

- **Regeneration not triggering:** Check job state and error handling
- **Infinite loops:** Verify maximum regeneration limits
- **API errors:** Check Gemini service configuration
- **Performance issues:** Monitor regeneration frequency

### Debug Information

- Use `/api/animation/debug/:id` endpoint
- Check detailed job logs
- Monitor regeneration attempts
- Review error context data

## Security Considerations

### Code Validation

- All regenerated code validated for safety
- Dangerous operations blocked
- Import restrictions enforced
- Runtime safety checks

### Rate Limiting

- API endpoints rate limited
- Automatic regeneration throttled
- Abuse prevention measures
- Resource usage monitoring
