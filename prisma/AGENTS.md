# prisma/

**Parent:** Root AGENTS.md

## OVERVIEW
Prisma ORM schema and database configuration.

## STRUCTURE
```
prisma/
└── schema.prisma    # Database schema (only file)
```

## MODELS
| Model | Purpose |
|-------|---------|
| Work | Core entity - title, type (NOVEL/MANGA/ANIME/GAME/etc), isCentral |
| Connection | Links between works - fromWork → toWork with relationType |
| Evidence | Proof of connection - url/file, status (PENDING/APPROVED/REJECTED) |

## KEY CONSTRAINTS
- **Connection requires APPROVED evidence**: `// 证据（必须至少有一个通过才能显示联动）`
- Connection unique: `[fromWorkId, toWorkId, relationType]`
- Level auto-calculated via BFS (duplicated logic issue)

## ANTI-PATTERNS
- Chinese comments only - no English documentation
- Level field auto-calculated but logic duplicated in API
