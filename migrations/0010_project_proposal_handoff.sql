-- USBRIN Partners — link approved client proposals to technical projects for traceability.
-- Apply only to the isolated preview D1 first.
PRAGMA foreign_keys=ON;
ALTER TABLE projects ADD COLUMN proposal_id TEXT REFERENCES proposals(id);
CREATE INDEX IF NOT EXISTS idx_projects_proposal ON projects(proposal_id);
