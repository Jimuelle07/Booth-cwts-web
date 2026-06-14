# Coding Style — Common

## Immutability (CRITICAL)
ALWAYS create new objects, NEVER mutate existing ones.
```js
WRONG: modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy
```

## Core Principles
- **KISS** — Simplest solution that works
- **DRY** — Extract repeated logic into shared functions
- **YAGNI** — Don't build features before they're needed

## File Organization
MANY SMALL FILES > FEW LARGE FILES. 200-400 lines typical, 800 max.

## Error Handling
ALWAYS handle errors explicitly. Never silently swallow errors.

## Input Validation
Validate at system boundaries. Never trust external data.

## Naming
- Variables/functions: `camelCase`
- Booleans: `is`, `has`, `should` prefixes
- Components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Hooks: `camelCase` with `use` prefix

## Code Smells
- Deep nesting → early returns
- Magic numbers → named constants
- Long functions → split
- Mutation → immutable patterns

## Checklist
- [ ] Readable and well-named
- [ ] Functions < 50 lines
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values
- [ ] No mutation
