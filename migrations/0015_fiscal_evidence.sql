-- USBRIN fiscal evidence register. It never issues or cancels documents at the tax authority.
-- Documents must be checked with the accountant/official issuer before being registered.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS fiscal_documents (
 id TEXT PRIMARY KEY,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('sale','service_charge','expense')),
 source_id TEXT NOT NULL,
 document_type TEXT NOT NULL CHECK(document_type IN ('nfse','supplier_invoice')),
 issuer_name TEXT NOT NULL CHECK(length(issuer_name) BETWEEN 3 AND 160),
 document_number TEXT NOT NULL CHECK(length(document_number) BETWEEN 3 AND 120),
 verification_code TEXT NOT NULL CHECK(length(verification_code) BETWEEN 3 AND 180),
 issued_on TEXT NOT NULL CHECK(length(issued_on)=10),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 status TEXT NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','cancelled')),
 cancellation_reason TEXT,
 cancelled_by TEXT REFERENCES users(id),
 cancelled_at TEXT,
 recorded_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(issuer_name,document_type,document_number)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_source ON fiscal_documents(source_kind,source_id,status);
CREATE INDEX IF NOT EXISTS idx_fiscal_date ON fiscal_documents(issued_on,status);
CREATE TRIGGER IF NOT EXISTS trg_fiscal_source_valid
BEFORE INSERT ON fiscal_documents
BEGIN
 SELECT CASE WHEN NOT (
   (NEW.source_kind='sale' AND NEW.document_type='nfse' AND EXISTS(SELECT 1 FROM sales s WHERE s.id=NEW.source_id AND NEW.amount_cents<=s.gross_cents))
   OR (NEW.source_kind='service_charge' AND NEW.document_type='nfse' AND EXISTS(SELECT 1 FROM service_charges c WHERE c.id=NEW.source_id AND NEW.amount_cents<=c.amount_cents))
   OR (NEW.source_kind='expense' AND NEW.document_type='supplier_invoice' AND EXISTS(SELECT 1 FROM expense_obligations e WHERE e.id=NEW.source_id AND NEW.amount_cents<=e.amount_cents))
 ) THEN RAISE(ABORT,'fiscal document source or amount invalid') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_immutable
BEFORE UPDATE OF source_kind,source_id,document_type,issuer_name,document_number,verification_code,issued_on,amount_cents,recorded_by,created_at
ON fiscal_documents BEGIN SELECT RAISE(ABORT,'fiscal evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_cancel
BEFORE UPDATE OF status ON fiscal_documents
BEGIN
 SELECT CASE WHEN NOT (
   OLD.status='recorded' AND NEW.status='cancelled'
   AND length(NEW.cancellation_reason)>=15 AND NEW.cancelled_by IS NOT NULL AND NEW.cancelled_at IS NOT NULL
 ) THEN RAISE(ABORT,'fiscal evidence cancellation requires official confirmation') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_cancel_metadata
BEFORE UPDATE OF cancellation_reason,cancelled_by,cancelled_at ON fiscal_documents
WHEN NEW.status=OLD.status
BEGIN SELECT RAISE(ABORT,'fiscal cancellation history immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_no_delete
BEFORE DELETE ON fiscal_documents BEGIN SELECT RAISE(ABORT,'fiscal evidence immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_add_audit
AFTER INSERT ON fiscal_documents
BEGIN
 INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.recorded_by,'fiscal.document.record','fiscal_document',NEW.id,
   NEW.source_kind||' source='||NEW.source_id||' document='||NEW.document_number,datetime('now'));
END;
CREATE TRIGGER IF NOT EXISTS trg_fiscal_cancel_audit
AFTER UPDATE OF status ON fiscal_documents
BEGIN
 INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.cancelled_by,'fiscal.document.cancel','fiscal_document',NEW.id,
   'reason='||NEW.cancellation_reason,datetime('now'));
END;
