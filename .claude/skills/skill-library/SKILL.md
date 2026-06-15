---
name: skill-library
description: Complete catalog of all ECC components for this project — DAILY (auto-loaded) vs LIBRARY (on-demand by name). Reference this skill to discover or activate any component.
origin: ECC
---
# Booth-cwts-web — ECC Library

This skill catalogs all ECC components classified for this project. Components are split into two tiers:

- **DAILY** — Installed in `.claude/skills/` and `.claude/rules/`, loaded every session. Always available.
- **LIBRARY** — Documented here only. Not auto-loaded. To use one, mention its name in your prompt.

## DAILY — 32 Installed Components

### Skills (8)
| Component | When to mention | Purpose |
|-----------|----------------|---------|
| `frontend-patterns` | React components, state, composition, hooks | React component & state patterns |
| `coding-standards` | Naming, readability, immutability, code review | Universal coding conventions |
| `documentation-lookup` | API docs, setup questions, library usage | Fetch live documentation via web |
| `security-review` | Auth, input handling, secrets, APIs | Security best practices checklist |
| `tdd-workflow` | Writing tests first, RED/GREEN/REFACTOR | Test-driven development workflow |
| `error-handling` | Error types, boundaries, retries, user messages | Robust error handling patterns |
| `frontend-a11y` | Form labels, ARIA, keyboard nav, focus mgmt | Accessibility patterns |
| `configure-ecc` | ECC install questions, component catalog | ECC configuration guide |

### Agents (10)
| Component | When to mention | Purpose |
|-----------|----------------|---------|
| `planner` | Complex multi-step features, refactoring | Implementation planning |
| `tdd-guide` | Test-first workflow guidance | TDD coaching |
| `code-reviewer` | Post-implementation review, before merge | Code quality & maintainability review |
| `security-reviewer` | Vulnerability check, auth, input validation | Security vulnerability detection |
| `build-error-resolver` | Build failures, test errors, dependency issues | Build/dependency error diagnosis |
| `docs-lookup` | Library API questions, framework usage | Documentation lookup |
| `react-reviewer` | React component review, hooks, rendering | React-specific code review |
| `react-build-resolver` | Vite/React build issues, JSX errors | React build error resolution |
| `performance-optimizer` | Game lag, slow renders, bundle size | Frontend & game performance |
| `silent-failure-hunter` | Mysterious bugs, empty catches, game state | Silent error & edge case detection |

### Commands (7)
| Component | When to mention | Purpose |
|-----------|----------------|---------|
| `plan` | Beginning multi-step work | Generate implementation plan |
| `tdd` | Starting a feature | Run TDD cycle (RED→GREEN→REFACTOR) |
| `code-review` | After implementation | Run structured code review |
| `build-fix` | Build/test/lint failures | Diagnose and fix build errors |
| `verify` | Before commit/deploy | Run full verification (test + lint + build) |
| `quality-gate` | Before merge | Enforce quality checks |
| `test-coverage` | After implementing | Verify 80%+ test coverage |

### Rules (4 sets, in `.claude/rules/`)
| Rule set | Files | Covers |
|----------|-------|--------|
| `common` | `coding-style.md` | Immutability, naming, error handling, code smells |
| `javascript` | `patterns.md` | Async/await, immutability, modules |
| `react` | `patterns.md` + `hooks.md` | Composition, state, hooks rules, forms, keys |
| `node` | `patterns.md` | Express structure, error handling |

### Hooks (5)
| Component | When to mention | Purpose |
|-----------|----------------|---------|
| `quality-gate-hook` | Pre-merge quality enforcement | Blocks merge if tests/lint/build fail |
| `pre-bash-commit-quality` | Before git commits | Runs test + lint + format pre-commit |
| `post-edit-format` | After editing code | Auto-formats with Prettier |
| `block-no-verify` | Commit without verification | Prevents unverified commits |
| `session-start` | Session initialization | Loads project context |

### Extra
| Component | When to mention | Purpose |
|-----------|----------------|---------|
| `security-guide` | Project-specific security risks | Platform-specific security (keyboard input, Canvas, etc.) |

---

## LIBRARY — On-Demand Components

These are not auto-loaded. Mention the component name to load it.

### Skills by Domain

**Backend & API** (for when backend grows beyond placeholder)
- `backend-patterns` — Node.js/Express/Next.js architecture, API design
- `api-design` — REST patterns, resource naming, pagination, error responses
- `deployment-patterns` — CI/CD, hosting, Docker, environment config
- `docker-patterns` — Dockerfile, compose, multi-stage builds, networking
- `database-migrations` — Schema migration patterns, rollbacks, seeding

**Testing & Quality** (for expanding test infrastructure)
- `e2e-testing` — Playwright E2E, Page Object Model, CI integration
- `verification-loop` — Verification and quality loop patterns
- `eval-harness` — Formal evaluation framework for eval-driven development
- `strategic-compact` — Context compaction at logical intervals

