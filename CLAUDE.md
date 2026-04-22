# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UPage is a visual web page building platform powered by LLMs. Users describe pages in natural language, and the platform generates multi-page websites with a visual editor. The project is primarily authored in Chinese.

## Tech Stack

- **Framework**: React Router v7 (framework mode, SSR enabled)
- **UI**: React 19, Radix UI primitives, Framer Motion, React DnD
- **Styling**: UnoCSS (atomic CSS) with CSS custom properties for theming
- **Server**: Custom Express server (`server.mjs`)
- **Database**: Prisma ORM with SQLite (`better-sqlite3` adapter)
- **State**: Nanostores (client), Prisma (server)
- **Auth**: Logto OIDC
- **AI**: Vercel AI SDK with multi-provider support

## Common Commands

Use `pnpm` as the package manager (pinned to 9.4.0).

```bash
# Development
pnpm dev                 # Start Vite dev server (port 5173) + Express

# Production
pnpm build               # React Router production build
pnpm start               # Start production Express server (port 3000)
pnpm preview             # Build + start production server

# Code Quality
pnpm check               # Biome check and auto-fix all files
pnpm check:stage         # Biome check and auto-fix staged files only
pnpm typecheck           # Generate React Router types + run tsc

# Testing
pnpm test                # Run Vitest once
pnpm test:watch          # Run Vitest in watch mode

# Database
pnpm setup               # Run Prisma migrate deploy + generate
npx prisma migrate dev   # Create a new migration during development
npx prisma generate      # Regenerate Prisma client

# Docker
pnpm docker:dev:run      # Docker Compose dev environment
pnpm docker:prod:run     # Docker Compose prod environment
```

## Architecture

### Directory Conventions

- **`app/.client/`** — Client-only code. Components, hooks, client-side stores, and utilities that may import browser APIs. Never import from here in server-only code.
- **`app/.server/`** — Server-only code. LLM orchestration (`llm/`), business services (`service/`), system prompts (`prompts/`), file storage (`storage/`), and server utilities. Never import from here in client-only code.
- **`app/routes/`** — React Router routes. Page routes render UI; `api/` subdirectories contain resource routes (loaders/actions).
- **`app/routes.ts`** — Centralized flat route configuration. Uses `prefix()` and `route()` helpers from `@react-router/dev/routes`.
- **`app/types/`** — Shared TypeScript type definitions.
- **`app/utils/`** — Isomorphic utilities safe to import from both client and server.
- **`prisma/`** — Schema and migrations for SQLite.
- **`icons/`** — Custom SVG icons consumed by UnoCSS `presetIcons` (collection name: `upage`).

### Route Structure

Routes are defined explicitly in `app/routes.ts` (not file-system based). The app has two page routes under a shared layout:

- `/` — Home (chat list)
- `/chat/:id` — Chat detail

API routes are grouped under `/api/*` with prefixes for domains: `chat`, `project`, `deployments`, `github`, `vercel`, `netlify`, `1panel`, `auth`, `upload`, `enhancer`.

### Server Architecture

`server.mjs` is the custom Express entry point:

- In development, creates a Vite dev server in middleware mode.
- In production, serves static assets from `build/client` and handles SSR via `@react-router/express`.
- Rate limiting: global (1000 req/min) and stricter for `/api/chat` (5 req/min).
- CORS is configured but allows all origins (`*`).
- Uploads are served from `STORAGE_DIR` (default `./public/uploads`) at `/uploads`.

### LLM Layer (`app/.server/llm/`)

The core AI logic lives here:

- **`chat-stream-text.ts`** — Main streaming text entry point. Builds system prompts, calls `streamText` from the AI SDK, and attaches tools.
- **`tools/`** — AI SDK tools exposed to the model (Serper search, weather).
- **`prompts/prompts.ts`** — System prompts for page generation.
- **`select-context.ts`** — Selects relevant context from chat history for the current request.
- **`structured-page-snapshot.ts`** — Parses and structures the LLM's page output.
- **`storage/`** — Abstraction over file storage for generated projects, with local and future provider support.

### Database Models (Prisma)

Key models in `prisma/schema.prisma`:

- **`Chat`** — A conversation session. Has `urlId` (unique slug), `description`, `metadata`.
- **`Message`** — Individual chat messages (user/assistant). Linked to `Chat`. Supports `isDiscarded` and `revisionId` for versioning.
- **`Deployment`** — Deployment records (Vercel, Netlify, 1Panel, GitHub).
- **`ChatUsage`** — Token usage tracking per message.

## Key Configuration

### TypeScript

- Path alias: `~/*` → `./app/*`
- `verbatimModuleSyntax: true` — Always use `import type` for type-only imports.
- `rootDirs` includes `.react-router/types` for generated route types.

### UnoCSS / Styling

- Config in `uno.config.ts`.
- Uses `presetUno` with custom dark mode selector `[data-theme="dark"]`.
- Custom icon collection `i-upage:*` loaded from `./icons/*.svg`.
- Theme colors are CSS custom properties (e.g., `var(--upage-elements-bg-depth-1)`), defined in `app/styles/index.scss`.
- Utility shortcuts: `transition-base`, `max-w-chat`, `kbd`.

### Biome

- Config in `biome.json`.
- Formatter: 2 spaces, single quotes, 120 line width, trailing commas.
- Linter: Enforces `noUnusedImports`, `useConst`, `noVar`, `noExplicitAny` (in some overrides).
- Organize imports is enabled.

### Vite

- Config in `vite.config.mts`.
- Custom plugins:
  - `chrome129IssuePlugin` — Blocks Chrome 129 due to a known Vite/Chrome bug.
  - `excludeUploadsPlugin` — Removes `build/client/uploads` from the production build.

## Environment Variables

Copy `.env.example` to `.env` for local development. Key variables:

- `OPERATING_ENV` — `development` | `production` | `test`. Controls feature flags separate from `NODE_ENV`.
- `LLM_PROVIDER`, `PROVIDER_BASE_URL`, `PROVIDER_API_KEY`, `LLM_DEFAULT_MODEL`, `LLM_MINOR_MODEL` — LLM configuration.
- `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_APP_SECRET`, `LOGTO_BASE_URL`, `LOGTO_COOKIE_SECRET`, `LOGTO_ENABLE` — Authentication.
- `STORAGE_DIR` — File upload storage path.
- `MAX_UPLOAD_SIZE_MB` — Upload size limit.

## Testing

- Vitest with `jsdom` environment.
- `vite-tsconfig-paths` resolves `~/*` aliases in tests.
- Globals are enabled (`describe`, `it`, `expect` available without import).
