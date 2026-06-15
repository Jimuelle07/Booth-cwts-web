---
name: session-start
description: Session initialization — loads project context and active skills.
origin: ECC (hook)
---
# Session Start Hook

Initializes agent sessions with project context.

## Loads
- Project stack: JavaScript, React 19, Vite 8, Tailwind v4, Zustand, Vitest
- DAILY skills from `.claude/skills/`
- DAILY rules from `.claude/rules/`
- Game engines: Canvas (parkour, pong)
- Backend: Node.js/Express (placeholder)

## Commands
```bash
cd frontend && npm run dev  # Dev server
cd frontend && npm test     # Run tests
```
