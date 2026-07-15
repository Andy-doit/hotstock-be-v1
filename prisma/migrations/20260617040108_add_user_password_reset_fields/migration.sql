-- AlterTable
ALTER TABLE "PortfolioStock" ADD COLUMN     "sector" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordExpires" TIMESTAMP(3),
ADD COLUMN     "resetPasswordOtp" TEXT;
