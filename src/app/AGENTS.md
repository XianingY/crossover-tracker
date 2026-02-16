# src/app/

**Parent:** Root AGENTS.md

## OVERVIEW
Next.js 16 App Router directory containing pages, admin views, and API routes.

## STRUCTURE
```
src/app/
├── page.tsx              # Home page
├── layout.tsx            # Root layout
├── works/                # Works CRUD pages
│   ├── page.tsx          # Works list
│   ├── new/              # Create work
│   └── [id]/             # Work detail + connections
├── admin/                # Admin panel
│   └── evidences/        # Evidence moderation
└── api/                  # REST API routes
    ├── works/            # Works endpoints
    ├── connections/      # Connections endpoints
    ├── evidences/        # Evidences endpoints
    └── graph/            # Graph data endpoint
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Works list | `works/page.tsx` | Main listing |
| Work detail | `works/[id]/page.tsx` | Single work view |
| Connections | `works/[id]/connections/page.tsx` | Graph view |
| API Graph | `api/graph/route.ts` | Graph data for force-graph |
| Evidence upload | `api/evidences/upload/route.ts` | File upload |

## CONVENTIONS
- Nested route groups mirror URL structure
- API routes return raw data on success and `{ error }` on failures
- Dynamic segments use `[id]` naming

## ANTI-PATTERNS
- **Duplicate nodes in graph API**: `api/graph/route.ts` pushes `toWork` nodes without de-dup check
- **Type evasion**: `any` used across API handlers and works pages
