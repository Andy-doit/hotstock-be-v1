-- CreateTable
CREATE TABLE "PlanFieldVisibility" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "dashboardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "performanceChartEnabled" BOOLEAN NOT NULL DEFAULT true,
    "portfolioCompositionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "targetInfoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "analysisCardsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "portfolioTableEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dashboardTitle" TEXT,
    "dashboardDescription" TEXT,
    "performanceTitle" TEXT,
    "performanceDescription" TEXT,
    "portfolioCompositionTitle" TEXT,
    "portfolioCompositionDescription" TEXT,
    "targetInfoTitle" TEXT,
    "targetInfoDescription" TEXT,
    "analysisTitle" TEXT,
    "analysisDescription" TEXT,
    "portfolioTableTitle" TEXT,
    "portfolioTableDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanFieldVisibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanFieldVisibility_planId_key" ON "PlanFieldVisibility"("planId");

-- AddForeignKey
ALTER TABLE "PlanFieldVisibility" ADD CONSTRAINT "PlanFieldVisibility_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
