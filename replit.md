# Workspace

## Overview

Meal Planning Board — a full-stack web application for planning Breakfast, Lunch, and Dinner for each day. Built with React + Vite frontend and Express 5 backend in a pnpm workspace monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Drag & Drop**: @dnd-kit/core + @dnd-kit/sortable
- **Date utilities**: date-fns
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── meal-planner/       # React + Vite meal planning frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Features

- **Kanban-style board** with one column per day (7 days visible at a time)
- **Meal slots**: Breakfast, Lunch, and Dinner per day
- **Drag and drop** meals between slots and days
- **Unscheduled Meals** pool at the bottom for meal ideas saved for later
- **Add/Edit/Delete** meals via dialog forms
- **Light/Dark mode** toggle persisted to localStorage
- **Week navigation** with forward/backward arrows and "Today" button
- **Today highlighting** — current date column is visually emphasized
- **Database persistence** — all meals saved to PostgreSQL

## Database Schema

### `meals` table
- `id` (serial, PK)
- `name` (text, not null)
- `description` (text, nullable)
- `scheduled_date` (date, nullable — null means unscheduled)
- `meal_type` (text, nullable — 'breakfast', 'lunch', or 'dinner')
- `position` (integer, sort order within slot)
- `created_at` (timestamp, default now)

## API Endpoints

All routes prefixed with `/api`:
- `GET /api/meals` — list all meals
- `POST /api/meals` — create a meal
- `PUT /api/meals/:id` — update a meal
- `DELETE /api/meals/:id` — delete a meal
- `PATCH /api/meals/:id/move` — move a meal to a different day/slot

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files during typecheck
- **Project references** — when package A depends on B, A's `tsconfig.json` must list B in `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/meal-planner` (`@workspace/meal-planner`)

React + Vite meal planning board. Main page is `src/pages/Board.tsx`. Components in `src/components/`. Uses @dnd-kit for drag-and-drop, date-fns for date operations.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`:
- `health.ts` — GET /api/healthz
- `meals.ts` — CRUD + move endpoints for meals

### `lib/db` (`@workspace/db`)

Database layer. Schema in `src/schema/meals.ts`.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.
