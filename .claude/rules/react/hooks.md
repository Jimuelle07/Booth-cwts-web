# React Hooks

## Rules of Hooks
1. Only at top level of function component or another hook
2. Never in loops, conditionals, or nested functions
3. Always called in same order on every render
4. Only inside React function components or custom hooks

## useEffect — When NOT to Use
Not for:
- Derived state — compute during render
- Transforming data for rendering — compute during render
- Resetting state when prop changes — use `key` or derive from props

Use for:
- Synchronizing with external systems (subscriptions, browser APIs)
- Analytics events
- Document title updates

```jsx
// WRONG: effect for derived state
const [fullName, setFullName] = useState('')
useEffect(() => { setFullName(`${first} ${last}`) }, [first, last])

// CORRECT: derive during render
const fullName = `${first} ${last}`
```

## Dependency Arrays
- Include every reactive value referenced inside the effect
- Enable exhaustive-deps lint rule
- Split effects that are doing too much

## Cleanup
Every subscription, interval, listener, or in-flight request must clean up.
```jsx
useEffect(() => {
  const controller = new AbortController()
  fetch(url, { signal: controller.signal })
  return () => controller.abort()
}, [url])
```

## useMemo / useCallback — When Worth It
Default: **do not memoize**. Add only when:
1. Passed to React.memo child as prop where identity matters
2. Is a dependency of another hook
3. Computation is measurably expensive

## Custom Hooks
Extract when same hook sequence appears in 2+ components.
Do NOT extract for single-caller or just useState with different name.

## Zustand (this project)
```js
import { create } from 'zustand'
const useStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}))
```
