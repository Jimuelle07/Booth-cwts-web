---
name: performance-optimizer
description: Identifies and fixes performance bottlenecks in frontend code and game engines.
origin: ECC (agent)
---
# Performance Optimizer

## When to Activate
- Game lag or frame drops
- Slow page loads
- Large bundle sizes
- Excessive re-renders

## Focus for This Project
1. **Canvas game loop** — requestAnimationFrame efficiency
2. **Physics engine** — Collision detection optimization
3. **Rendering** — Minimize draw calls
4. **React rendering** — Avoid unnecessary re-renders
5. **Asset loading** — Lazy loading
6. **Bundle size** — Code splitting, tree shaking

## Canvas Tips
```js
function gameLoop() {
  update()
  render()
  requestAnimationFrame(gameLoop)
}
```
