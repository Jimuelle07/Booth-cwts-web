---
name: security-guide
description: Security considerations for this game platform — keyboard input, game state, user data.
origin: ECC (extra)
---
# Security Guide

## Project-Specific Risks

### Keyboard Input
This platform reads keyboard events globally. Key concerns:
- No direct keyboard event listeners in game components — use `pressedKeys` prop
- Input validation at the platform boundary
- No eval or dynamic code execution from input

### Canvas Games
- No user-generated content rendered via Canvas text
- Game state is client-side only (no server sync yet)

### Backend (future use)
- When backend becomes active, apply standard security patterns:
  - Input validation with Zod/schemas
  - Parameterized queries
  - Rate limiting
  - CORS configuration

## General Rules
- No hardcoded API keys in source
- All secrets in environment variables
- `.env` files in .gitignore
- Generic error messages to users
- Log detailed errors server-side only
