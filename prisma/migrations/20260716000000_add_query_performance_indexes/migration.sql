-- Query-path indexes for admin lists, dashboard widgets, and bounded article feeds.
-- Prisma runs migrations inside a transaction, so these indexes cannot use CONCURRENTLY.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS "User_username_idx"
  ON "User"("username");

CREATE INDEX IF NOT EXISTS "User_planId_idx"
  ON "User"("planId");

CREATE INDEX IF NOT EXISTS "User_createdAt_idx"
  ON "User"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_role_createdAt_idx"
  ON "User"("role", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_blocked_createdAt_idx"
  ON "User"("blocked", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_email_trgm_idx"
  ON "User" USING GIN ("email" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_username_trgm_idx"
  ON "User" USING GIN ("username" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "User_fullName_trgm_idx"
  ON "User" USING GIN ("fullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Plan_isActive_sortOrder_idx"
  ON "Plan"("isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "Article_createdAt_idx"
  ON "Article"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Article_authorId_createdAt_idx"
  ON "Article"("authorId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Article_categoryId_createdAt_idx"
  ON "Article"("categoryId", "createdAt" DESC);
