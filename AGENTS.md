# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-16
**Commit:** 4a59b78
**Branch:** feature/crossover-tracker

## OVERVIEW
Crossover tracker webapp for managing cross-media work connections (novels, manga, anime, games). Built with Next.js 16 (App Router), React 19, Prisma ORM, and Supabase.

## STRUCTURE
```
./
├── src/
│   ├── app/           # Next.js App Router (pages + API)
│   │   ├── evidences/new/ # Evidence submission page
│   ├── components/    # React components
│   ├── lib/           # Shared clients (Prisma singleton)
│   └── services/      # Graph/domain services
├── prisma/           # Database schema
├── public/           # Static assets
└── [config files]    # next.config.ts, tsconfig.json, etc.
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Database models | `prisma/schema.prisma` | Work, Connection, Evidence |
| API routes | `src/app/api/` | CRUD + graph + recalculate |
| UI pages | `src/app/*.tsx` | Home, works, admin |
| Evidence submission | `src/app/evidences/new/page.tsx` | Submit link/file evidence by `connectionId` |
| Domain service | `src/services/graph.service.ts` | Level recalculation (BFS) |
| Graph visualization | `src/components/GraphView.tsx` | D3 + react-force-graph |

## CODE MAP
| Symbol | Type | Location | Role |
|--------|------|----------|------|
| Work | Model | prisma/schema.prisma | Core entity |
| Connection | Model | prisma/schema.prisma | Work relations |
| Evidence | Model | prisma/schema.prisma | Connection proof |
| GraphService | Service | src/services/graph.service.ts | Recalculate connection levels |

## CONVENTIONS
- **API Response**: Success returns raw JSON (array/object); failures return `{ error }` + HTTP status
- **DB Client**: Use singleton `src/lib/prisma.ts`
- **Routing**: Nested routes in `src/app/`
- **Back Navigation UI**: Use compact inline back link style (`inline-flex`, border, left arrow)

## ANTI-PATTERNS (THIS PROJECT)
- **Type evasion (`any`)**: Exists in `src/app/api/graph/route.ts` - bypasses type safety
- **Duplicate nodes in graph API**: `src/app/api/graph/route.ts` pushes `toWork` nodes without de-dup guard
- **Duplicate BFS logic**: Legacy `recalculateLevels` still duplicated in `api/connections/[id]/route.ts` and `api/evidences/[id]/route.ts`

## UNIQUE STYLES
- Chinese comments in Prisma schema
- Graph visualization as core feature (not typical CRUD)
- Evidence-based connection validation (must have APPROVED evidence)

## COMMANDS
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npx prisma studio # DB GUI
```

## NOTES
- Evidence submission UI now exists at `/evidences/new?connectionId=<id>`
- Cover rendering uses `<img>` with `referrerPolicy="no-referrer"` in new/detail/home views
- Combobox search input text color is explicitly set to avoid white-on-white display
- Missing `prisma generate` in build script - may fail in CI
- No testing framework configured
- No CI/CD pipeline (use Vercel)
