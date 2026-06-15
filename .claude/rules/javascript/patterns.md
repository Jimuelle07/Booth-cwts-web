# JavaScript Patterns

## Async/Await
```js
// GOOD: parallel execution
const [users, markets] = await Promise.all([fetchUsers(), fetchMarkets()])

// BAD: sequential when unnecessary
const users = await fetchUsers()
const markets = await fetchMarkets()
```

## Error Handling
```js
try {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return await response.json()
} catch (error) {
  console.error('Failed:', error)
  throw new Error('Failed to fetch data')
}
```

## Immutability
```js
// GOOD
const updated = { ...original, field: newValue }
const added = [...array, newItem]
const filtered = array.filter(x => x.id !== targetId)

// BAD
original.field = newValue
array.push(newItem)
```

## Module Pattern
```js
// Named exports for utilities
export function formatDate(date) { ... }
export function isValidEmail(email) { ... }

// Default export for main component/class
export default function MyComponent() { ... }
```
