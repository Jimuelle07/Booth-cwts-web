---
name: security-review
description: Security best practices for auth, input validation, secrets management, and API endpoints.
origin: ECC
---
# Security Review

## Secrets Management
```js
const apiKey = process.env.API_KEY    // GOOD
if (!apiKey) throw new Error('API_KEY not configured')
const apiKey = "sk-proj-xxxxx"        // BAD
```

## Input Validation
```js
function validateFileUpload(file) {
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) throw new Error('File too large')
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!allowedTypes.includes(file.type)) throw new Error('Invalid file type')
  return true
}
```

## Error Handling
```js
catch (error) {
  console.error('Internal error:', error)
  return { error: 'An error occurred.' }   // GOOD: generic message
}
catch (error) {
  return { error: error.message, stack: error.stack }  // BAD: leaks internals
}
```

## Pre-Deployment Checklist
- [ ] No hardcoded secrets — all in env vars
- [ ] All user inputs validated
- [ ] No sensitive data in logs or errors
- [ ] Dependencies up to date (`npm audit`)
- [ ] Lock file committed
