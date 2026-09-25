PRAGMA foreign_keys = ON;
CREATE TABLE reports (
 id TEXT PRIMARY KEY,
 report_date TEXT NOT NULL UNIQUE,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 filename TEXT NOT NULL,
 raw_path TEXT NOT NULL,
 hash TEXT NOT NULL UNIQUE,
 error TEXT,
 imported_at TEXT NOT NULL,
 parser_version TEXT NOT NULL,
 totalNet REAL NOT NULL,
 totalAuc REAL NOT NULL,
 status TEXT NOT NULL DEFAULT 'accepted' CHECK(status = 'accepted')
);
CREATE TABLE flows (
 report_id TEXT NOT NULL REFERENCES reports(id),
 sector TEXT NOT NULL COLLATE NOCASE,
 net REAL NOT NULL,
 auc REAL NOT NULL,
 PRIMARY KEY (report_id, sector)
);
CREATE TABLE import_attempts (
 id TEXT PRIMARY KEY,
 hash TEXT NOT NULL,
 raw_key TEXT NOT NULL,
 filename TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','failed','duplicate')),
 error TEXT,
 report_id TEXT REFERENCES reports(id),
 parser_version TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX import_attempts_hash ON import_attempts(hash);
