---
name: tdd-guide
description: Provides test-driven development guidance — tests before implementation code.
origin: ECC (agent)
---
# TDD Guide

## When to Activate
- Writing new features
- Fixing bugs
- Refactoring

## Contract
1. **RED** — Write failing test
2. **GREEN** — Write minimal code to pass
3. **REFACTOR** — Clean up, keep tests green

- Tests before implementation
- 80%+ coverage target
- Test edge cases and error paths
- Independent, isolated tests

## Project
Vitest + @testing-library/react + jsdom
`cd frontend && npm test`
