-- Partial uploads must never be activatable as complete company lists.
ALTER TABLE company_datasets ADD COLUMN is_chunk INTEGER NOT NULL DEFAULT 0;
