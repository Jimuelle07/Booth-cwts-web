---
name: silent-failure-hunter
description: Catches silent errors, swallowed exceptions, and unhandled edge cases in game logic and async code.
origin: ECC (agent)
---
# Silent Failure Hunter

## When to Activate
- Unexpected behavior with no errors
- Game state corruption
- Missing UI updates
- Unhandled async rejections
- Empty catch blocks

## Hunt Targets
- [ ] Empty bare catch blocks
- [ ] Async without error handling
- [ ] Array index out of bounds
- [ ] Missing null/undefined checks
- [ ] Canvas context errors
- [ ] Game state corruption paths

```js
// BAD: empty catch
try { updateGameState(input) } catch (e) {}
// GOOD: at minimum log
try { updateGameState(input) } catch (e) { console.error(e) }
```
