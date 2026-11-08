-- USBRIN · CRM v1 (homologação). Nunca aplicar direto em produção sem migração controlada.
PRAGMA foreign_keys=ON;
ALTER TABLE opportunities ADD COLUMN next_action TEXT;
ALTER TABLE opportunities ADD COLUMN next_action_at TEXT;
ALTER TABLE opportunities ADD COLUMN last_contact_at TEXT;
ALTER TABLE opportunities ADD COLUMN lost_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_op_next_action ON opportunities(next_action_at,stage,partner_id);
CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('contact','note','followup','stage')),
  note TEXT NOT NULL CHECK(length(note) BETWEEN 3 AND 1200),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_activity_op ON crm_activities(opportunity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_crm_activity_actor ON crm_activities(actor_id,created_at);
