-- USBRIN Studio → USBRIN Admin (homologação). Solicitação não é proposta aceita nem venda.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS studio_inquiries (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  goal TEXT NOT NULL,
  notes TEXT,
  briefing TEXT NOT NULL,
  product TEXT NOT NULL CHECK(product IN ('landing','business','catalogo')),
  estimate_cents INTEGER NOT NULL CHECK(estimate_cents BETWEEN 0 AND 100000000),
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','review','qualified','proposal','closed','archived')),
  assigned_partner_id TEXT REFERENCES users(id),
  opportunity_id TEXT REFERENCES opportunities(id),
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consent_version TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'studio'
);
CREATE INDEX IF NOT EXISTS idx_studio_inquiries_status ON studio_inquiries(status,created_at);
CREATE INDEX IF NOT EXISTS idx_studio_inquiries_partner ON studio_inquiries(assigned_partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_inquiries_opportunity ON studio_inquiries(opportunity_id);
