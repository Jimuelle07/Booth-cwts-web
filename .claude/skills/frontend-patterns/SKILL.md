---
name: frontend-patterns
description: Frontend development patterns for React, state management, performance optimization, and UI best practices.
origin: ECC
---
# Frontend Development Patterns

Modern frontend patterns for React and performant user interfaces.

## When to Activate

- Building React components (composition, props, rendering)
- Managing state (useState, useReducer, Zustand, Context)
- Implementing data fetching
- Optimizing performance (memoization, virtualization, code splitting)
- Handling client-side routing and navigation
- Building accessible, responsive UI patterns

## Component Patterns

### Composition Over Inheritance

```jsx
function Card({ children, variant = 'default' }) {
  return <div className={`card card-${variant}`}>{children}</div>
}
function CardHeader({ children }) { return <div className="card-header">{children}</div> }
function CardBody({ children }) { return <div className="card-body">{children}</div> }
```

### Compound Components

```jsx
const TabsContext = createContext(undefined)
function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return <TabsContext.Provider value={{ activeTab, setActiveTab }}>{children}</TabsContext.Provider>
}
function Tab({ id, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext)
  return <button className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{children}</button>
}
```

## Custom Hooks Patterns

```jsx
function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  return [value, toggle]
}

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}
```

## Zustand (active in this project)

```jsx
import { create } from 'zustand'
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))
```

## Performance Optimization

```jsx
const sortedItems = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items])
const handleSearch = useCallback((query) => setSearchQuery(query), [])
const ItemCard = React.memo(function ItemCard({ item }) {
  return <div className="item-card"><h3>{item.name}</h3></div>
})
```

## Error Boundary

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, errorInfo) { console.error('Error:', error, errorInfo) }
  render() {
    if (this.state.hasError) return this.props.fallback || <p>Something went wrong.</p>
    return this.props.children
  }
}
```
