# Docx Editor

![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-private-red?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

A local-first `.docx` editor built on [`@eigenpal/docx-editor-react`](https://www.docx-editor.dev/) with a document library, anchor navigation, and a Neo-Brutalism UI.

## Features

- Open `.docx` files directly in the browser
- Save, rename, and delete documents via a local Fastify API
- **Anchor Map** — collapsible sidebar that lists all headings/paragraphs by page, syncs with the cursor position in real time
- **Smart Navigation** — clicking an anchor centers the editor on the target paragraph; collapsed pages auto-expand
- **Save-in-place** — saving never re-mounts the editor or loses cursor position
- **Recovery Draft** — unsaved work is auto-backed-up and can be restored after a reload
- **Version History** — save named snapshots and restore older versions
- **Status Bar** — live word count, page count, and last-saved timestamp
- **Command Palette** — quick-access panel for common actions (`Ctrl+Shift+P`)
- **Keyboard Shortcuts** — `Ctrl+S` save, `Ctrl+O` open, `Ctrl+P` insert hyperlink, and more
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
      EditorStatusBar.tsx  — word count, page, save status
      Breadcrumbs.tsx      — page breadcrumb indicator
    ui/
      CommandPalette.tsx   — quick-action palette
      ShortcutHelpModal.tsx
  hooks/
    useAnchors.ts          — anchor state, filter, active paragraph tracking
    useDocumentLibrary.ts  — saved document list management
    useRecoveryDraft.ts    — auto-backup and restore
    useKeyboardShortcuts.ts
    useToastManager.ts
  lib/
    anchors.ts             — collect anchor targets from page content
    resolveActiveAnchor.ts — resolve current active anchor from selection
    deepLink.ts            — URL-based document deep linking
    documentApi.ts         — HTTP client for backend routes
  styles/
    base/                  — reset, tokens
    layout/                — main layout, status bar, breadcrumbs
    components/            — header, sidebar, navigation, editor, toasts

server/
  app.ts                   — Fastify app, routes, validation
  documentService.ts       — business layer between HTTP and storage
  documentStore.ts         — file-backed .docx storage + metadata index

shared/
  types.ts                 — shared types between frontend and backend

scripts/
  dev.ts                   — dev launcher (starts API then Vite)
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

If port `4175` already has a compatible server running, the dev launcher reuses it.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start frontend + API together |
| `npm run dev:web` | Start Vite frontend only |
| `npm run dev:api` | Start Fastify API only |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm test` | Run test suite |

## Local Document Storage

Saved documents are stored in `data/documents/` (excluded from version control):

- `data/documents/*.docx` — document content
- `data/documents/index.json` — metadata index

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save |
| `Ctrl+O` | Open file |
| `Ctrl+Shift+P` | Command Palette |
| `Ctrl+P` | Insert Hyperlink |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Known Limits

- File storage is not transactional (no atomic writes)
- No auth, sharing, or collaboration
- Production bundle is large due to the editor runtime
