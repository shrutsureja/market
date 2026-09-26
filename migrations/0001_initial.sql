PRAGMA foreign_keys = ON;
CREATE TABLE reports (
 id TEXT PRIMARY KEY,
 report_date TEXT NOT NULL UNIQUE,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 filename TEXT NOT NULL,
 hash TEXT NOT NULL UNIQUE,
 imported_at TEXT NOT NULL,
 totalNet REAL NOT NULL,
 totalAuc REAL NOT NULL
);
CREATE TABLE flows (
 report_id TEXT NOT NULL REFERENCES reports(id),
 sector TEXT NOT NULL COLLATE NOCASE,
 net REAL NOT NULL,
 auc REAL NOT NULL,
 PRIMARY KEY (report_id, sector)
);
