-- USBRIN | atomic bank-receipt ledger. Existing rows remain unchanged.
-- New receipts update sale totals and linked opportunity inside the same SQLite statement.
CREATE TRIGGER IF NOT EXISTS trg_sale_receipts_validate
BEFORE INSERT ON sale_receipts
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM sales s
    WHERE s.id=NEW.sale_id
      AND s.status IN ('pending','partially_paid')
      AND NEW.amount_cents>0
      AND (s.received_cents+NEW.amount_cents)<=s.gross_cents
  ) THEN RAISE(ABORT,'receipt exceeds payable balance or sale not eligible') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_receipts_apply
AFTER INSERT ON sale_receipts
BEGIN
  UPDATE sales
  SET received_cents=received_cents+NEW.amount_cents,
      status=CASE WHEN received_cents+NEW.amount_cents=gross_cents THEN 'paid' ELSE 'partially_paid' END,
      updated_at=datetime('now')
  WHERE id=NEW.sale_id;
  UPDATE opportunities
  SET stage=CASE WHEN (SELECT status FROM sales WHERE id=NEW.sale_id)='paid' THEN 'paid' ELSE 'contracted' END,
      updated_at=datetime('now')
  WHERE id=(SELECT opportunity_id FROM sales WHERE id=NEW.sale_id);
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_receipts_immutable_update
BEFORE UPDATE ON sale_receipts
BEGIN SELECT RAISE(ABORT,'financial receipt history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_sale_receipts_immutable_delete
BEFORE DELETE ON sale_receipts
BEGIN SELECT RAISE(ABORT,'financial receipt history is immutable'); END;
