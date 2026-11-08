-- USBRIN: operational payables. A vendor bill is not a bank payment.
-- Immutable evidence and bank-debit matching protect payment classification.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS expense_obligations (
 id TEXT PRIMARY KEY,
 supplier TEXT NOT NULL CHECK(length(supplier) BETWEEN 3 AND 160),
 label TEXT NOT NULL CHECK(length(label) BETWEEN 8 AND 260),
 category TEXT NOT NULL CHECK(category IN ('infrastructure','software','marketing','tax','contractor','office','other')),
 sale_id TEXT REFERENCES sales(id),
 project_id TEXT REFERENCES projects(id),
 document_reference TEXT NOT NULL CHECK(length(document_reference) BETWEEN 5 AND 160),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000),
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents>=0 AND paid_cents<=amount_cents),
 due_on TEXT NOT NULL CHECK(length(due_on)=10),
 status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved','partially_paid','paid','cancelled')),
 cancel_reason TEXT,
 cancelled_by TEXT REFERENCES users(id),
 cancelled_at TEXT,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(supplier,document_reference)
);
CREATE INDEX IF NOT EXISTS idx_expense_due ON expense_obligations(status,due_on);
CREATE INDEX IF NOT EXISTS idx_expense_sale ON expense_obligations(sale_id,created_at);
CREATE TABLE IF NOT EXISTS expense_payments (
 id TEXT PRIMARY KEY,
 expense_id TEXT NOT NULL REFERENCES expense_obligations(id),
 bank_entry_id TEXT NOT NULL UNIQUE REFERENCES bank_entries(id),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
 actor_id TEXT NOT NULL REFERENCES users(id),
 paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expense_payment_expense ON expense_payments(expense_id,paid_at);

CREATE TRIGGER IF NOT EXISTS trg_expense_terms_immutable
BEFORE UPDATE OF supplier,label,category,sale_id,project_id,document_reference,amount_cents,due_on,created_by,created_at ON expense_obligations
BEGIN SELECT RAISE(ABORT,'expense terms immutable; create compensating record'); END;
CREATE TRIGGER IF NOT EXISTS trg_expense_no_delete
BEFORE DELETE ON expense_obligations BEGIN SELECT RAISE(ABORT,'expense obligation history immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_expense_payment_verify
BEFORE INSERT ON expense_payments
BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM expense_obligations e
  JOIN bank_entries b ON b.id=NEW.bank_entry_id
  WHERE e.id=NEW.expense_id AND e.status IN ('approved','partially_paid')
    AND b.amount_cents=-NEW.amount_cents
    AND e.paid_cents+NEW.amount_cents<=e.amount_cents
    AND NOT EXISTS(SELECT 1 FROM bank_refunds r WHERE r.bank_entry_id=b.id)
 ) THEN RAISE(ABORT,'expense payment requires unused imported bank debit and available balance') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_payment_apply
AFTER INSERT ON expense_payments
BEGIN
 UPDATE expense_obligations
 SET paid_cents=paid_cents+NEW.amount_cents,
   status=CASE WHEN paid_cents+NEW.amount_cents=amount_cents THEN 'paid' ELSE 'partially_paid' END,
   updated_at=datetime('now')
 WHERE id=NEW.expense_id;
 INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.actor_id,'expense.payment','expense_obligation',NEW.expense_id,
   'amount='||NEW.amount_cents||' entry='||NEW.bank_entry_id,datetime('now'));
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_payment_no_update
BEFORE UPDATE ON expense_payments BEGIN SELECT RAISE(ABORT,'expense payment immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_expense_payment_no_delete
BEFORE DELETE ON expense_payments BEGIN SELECT RAISE(ABORT,'expense payment immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_refund_debit_not_expense
BEFORE UPDATE OF status ON bank_refunds
WHEN NEW.status='settled' AND EXISTS(SELECT 1 FROM expense_payments p WHERE p.bank_entry_id=NEW.bank_entry_id)
BEGIN SELECT RAISE(ABORT,'bank debit already used for an expense payment'); END;
CREATE TRIGGER IF NOT EXISTS trg_expense_create_audit
AFTER INSERT ON expense_obligations
BEGIN
 INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.created_by,'expense.create','expense_obligation',NEW.id,
   'supplier='||NEW.supplier||' category='||NEW.category||' amount='||NEW.amount_cents,datetime('now'));
END;

CREATE TRIGGER IF NOT EXISTS trg_expense_cancel_rules
BEFORE UPDATE OF status ON expense_obligations
WHEN NEW.status='cancelled'
BEGIN
 SELECT CASE WHEN OLD.status<>'approved' OR OLD.paid_cents<>0 OR NEW.cancelled_by IS NULL
    OR length(NEW.cancel_reason)<12 OR NEW.cancelled_at IS NULL
   THEN RAISE(ABORT,'expense cancellation requires unpaid obligation, admin and reason') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_cancel_audit
AFTER UPDATE OF status ON expense_obligations
WHEN NEW.status='cancelled'
BEGIN
 INSERT INTO audit_events(id,actor_id,action,entity,entity_id,details,created_at)
 VALUES(lower(hex(randomblob(16))),NEW.cancelled_by,'expense.cancel','expense_obligation',NEW.id,
   'reason='||NEW.cancel_reason,datetime('now'));
END;
CREATE TRIGGER IF NOT EXISTS trg_expense_no_cancel_metadata_tamper
BEFORE UPDATE OF cancel_reason,cancelled_by,cancelled_at ON expense_obligations
WHEN NEW.status=OLD.status
BEGIN SELECT RAISE(ABORT,'expense cancellation record immutable'); END;
