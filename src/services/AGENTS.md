# src/services/

**Parent:** Root AGENTS.md

## OVERVIEW
Domain service layer for graph-specific business logic that should stay out of route handlers.

## STRUCTURE
```
src/services/
└── graph.service.ts    # BFS level recalculation from central work
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Recalculate levels | `graph.service.ts` | `GraphService.recalculateLevels()` |
| Find service callers | `src/app/api/connections/route.ts` | Called after create connection |
| Manual recalc trigger | `src/app/api/connections/recalculate/route.ts` | Admin/system endpoint |

## CONVENTIONS
- Keep graph traversal/recalculation logic in services, not route files
- Service returns plain result objects; route decides HTTP status/shape
- Use approved-evidence filter for traversal (`status: 'APPROVED'`)

## ANTI-PATTERNS
- Reintroducing local `recalculateLevels` helpers in API routes
- Mixing transport concerns (`NextResponse`) into service code
