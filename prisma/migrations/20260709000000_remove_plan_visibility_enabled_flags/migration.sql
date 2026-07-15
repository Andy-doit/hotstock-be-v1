ALTER TABLE "PlanFieldVisibility"
  DROP COLUMN IF EXISTS "dashboardEnabled",
  DROP COLUMN IF EXISTS "performanceChartEnabled",
  DROP COLUMN IF EXISTS "portfolioCompositionEnabled",
  DROP COLUMN IF EXISTS "targetInfoEnabled",
  DROP COLUMN IF EXISTS "analysisCardsEnabled",
  DROP COLUMN IF EXISTS "portfolioTableEnabled";
