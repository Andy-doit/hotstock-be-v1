ALTER TABLE "User"
  ADD COLUMN "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "personalDataConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "personalDataConsentAt" TIMESTAMP(3);
