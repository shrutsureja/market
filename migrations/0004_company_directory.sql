-- Immutable validated lists and a single atomic active pointer. Preview never edits the active data.
CREATE TABLE company_datasets (
 id TEXT PRIMARY KEY,
 base_id TEXT,
 filename TEXT NOT NULL,
 source TEXT NOT NULL,
 downloaded_on TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 confirmed_at TEXT,
 sha256 TEXT NOT NULL,
 companies_json TEXT NOT NULL CHECK(json_valid(companies_json))
);
CREATE TABLE company_directory (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 dataset_id TEXT REFERENCES company_datasets(id)
);
INSERT INTO company_directory(singleton,dataset_id) VALUES(1,NULL);
