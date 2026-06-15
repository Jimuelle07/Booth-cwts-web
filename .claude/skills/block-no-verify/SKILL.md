---
name: block-no-verify
description: Blocks unverified changes from being committed without passing verification.
origin: ECC (hook)
---
# Block No Verify Hook

Prevents unverified changes from being committed.

## Requirement
All commits must pass verification:
1. Tests green (`npm test`)
2. Lint clean (`npm run lint`)
3. Build succeeds (`npm run build`)

Run `/verify` before each commit.
