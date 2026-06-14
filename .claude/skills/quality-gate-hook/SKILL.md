---
name: quality-gate-hook
description: Quality gate enforcement — blocks if tests, lint, or build fail.
origin: ECC (hook)
---
# Quality Gate Hook

Enforces quality before commit/merge.

## Checks
1. All tests pass (`npm test`)
2. Lint clean (`npm run lint`)
3. Build succeeds (`npm run build`)

Invoke before commit to ensure code quality standards are met.
