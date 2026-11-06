-- USBRIN Partners: keep verifiable evidence of each partner's onboarding approval.
ALTER TABLE users ADD COLUMN contract_reference TEXT;
ALTER TABLE users ADD COLUMN contract_verified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_user_contract ON users(contract_reference);
