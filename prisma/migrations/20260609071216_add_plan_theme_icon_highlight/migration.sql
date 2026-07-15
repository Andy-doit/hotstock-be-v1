-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isVisibleOnUI" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "highlighted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'dark';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "phoneNumber" TEXT;
