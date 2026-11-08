-- USBRIN | Contratos de servicos recorrentes, agenda manual e reconciliacao auditavel.
-- Primeira aplicacao somente no D1 PREVIEW. Nao cria faturas externas ou debitos automaticos.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS service_agreements (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  kind TEXT NOT NULL CHECK(kind IN ('support','hosting')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
  cadence TEXT NOT NULL CHECK(cadence IN ('monthly','annual')),
  start_on TEXT NOT NULL CHECK(length(start_on)=10),
  contract_reference TEXT NOT NULL CHECK(length(contract_reference)>=8),
  terms_summary TEXT NOT NULL CHECK(length(terms_summary) BETWEEN 30 AND 1600),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','cancelled')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sale_id,kind)
);
CREATE INDEX IF NOT EXISTS idx_service_agreement_status ON service_agreements(status,kind);
CREATE TABLE IF NOT EXISTS service_charges (
  id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES service_agreements(id),
  period TEXT NOT NULL,
  due_on TEXT NOT NULL CHECK(length(due_on)=10),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
  received_cents INTEGER NOT NULL DEFAULT 0 CHECK(received_cents>=0 AND received_cents<=amount_cents),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partially_paid','paid')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agreement_id,period)
);
CREATE INDEX IF NOT EXISTS idx_service_charge_due ON service_charges(status,due_on);
CREATE INDEX IF NOT EXISTS idx_service_charge_agreement ON service_charges(agreement_id,period);
CREATE TABLE IF NOT EXISTS service_receipts (
  id TEXT PRIMARY KEY,
  charge_id TEXT NOT NULL REFERENCES service_charges(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  reference TEXT NOT NULL UNIQUE CHECK(length(reference)>=3),
  actor_id TEXT NOT NULL REFERENCES users(id),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_receipt_charge ON service_receipts(charge_id,received_at);

CREATE TRIGGER IF NOT EXISTS trg_service_agreement_immutable_identity
BEFORE UPDATE OF sale_id,kind,amount_cents,cadence,start_on,contract_reference,terms_summary,created_by ON service_agreements
BEGIN SELECT RAISE(ABORT,'service agreement terms are immutable; create an approved amendment'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_agreement_no_delete
BEFORE DELETE ON service_agreements
BEGIN SELECT RAISE(ABORT,'service agreement history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_charge_valid
BEFORE INSERT ON service_charges
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM service_agreements a
    WHERE a.id=NEW.agreement_id AND a.status='active'
      AND NEW.amount_cents=a.amount_cents
      AND (
        (a.cadence='monthly' AND length(NEW.period)=7 AND substr(NEW.due_on,1,7)=NEW.period)
        OR
        (a.cadence='annual' AND length(NEW.period)=4 AND substr(NEW.due_on,1,4)=NEW.period)
      )
      AND NEW.due_on>=a.start_on
  ) THEN RAISE(ABORT,'service charge does not match an active service agreement') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_service_charge_immutable_terms
BEFORE UPDATE OF agreement_id,period,due_on,amount_cents,created_by,created_at ON service_charges
BEGIN SELECT RAISE(ABORT,'service charge terms are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_charge_no_delete
BEFORE DELETE ON service_charges
BEGIN SELECT RAISE(ABORT,'service charge history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_receipt_validate
BEFORE INSERT ON service_receipts
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM service_charges c
    WHERE c.id=NEW.charge_id AND c.status IN ('pending','partially_paid')
      AND c.received_cents+NEW.amount_cents<=c.amount_cents
  ) THEN RAISE(ABORT,'service receipt exceeds balance or charge is closed') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM sale_receipts sr WHERE sr.reference=NEW.reference
  ) THEN RAISE(ABORT,'reference already used for a website sale receipt') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_service_receipt_apply
AFTER INSERT ON service_receipts
BEGIN
  UPDATE service_charges
  SET received_cents=received_cents+NEW.amount_cents,
    status=CASE WHEN received_cents+NEW.amount_cents=amount_cents THEN 'paid' ELSE 'partially_paid' END,
    updated_at=datetime('now')
  WHERE id=NEW.charge_id;
END;
CREATE TRIGGER IF NOT EXISTS trg_service_receipt_no_update
BEFORE UPDATE ON service_receipts
BEGIN SELECT RAISE(ABORT,'service receipt is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_service_receipt_no_delete
BEFORE DELETE ON service_receipts
BEGIN SELECT RAISE(ABORT,'service receipt is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_website_receipt_no_reuse_service_reference
BEFORE INSERT ON sale_receipts
BEGIN
  SELECT CASE WHEN EXISTS(
    SELECT 1 FROM service_receipts sr WHERE sr.reference=NEW.reference
  ) THEN RAISE(ABORT,'reference already used for a service receipt') END;
END;
