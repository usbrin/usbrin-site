-- One Studio inquiry can create at most one CRM opportunity. D1 batch must be atomic.
CREATE TABLE IF NOT EXISTS studio_inquiry_assignments (
  inquiry_id TEXT PRIMARY KEY REFERENCES studio_inquiries(id),
  opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(id),
  partner_id TEXT NOT NULL REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_studio_assignment_partner ON studio_inquiry_assignments(partner_id);
