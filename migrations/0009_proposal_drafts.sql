-- USBRIN | Propostas comerciais preparatórias. Emissão e aceite NÃO criam venda nem contrato.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS proposals (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
 created_by TEXT NOT NULL REFERENCES users(id),
 product TEXT NOT NULL CHECK(product IN ('landing','business','catalogo','personalizado')),
 scope TEXT NOT NULL CHECK(length(scope) BETWEEN 30 AND 4000),
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 1 AND 100000000),
 duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 180),
 valid_until TEXT NOT NULL,
 terms TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','rejected','sent')),
 cost_dev_cents INTEGER CHECK(cost_dev_cents BETWEEN 0 AND 100000000),
 cost_commission_cents INTEGER CHECK(cost_commission_cents BETWEEN 0 AND 100000000),
 cost_tax_cents INTEGER CHECK(cost_tax_cents BETWEEN 0 AND 100000000),
 cost_other_cents INTEGER CHECK(cost_other_cents BETWEEN 0 AND 100000000),
 review_note TEXT,
 approved_by TEXT REFERENCES users(id),
 approved_at TEXT,
 sent_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON proposals(opportunity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status,created_at);
