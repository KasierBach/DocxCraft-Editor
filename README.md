# DocxCraft-Editor

![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

**DocxCraft-Editor** is an open-source, local-first `.docx` editor built on [`@eigenpal/docx-editor-react`](https://www.docx-editor.dev/), featuring a document library, smart anchor navigation, and a Neo-Brutalism UI — crafted for a seamless, Word-like editing experience right in the browser.

## Features

- Open `.docx` files directly in the browser
- Save, rename, delete, and duplicate documents via a local Fastify API
- **Anchor Map** — collapsible sidebar that lists all headings/paragraphs by page, syncs with the cursor position in real time
- **Smart Navigation** — clicking an anchor centers the editor on the target paragraph and flashes a highlight; collapsed pages auto-expand
- **Save-in-place** — saving never re-mounts the editor or loses cursor position
- **Optimistic concurrency** — saves carry an `If-Match` revision; the server rejects stale overwrites with `409`
- **Recovery Draft** — unsaved work is auto-backed-up (IndexedDB, with a localStorage fallback) and can be restored after a reload
- **Version History** — automatic snapshots on every save (up to 100 per document), restore or download any older version
- **Media Manager** — jump-to navigation for images and tables in the document
- **Editing Modes** — editing, suggesting, and viewing modes
- **Dark Mode** — manual toggle plus OS preference detection, persisted across sessions
- **Status Bar** — live word count, page count, and last-saved timestamp
- **Command Palette** — quick-access panel for documents, outline targets, and actions
- **Keyboard Shortcuts** — full list in the in-app help (`Ctrl+/`)
- **Deep Linking** — the URL tracks the open document and selected paragraph; reopening the link restores both
- Toast notifications for all document actions and errors
- Error Boundary for graceful crash recovery

## Project Structure

```
src/
  App.tsx                  — main shell, editor orchestration, anchor sync
  components/
    layout/
      Header.tsx           — toolbar, document name, action buttons
      Sidebar.tsx          — left panel with AnchorNavigator
      RightSidebar.tsx     — media manager, version history, saved documents
      EditorStatusBar.tsx  — word count, page, save status
      Breadcrumbs.tsx      — page breadcrumb indicator
    ui/
      CommandPalette.tsx   — quick-action palette
      ShortcutHelpModal.tsx
      Panel.tsx            — shared panel wrapper
  hooks/
    useAnchors.ts          — anchor state, filter, active paragraph tracking
    useDocumentLibrary.ts  — saved document list + revision management
    useDocumentCommands.ts — shared error/success handling for commands
    useRecoveryDraft.ts    — auto-backup and restore
    useKeyboardShortcuts.ts
    useApiStatus.ts        — backend health polling
    useTheme.ts            — dark mode + OS preference
    useToastManager.ts
  lib/
    anchors.ts             — collect anchor targets from page content
    resolveActiveAnchor.ts — resolve current active anchor from selection
    deepLink.ts            — URL-based document deep linking
    documentApi.ts         — HTTP client for backend routes
    docxValidation (server)— see server/ below
    flashHighlight.ts      — anchor jump flash-highlight with retry
    format.ts              — shared byte formatting
    mediaScanner.ts        — scan ProseMirror doc for images/tables
    recoveryStore.ts       — IndexedDB recovery snapshot storage
    shortcuts.ts           — single source of truth for shortcut list
  styles/
    base/                  — reset, tokens, dark mode
    layout/                — main layout, status bar, breadcrumbs
    components/            — header, sidebar, navigation, editor, toasts

server/
  app.ts                   — Fastify app, routes, Zod validation, CORS, rate limit
  docxValidation.ts        — pre-decompression ZIP central-directory validation
  documentStore.ts         — file-backed .docx storage + metadata index
  logger.ts                — pino logger setup

shared/
  types.ts                 — shared types between frontend and backend

scripts/
  dev.ts                   — dev launcher (starts API then Vite)

e2e/                       — Playwright browser + API tests
```

## Getting Started

### Requirements

- Node.js 22+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Default ports:
- Frontend: [http://localhost:5136](http://localhost:5136)
- API: [http://127.0.0.1:4175/api/health](http://127.0.0.1:4175/api/health)

The API binds to `127.0.0.1` by default. Configure `HOST`, `PORT`, `CORS_ORIGIN`, `DATA_DIR`, and `LOG_LEVEL` using the variables in `.env.example`. `/api/health` is the liveness check; `/api/ready` verifies that document storage is readable.

If port `4175` already has a compatible server running, the dev launcher reuses it.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start frontend + API together |
| `npm run dev:web` | Start Vite frontend only |
| `npm run dev:api` | Start Fastify API only |
| `npm run build` | Build production bundle |
| `npm run typecheck` | Run TypeScript checks without emitting files |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit test suite |
| `npm run test:coverage` | Run unit tests with coverage thresholds |
| `npm run test:e2e` | Run Playwright browser tests (Chromium, Firefox, WebKit, mobile) |
| `npm run preview` | Preview production build |

## API Overview

All routes are versioned via an `apiVersion` field on `/api/health`. Uploads are limited to 50 MiB and rate-limited to 300 requests/minute.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/ready` | Storage integrity check |
| `GET` | `/api/documents` | List saved documents |
| `POST` | `/api/documents` | Upload a new document (body: DOCX binary, `x-document-name` header) |
| `GET` | `/api/documents/:id` | (via content route below) |
| `PUT` | `/api/documents/:id` | Update a document; optional `If-Match: "<revision>"` for conflict detection |
| `PATCH` | `/api/documents/:id` | Rename a document (JSON body `{ "name": "..." }`) |
| `DELETE` | `/api/documents/:id` | Delete a document and its versions |
| `POST` | `/api/documents/:id/duplicate` | Duplicate a document |
| `GET` | `/api/documents/:id/content` | Download latest content (`?markOpened=true` touches `lastOpenedAt`) |
| `GET` | `/api/documents/:id/versions` | List version metadata |
| `GET` | `/api/documents/:id/versions/:versionId/content` | Download a specific version |

Document names travel URL-encoded in the `x-document-name` header; the `Content-Disposition` on downloads includes both an ASCII fallback and a UTF-8 encoded filename.

## Local Document Storage

Saved documents are stored in `data/documents/` (excluded from version control):

- `data/documents/<documentId>/<versionId>.docx` — one file per saved version
- `data/documents/index.json` — metadata index (atomic writes via temp file + rename)

Writes are serialized through an internal queue; version pruning (max 100 per document) commits the index before removing files so a crash mid-prune cannot leave dangling index entries. `/api/ready` verifies index/file consistency on demand.

## DOCX Upload Validation

Uploads are validated before decompression by parsing the ZIP central directory directly:

- ZIP signature and structure checks
- Entry count limit (10,000)
- Path traversal rejection (`..` segments)
- Required OOXML entries (`[Content_Types].xml`, `word/document.xml`)
- Uncompressed size limit (200 MiB) and per-entry/total compression-ratio limits (zip-bomb defense)
- ZIP64 archives are rejected
- CRC32 verification via JSZip after the header checks pass

## Keyboard Shortcuts

The shortcut list lives in `src/lib/shortcuts.ts` and is rendered by the in-app help (`Ctrl+/`).

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save as copy |
| `Ctrl+O` | Open file |
| `Ctrl+/` | Shortcut help |
| `Ctrl+\` | Toggle outline sidebar |
| `Ctrl+I` | Toggle details sidebar |
| `Ctrl+P` | Command palette |

## Testing

- **Unit** (`npm test`) — 138 tests across 27 files; jsdom environment, `@testing-library/react`, per-module store/api mocks
- **Coverage** (`npm run test:coverage`) — thresholds enforced (lines/statements/functions 60%, branches 45%)
- **E2E** (`npm run test:e2e`) — Playwright with Chromium, Firefox, WebKit, and mobile Chromium projects; includes API lifecycle, document workflow, theme persistence, and accessibility (axe) checks. Playwright starts both servers automatically.
- **CI** (`.github/workflows/ci.yml`) — lint, typecheck, coverage, e2e, and build on every push; release workflow packages `dist/` for `v*` tags

## Known Limits

- File storage is single-process and file-backed; use a database/object store before running multiple API instances
- No authentication, authorization, sharing, or collaboration — see [SECURITY.md](SECURITY.md) before exposing the API beyond localhost
- ZIP validation covers the central directory and CRC32; deeply malformed OOXML content is only rejected by the editor runtime, not the API
- Production bundle is large due to the editor runtime
