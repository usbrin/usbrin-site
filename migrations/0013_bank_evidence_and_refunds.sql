-- USBRIN financial evidence v1: independent CSV import (not proof of bank authenticity),
-- one-to-one receipt matching, and audit-preserving refund compensation.
-- Preview D1 only until comprehensive review / backup restoration / pilot.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS bank_imports (
 id TEXT PRIMARY KEY,
 account_alias TEXT NOT NULL CHECK(length(account_alias) BETWEEN 4 AND 60),
 filename TEXT NOT NULL CHECK(length(filename) BETWEEN 3 AND 120),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 row_count INTEGER NOT NULL CHECK(row_count BETWEEN 1 AND 150),
 imported_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(account_alias,sha256)
);
CREATE TABLE IF NOT EXISTS bank_entries (
 id TEXT PRIMARY KEY,
 import_id TEXT NOT NULL REFERENCES bank_imports(id),
 account_alias TEXT NOT NULL,
 external_id TEXT NOT NULL CHECK(length(external_id) BETWEEN 6 AND 120),
 posted_on TEXT NOT NULL CHECK(length(posted_on)=10),
 amount_cents INTEGER NOT NULL CHECK(amount_cents<>0 AND amount_cents BETWEEN -100000000 AND 100000000),
 description TEXT NOT NULL CHECK(length(description) BETWEEN 3 AND 350),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(account_alias,external_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_entries_date ON bank_entries(posted_on);
CREATE INDEX IF NOT EXISTS idx_bank_entries_import ON bank_entries(import_id);
CREATE TABLE IF NOT EXISTS bank_receipt_matches (
 id TEXT PRIMARY KEY,
 entry_id TEXT NOT NULL UNIQUE REFERENCES bank_entries(id),
 receipt_kind TEXT NOT NULL CHECK(receipt_kind IN ('sale','service')),
 receipt_id TEXT NOT NULL,
 matched_by TEXT NOT NULL REFERENCES users(id),
 matched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(receipt_kind,receipt_id)
);
CREATE TABLE IF NOT EXISTS bank_refunds (
 id TEXT PRIMARY KEY,
 receipt_kind TEXT NOT NULL CHECK(receipt_kind IN ('sale','service')),
 receipt_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<=100000000),
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 15 AND 800),
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','settled')),
 requested_by TEXT NOT NULL REFERENCES users(id),
 approved_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 settled_by TEXT REFERENCES users(id),
 bank_entry_id TEXT UNIQUE REFERENCES bank_entries(id),
 settled_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bank_refund_receipt ON bank_refunds(receipt_kind,receipt_id,status);
CREATE INDEX IF NOT EXISTS idx_bank_refund_status ON bank_refunds(status,created_at);

CREATE TRIGGER IF NOT EXISTS trg_bank_import_no_change
BEFORE UPDATE ON bank_imports BEGIN SELECT RAISE(ABORT,'bank import immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_import_no_delete
BEFORE DELETE ON bank_imports BEGIN SELECT RAISE(ABORT,'bank import immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_entry_no_change
BEFORE UPDATE ON bank_entries BEGIN SELECT RAISE(ABORT,'bank entry immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_entry_no_delete
BEFORE DELETE ON bank_entries BEGIN SELECT RAISE(ABORT,'bank entry immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_match_verify
BEFORE INSERT ON bank_receipt_matches
BEGIN
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM bank_entries b
   WHERE b.id=NEW.entry_id AND b.amount_cents>0 AND (
    (NEW.receipt_kind='sale' AND EXISTS (
      SELECT 1 FROM sale_receipts r WHERE r.id=NEW.receipt_id
      AND r.amount_cents=b.amount_cents AND UPPER(r.reference)=UPPER(b.external_id)
    )) OR
    (NEW.receipt_kind='service' AND EXISTS (
      SELECT 1 FROM service_receipts r WHERE r.id=NEW.receipt_id
      AND r.amount_cents=b.amount_cents AND UPPER(r.reference)=UPPER(b.external_id)
    ))
   )
 ) THEN RAISE(ABORT,'bank match requires same amount and original bank reference') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_match_no_update
BEFORE UPDATE ON bank_receipt_matches BEGIN SELECT RAISE(ABORT,'bank match immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_match_no_delete
BEFORE DELETE ON bank_receipt_matches BEGIN SELECT RAISE(ABORT,'bank match immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_bank_refund_validate
BEFORE INSERT ON bank_refunds
BEGIN
 SELECT CASE WHEN NOT (
  (NEW.receipt_kind='sale' AND EXISTS(SELECT 1 FROM sale_receipts r WHERE r.id=NEW.receipt_id AND r.amount_cents>=NEW.amount_cents))
  OR
  (NEW.receipt_kind='service' AND EXISTS(SELECT 1 FROM service_receipts r WHERE r.id=NEW.receipt_id AND r.amount_cents>=NEW.amount_cents))
 ) THEN RAISE(ABORT,'invalid original receipt or refund amount') END;
 SELECT CASE WHEN (
   COALESCE((SELECT SUM(x.amount_cents) FROM bank_refunds x WHERE x.receipt_kind=NEW.receipt_kind
     AND x.receipt_id=NEW.receipt_id AND x.status<>'rejected'),0)+NEW.amount_cents
 )>COALESCE(
   (SELECT r.amount_cents FROM sale_receipts r WHERE NEW.receipt_kind='sale' AND r.id=NEW.receipt_id),
   (SELECT r.amount_cents FROM service_receipts r WHERE NEW.receipt_kind='service' AND r.id=NEW.receipt_id),
   0
 ) THEN RAISE(ABORT,'refund total exceeds original receipt') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_refund_immutable_fields
BEFORE UPDATE OF receipt_kind,receipt_id,amount_cents,reason,requested_by,created_at ON bank_refunds
BEGIN SELECT RAISE(ABORT,'refund identity and amount immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bank_refund_workflow
BEFORE UPDATE OF status ON bank_refunds
BEGIN
 SELECT CASE WHEN NOT (
  (OLD.status='requested' AND NEW.status IN ('approved','rejected'))
  OR (OLD.status='approved' AND NEW.status IN ('settled','rejected'))
 ) THEN RAISE(ABORT,'refund status transition prohibited') END;
 SELECT CASE WHEN NEW.status='approved' AND NOT EXISTS(
  SELECT 1 FROM bank_receipt_matches m WHERE m.receipt_kind=OLD.receipt_kind AND m.receipt_id=OLD.receipt_id
 ) THEN RAISE(ABORT,'refund approval requires bank-matched original receipt') END;
 SELECT CASE WHEN NEW.status='settled' AND NOT EXISTS(
  SELECT 1 FROM bank_entries b WHERE b.id=NEW.bank_entry_id AND b.amount_cents=-OLD.amount_cents
 ) THEN RAISE(ABORT,'settled refund needs matching imported bank debit') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bank_refund_no_delete
BEFORE DELETE ON bank_refunds BEGIN SELECT RAISE(ABORT,'refund history immutable'); END;
