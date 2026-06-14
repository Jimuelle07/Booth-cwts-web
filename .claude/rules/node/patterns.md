# Node.js Patterns

## Express Route Structure (this project)
```js
import express from 'express'
const app = express()

// Routes grouped by resource
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use(express.json())

export default app
```

## Error Handling
```js
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})
```
