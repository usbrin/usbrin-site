-- USBRIN Partners: financial audit additions; apply after 0001, first on preview database.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sale_receipts (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  reference TEXT NOT NULL UNIQUE CHECK(length(reference)>2),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id TEXT NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_receipts_sale ON sale_receipts(sale_id,received_at);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON sale_receipts(received_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_one_sale ON commissions(sale_id);
ALTER TABLE commissions ADD COLUMN payment_reference TEXT;
ALTER TABLE developer_payments ADD COLUMN payment_reference TEXT;
