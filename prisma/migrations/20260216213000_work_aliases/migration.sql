-- CreateTable
CREATE TABLE "WorkAlias" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "locale" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkAlias_workId_normalizedAlias_key" ON "WorkAlias"("workId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "WorkAlias_normalizedAlias_createdAt_idx" ON "WorkAlias"("normalizedAlias", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkAlias" ADD CONSTRAINT "WorkAlias_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing works with primary aliases
INSERT INTO "WorkAlias" ("id", "workId", "alias", "normalizedAlias", "isPrimary", "createdAt", "updatedAt")
SELECT
  ('alias_' || w."id"),
  w."id",
  w."title",
  regexp_replace(lower(w."title"), '[[:space:][:punct:]]+', '', 'g'),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Work" w
ON CONFLICT ("workId", "normalizedAlias") DO NOTHING;
