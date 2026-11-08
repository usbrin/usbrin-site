-- USBRIN Partners: track optional operational services separately from website creation.
-- Values are preliminary references only; no subscription, invoice or receipt is created.
PRAGMA foreign_keys=ON;
ALTER TABLE proposals ADD COLUMN hosting_requested INTEGER NOT NULL DEFAULT 0 CHECK(hosting_requested IN (0,1));
ALTER TABLE proposals ADD COLUMN support_requested INTEGER NOT NULL DEFAULT 0 CHECK(support_requested IN (0,1));
ALTER TABLE proposals ADD COLUMN support_reference_monthly_cents INTEGER NOT NULL DEFAULT 0 CHECK(support_reference_monthly_cents IN (0,25000));