**Research & Search** (for research workflows)
- `deep-research` — Multi-source deep research with cited reports
- `exa-search` — Neural search for web, code, company research

**Content & Social** (content creation workflows)
- `article-writing` — Long-form writing in a supplied voice
- `content-engine` — Multi-platform social content and scripts
- `brand-voice` — Writing style from source examples
- `crosspost` — Multi-platform distribution (X, LinkedIn, Threads, Bluesky)
- `x-api` — X/Twitter API integration

**Media** (AI media generation)
- `fal-ai-media` — AI image/video/audio generation
- `video-editing` — AI-assisted video editing workflows

**Business** (fundraising)
- `investor-materials` — Pitch decks, one-pagers, financial models
- `investor-outreach` — Cold emails, warm intros, follow-ups
- `market-research` — Competitive analysis, market sizing

**Design** (UI polish)
- `frontend-slides` — HTML presentations from scratch or PPTX conversion
- `design-system` — Design tokens, component consistency

**Framework alternatives** (if stack changes)
- `nextjs-turbopack` — Next.js 16 with Turbopack
- `bun-runtime` — Bun as runtime/package manager/bundler
- `angular-developer` — Angular framework

**Agents & Orchestration** (advanced workflows)
- `dmux-workflows` — Multi-agent orchestration via tmux
- `autonomous-loops` — Autonomous loop execution
- `continuous-learning` / `continuous-learning-v2` — Instinct-based learning

**Off-stack language skills** (not in use — for reference)
- `django-patterns`, `django-tdd`, `django-security`, `django-verification`
- `fastapi-patterns`
- `golang-patterns`, `golang-testing`
- `python-patterns`, `python-testing`
- `dotnet-patterns`, `csharp-testing`, `fsharp-testing`
- `dart-flutter-patterns`, `flutter-dart-code-review`
- `compose-multiplatform-patterns`, `android-clean-architecture`
- `cpp-coding-standards`, `cpp-testing`

### LIBRARY Agents

| Agent | When to use |
|-------|-------------|
| `architect` | System design and architectural decisions |
| `e2e-runner` | Running Playwright E2E test suites |
| `refactor-cleaner` | Identifying and removing dead code |
| `doc-updater` | Maintaining documentation and codemaps |
| `loop-operator` | Managing autonomous loop execution |
| `harness-optimizer` | Tuning harness configuration for reliability |
| Language-specific reviewers | When reviewing code in that language (python, rust, go, java, etc.) |

### LIBRARY Rules (Language Sets)

| Rule set | Languages |
|----------|-----------|
| `typescript/` | TypeScript patterns, hooks, testing |
| `python/` | Python patterns, pytest, black/ruff |
| `golang/` | Go patterns, table-driven tests, gofmt |
| `rust/` | Rust patterns, cargo, clippy |
| `cpp/` | C++ patterns |
| `java/` | Java/Spring patterns |
| `kotlin/` | Kotlin patterns |
| `php/` | PHP patterns |
| `angular/` | Angular patterns |
| `dart/` | Dart/Flutter patterns |
| `csharp/` | C# patterns |
| `perl/` | Perl patterns |
| `arkts/` | ArkTS (HarmonyOS) patterns |

### LIBRARY Commands

| Command | Category | Purpose |
|---------|----------|---------|
| `/e2e` | Testing | Run end-to-end tests |
| `/docs` | Docs | Look up documentation |
| `/update-docs` | Docs | Update documentation files |
| `/refactor-clean` | Refactoring | Clean up dead/redundant code |
| `/save-session` | Session | Save current session state |
| `/resume-session` | Session | Resume a saved session |
| `/checkpoint` | Session | Create a checkpoint |
| `/learn` | Learning | Extract patterns from session |
| `/evolve` | Learning | Evolve instincts |
| `/loop-start` | Automation | Start autonomous loop |
| `/loop-status` | Automation | Check loop status |
| `/orchestrate` | Multi-agent | Orchestrate multi-agent workflow |
| `/devfleet` | Multi-agent | Deploy agent fleet |
| `/harness-audit` | Infra | Audit harness configuration |
| Language-specific commands | Testing/Build | e.g. `/go-test`, `/rust-build`, `/cpp-review` |

---

## How to Use

To activate any LIBRARY component, just mention its name in your prompt:

> "I need to set up E2E testing with Playwright" → triggers `e2e-testing` skill
> "Run the architect to review my component structure" → triggers `architect` agent
> "Check for dead code with the refactor-cleaner" → triggers `refactor-cleaner` agent

All DAILY components are already active and don't need explicit invocation.

---

*Classification via **agent-sort** workflow on 2026-06-14.*
*Source: [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)*
