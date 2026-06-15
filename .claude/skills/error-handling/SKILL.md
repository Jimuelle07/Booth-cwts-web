---
name: error-handling
description: Patterns for robust error handling — typed errors, error boundaries, retries, and user-facing messages.
origin: ECC
---
# Error Handling Patterns

## Core Principles
1. Fail fast and loudly
2. User messages ≠ developer messages
3. Never swallow errors silently
4. Errors are part of your API contract

## Typed Error Classes
```js
class AppError extends Error {
  constructor(message, code, statusCode = 500, details) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}
class NotFoundError extends AppError {
  constructor(resource, id) { super(`${resource} not found: ${id}`, 'NOT_FOUND', 404) }
}
class ValidationError extends AppError {
  constructor(message, details) { super(message, 'VALIDATION_ERROR', 422, details) }
}
```

## Error Boundary
```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('Error:', error, info) }
  render() {
    if (this.state.hasError) return this.props.fallback || <p>Something went wrong.</p>
    return this.props.children
  }
}
```

## Retry with Backoff
```js
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500 } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (error) {
      lastError = error
      if (attempt === maxAttempts) throw error
      await new Promise(r => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)))
    }
  }
  throw lastError
}
```

## Checklist
- [ ] Every catch handles, re-throws, or logs
- [ ] No stack traces in user-facing messages
- [ ] Full context logged server-side
- [ ] Components wrapped in ErrorBoundary
