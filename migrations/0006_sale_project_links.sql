-- Link one contracted sale to one website delivery. Direct/academic projects remain possible with NULL sale_id.
ALTER TABLE projects ADD COLUMN sale_id TEXT REFERENCES sales(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_unique_sale ON projects(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_due_stage ON projects(due_at,stage);
