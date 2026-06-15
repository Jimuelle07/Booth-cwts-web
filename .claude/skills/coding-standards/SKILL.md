---
name: coding-standards
description: Baseline cross-project coding conventions for naming, readability, immutability, and code-quality review.
origin: ECC
---
# Coding Standards

## Naming
```js
// GOOD
const marketSearchQuery = 'election'
const isUserAuthenticated = true
async function fetchMarketData(marketId) { }
function isValidEmail(email) { }
// BAD
const q = 'election'
const flag = true
function market(id) { }
```

## Immutability (CRITICAL)
```js
const updatedUser = { ...user, name: 'New Name' }  // GOOD
const updatedArray = [...items, newItem]             // GOOD
user.name = 'New Name'                               // BAD
items.push(newItem)                                  // BAD
```

## Error Handling
```js
async function fetchData(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}
```

## Code Smells to Avoid
- Deep nesting (>4 levels) → use early returns
- Magic numbers → use named constants
- Long functions (>50 lines) → split into focused pieces
- Mutation → use immutable patterns

## Checklist
- [ ] Code readable and well-named
- [ ] Functions small and focused
- [ ] No deep nesting
- [ ] Proper error handling
- [ ] No hardcoded values
- [ ] No mutation
