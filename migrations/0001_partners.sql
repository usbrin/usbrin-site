-- USBRIN Partners · v1 · use only against a dedicated preview D1 database first.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, protocol TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK(type IN ('representante','desenvolvedor')),
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
  city TEXT NOT NULL, state TEXT NOT NULL, experience TEXT NOT NULL,
  motivation TEXT NOT NULL, portfolio TEXT, availability TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','review','requested','interview','preapproved','documentation','approved','rejected','withdrawn')),
  reviewer_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(type,status,created_at);
CREATE INDEX IF NOT EXISTS idx_app_email ON applications(email,type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_active_unique ON applications(email,type) WHERE status NOT IN ('rejected','withdrawn');
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','representante','desenvolvedor')),
  status TEXT NOT NULL CHECK(status IN ('pending','active','suspended')), application_id TEXT REFERENCES applications(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES users(id),company TEXT NOT NULL,contact TEXT NOT NULL,
  city TEXT,segment TEXT,product TEXT,estimated_cents INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contact','interested','qualified','proposal','negotiation','contracted','paid','lost','cancelled')),
  note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_op_partner ON opportunities(partner_id,updated_at);
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL UNIQUE REFERENCES opportunities(id), gross_cents INTEGER NOT NULL CHECK(gross_cents>=0),
  received_cents INTEGER NOT NULL DEFAULT 0 CHECK(received_cents>=0),
  receipt_reference TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partially_paid','paid','reversed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES sales(id), partner_id TEXT NOT NULL REFERENCES users(id),
  basis_cents INTEGER NOT NULL, rate_bps INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('estimated','approved','due','paid','reversed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES users(id), period TEXT NOT NULL,
  goal_cents INTEGER NOT NULL CHECK(goal_cents>=0), UNIQUE(partner_id,period)
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  developer_id TEXT REFERENCES users(id), compensation_cents INTEGER NOT NULL DEFAULT 0 CHECK(compensation_cents>=0),
  due_at TEXT,preview_url TEXT,stage TEXT NOT NULL DEFAULT 'proposed' CHECK(stage IN ('proposed','accepted','in_progress','review','changes','approved','done','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS developer_payments (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), developer_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),status TEXT NOT NULL CHECK(status IN ('pending','approved','paid','cancelled')),
  paid_at TEXT,reference TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT,details TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_events(created_at);
