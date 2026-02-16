# Crossover Tracker

面向公网的联动图谱管理系统（Next.js + Prisma + Supabase + Vercel）。

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Prisma ORM
- Supabase (Postgres + Storage + Auth)
- Upstash Redis（全局限流/缓存）
- Sentry（前后端异常监控）

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Supabase)
# DATABASE_URL: 建议使用 pooler（事务模式）
DATABASE_URL=
# DIRECT_URL: 直连 URL，仅用于 migrate deploy
DIRECT_URL=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# AI
TAVILY_API_KEY=

# Observability
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Admin Auth + Role

系统使用 Supabase Auth 登录，管理员由 JWT `app_metadata.role=admin` 判定。

示例（在 Supabase SQL Editor 执行，为指定用户打 admin claim）：

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'your-admin@example.com';
```

管理入口：`/admin/login`

## RLS Policy

RLS 策略文件：`supabase/rls.sql`

在 Supabase SQL Editor 执行后可启用：

- 业务表仅 admin claim 可写
- 私有证据桶 `evidences-private` 仅 admin claim 可访问对象

## Local Development

```bash
npm install
npm run db:generate
npm run dev
```

## Prisma Migration Workflow

```bash
# 开发环境生成迁移
npm run db:migrate:dev

# 生产环境部署迁移
npm run db:migrate:deploy
```

当前迁移文件已入库：`prisma/migrations`

说明：如果部署环境未设置 `DIRECT_URL`，脚本会自动回退为 `DATABASE_URL`，避免构建失败。

## Vercel Deployment

已配置 `vercel.json` 使用：

```bash
npm run vercel-build
```

该命令会执行：

1. `prisma generate`
2. `prisma migrate deploy`
3. `next build`

## Observability + Alerts

- Sentry 已接入（`instrumentation.ts`、`instrumentation-client.ts`）
- API 异常上报重点覆盖：
  - `/api/ai/search`
  - `/api/ai/evidence`
  - `/api/ai/analyze`
  - `/api/evidences/[id]`
  - `/api/evidences/bulk-review`

建议在 Vercel 项目中开启：

1. Runtime/Function Error 通知（Email/Slack）
2. 关键路径日志过滤（`/api/ai/*` 与 `/api/evidences/*`）
3. 峰值 429 告警（识别限流触发异常）

## Quality Gates

```bash
npm run lint
npm run test
npm run build
```

CI: `.github/workflows/ci.yml`

## Security/Cost Controls

- 统一中间件鉴权（管理页 + 写接口 + 证据接口）
- 上传接口：鉴权 + 速率限制 + 文件签名校验 + 私有桶 + 签名 URL
- AI 接口：全局限流 + 短期缓存（Upstash 持久化）
- 图谱接口：按 `centralId` 快照缓存，联动/证据变更自动失效
