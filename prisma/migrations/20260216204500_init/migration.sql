-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('NOVEL', 'MANGA', 'ANIME', 'GAME', 'MOVIE', 'TV_SERIES', 'MUSIC', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "WorkType" NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "isCentral" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "fromWorkId" TEXT NOT NULL,
    "toWorkId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "workId" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "fileUrl" TEXT,
    "storagePath" TEXT,
    "fileName" TEXT,
    "description" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "aiConfidence" DOUBLE PRECISION,
    "scrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceReviewLog" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "beforeStatus" "EvidenceStatus" NOT NULL,
    "afterStatus" "EvidenceStatus" NOT NULL,
    "reason" TEXT,
    "reviewedBy" TEXT,
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadAuditLog" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT,
    "storagePath" TEXT NOT NULL,
    "uploader" TEXT,
    "uploaderId" TEXT,
    "ipAddress" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Connection_fromWorkId_toWorkId_level_idx" ON "Connection"("fromWorkId", "toWorkId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Connection_fromWorkId_toWorkId_relationType_key" ON "Connection"("fromWorkId", "toWorkId", "relationType");

-- CreateIndex
CREATE INDEX "Evidence_connectionId_status_createdAt_idx" ON "Evidence"("connectionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Evidence_storagePath_idx" ON "Evidence"("storagePath");

-- CreateIndex
CREATE INDEX "EvidenceReviewLog_evidenceId_reviewedAt_idx" ON "EvidenceReviewLog"("evidenceId", "reviewedAt");

-- CreateIndex
CREATE INDEX "UploadAuditLog_storagePath_uploadedAt_idx" ON "UploadAuditLog"("storagePath", "uploadedAt");

-- CreateIndex
CREATE INDEX "UploadAuditLog_evidenceId_idx" ON "UploadAuditLog"("evidenceId");

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_fromWorkId_fkey" FOREIGN KEY ("fromWorkId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_toWorkId_fkey" FOREIGN KEY ("toWorkId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReviewLog" ADD CONSTRAINT "EvidenceReviewLog_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadAuditLog" ADD CONSTRAINT "UploadAuditLog_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

