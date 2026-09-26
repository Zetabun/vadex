-- v2.24: reserved names (a name only its holder may use, or nobody); api/admin.mjs reserve / unreserve / reserved.
--   npx wrangler d1 execute last-orbit --remote --file migrations/004_reserved.sql   (from api/, once)
CREATE TABLE IF NOT EXISTS reserved (nkey TEXT PRIMARY KEY, pid TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '');
INSERT OR IGNORE INTO reserved (nkey, pid, note) VALUES ('dev', '', 'staff'), ('admin', '', 'staff'), ('mod', '', 'staff'), ('moderator', '', 'staff'), ('orbit', '', 'the station AI');
