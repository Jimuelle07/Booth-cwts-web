---
name: react-build-resolver
description: React-specific build issues — JSX compilation, Vite config, dependency problems.
origin: ECC (agent)
---
# React Build Resolver

## When to Activate
- Vite build failures related to React
- JSX compilation errors
- React import issues

## Project Build Stack
```json
{
  "build": "Vite 8",
  "react": "19",
  "plugins": ["@vitejs/plugin-react", "@tailwindcss/vite"],
  "test": "Vitest + jsdom"
}
```

## Common Fixes
- Verify @vitejs/plugin-react in vite.config.js
- Use .jsx extension for JSX files
- React in dependencies (not devDependencies)
- `rm -rf node_modules && npm install` for stale cache
