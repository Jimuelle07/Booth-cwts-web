---
name: frontend-a11y
description: Accessibility patterns — semantic HTML, ARIA, form labels, keyboard nav, focus management.
origin: ECC
---
# Frontend Accessibility

## Form Labels
```jsx
<label htmlFor="email">Email</label>     // GOOD: connected
<input id="email" type="email" />
<label>Email</label>                     // BAD: no connection
<input type="email" />
```

## Error Messages
```jsx
<input id="email" aria-describedby="email-error" aria-invalid={!!error} />
{error && <span id="email-error" role="alert">{error}</span>}
```

## Semantic HTML
```jsx
<button type="button" onClick={handleClick}>Submit</button>  // GOOD
<div onClick={handleClick}>Submit</div>                      // BAD
<a href="/home">Home</a>                                     // GOOD
<div onClick={() => navigate('/home')}>Home</div>             // BAD
```

## ARIA Attributes
```jsx
<button aria-label="Close modal"><XIcon /></button>
<div role="status" aria-live="polite" aria-atomic="true">{message}</div>
```

## Focus Management
```jsx
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef(null)
  const previousRef = useRef(null)
  useEffect(() => {
    if (isOpen) { previousRef.current = document.activeElement; modalRef.current?.focus() }
    else { previousRef.current?.focus() }
  }, [isOpen])
  if (!isOpen) return null
  return <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}>{children}</div>
}
```

## Anti-Patterns
- `<div onClick={...}>` without role, tabIndex, onKeyDown
- Placeholder as substitute for label
- Positive tabIndex values
- aria-hidden on focusable elements

## Checklist
- [ ] Every input has connected label via htmlFor/id
- [ ] Errors linked with aria-describedby + role="alert"
- [ ] Icon buttons have aria-label
- [ ] Decorative images use alt="" aria-hidden="true"
- [ ] Modals restore focus on close
