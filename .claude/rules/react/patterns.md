# React Patterns

## Composition Over Inheritance
Pass `children` for slot-style composition. Never extend a component class.

## State Location Decision Tree
1. Used by one component → `useState` inside it
2. Used by parent + few children → lift to nearest common ancestor
3. Used across distant branches → React Context (low-frequency reads only)
4. High-frequency shared updates → external store (Zustand, this project)

## Suspense + Error Boundaries
Every Suspense boundary needs an Error Boundary above it.
```jsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<Skeleton />}>
    <UserDetails id={id} />
  </Suspense>
</ErrorBoundary>
```

## Forms
Prefer uncontrolled inputs with form actions. Use controlled inputs when value drives other UI.

## Lists and Keys
- `key` must be stable across renders — never `index` for reorderable lists
- `key` must be unique among siblings, not globally

## Accessibility
- Every `<input>` needs a connected `<label>` via `htmlFor`/`id`
- Error messages linked with `aria-describedby`
- Icon buttons have `aria-label`
- Decorative images hide with `alt="" aria-hidden="true"`
