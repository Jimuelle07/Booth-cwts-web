---
name: build-error-resolver
description: Diagnoses and fixes build, bundling, and dependency errors.
origin: ECC (agent)
---
# Build Error Resolver

## When to Activate
- Build failures (Vite, npm)
- Test runner errors
- Module not found
- Dependency conflicts

## Project Commands
```bash
cd frontend
npm run dev      # Dev server
npm run build    # Production build
npm test         # Tests
npm run lint     # ESLint
npm run format   # Prettier
```

## Common Issues
- Missing deps in frontend/package.json
- Import path mismatches
- ESLint config errors
- Vite plugin compatibility
