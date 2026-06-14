---
name: tdd-workflow
description: Test-driven development with 80%+ coverage including unit and integration tests.
origin: ECC
---
# Test-Driven Development

## Core: Tests BEFORE Code
Write tests first, then implement code to make them pass.

## TDD Cycle
1. **RED** — Write a failing test
2. **GREEN** — Write minimal code to pass
3. **REFACTOR** — Clean up while keeping tests green

## Testing Patterns (Vitest)
```js
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('Feature', () => {
  it('handles primary case', () => {
    expect(calculateScore({ hits: 5, misses: 2 })).toBe(3)
  })
  it('handles edge case', () => {
    expect(calculateScore({ hits: 0, misses: 0 })).toBe(0)
  })
  it('throws on invalid input', () => {
    expect(() => calculateScore({ hits: -1, misses: 0 })).toThrow()
  })
})
```

## Best Practices
- One assertion per test
- Descriptive test names
- Arrange-Act-Assert structure
- Mock external dependencies
- Test edge cases and error paths
- Independent tests (no shared state)

## Commands
```bash
cd frontend && npm test           # Run tests
cd frontend && npm run test -- --coverage  # Coverage report
```
