-- Last Orbit's global boards (api/src/index.js). Safe to run again: nothing is dropped.
--   npx wrangler d1 execute last-orbit --remote --file schema.sql   (from api/; --local for wrangler dev)
-- players: one row per device id; name and station are the latest posted (unless locked: reset by api/admin.mjs rename).
-- tag: four characters the server gives them, never shared by two pilots under one name (nkey: the name in lower case).
-- rank: their pilot rank, shown as their badge (0: not known yet). Added in v2.24: api/migrations/002_rank.sql.
-- role: 'dev' or 'mod', shown beside their name; set only with api/admin.mjs role. Added in v2.24: 003_role.sql.
-- banned: their posts are taken and dropped.
CREATE TABLE IF NOT EXISTS players (
  pid TEXT PRIMARY KEY, name TEXT NOT NULL, station TEXT NOT NULL DEFAULT '',
  first INTEGER NOT NULL, last INTEGER NOT NULL, posts INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, v TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '', nkey TEXT NOT NULL DEFAULT '', rank INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT ''
);
-- finding who else goes by a name (to keep tags apart) without reading every pilot
CREATE INDEX IF NOT EXISTS players_name ON players (nkey, tag);
-- scores: a pilot's entry on a board ('all' keeps the best, a daily keeps the first).
CREATE TABLE IF NOT EXISTS scores (
  board TEXT NOT NULL, pid TEXT NOT NULL, score INTEGER NOT NULL, wave INTEGER NOT NULL, ship TEXT NOT NULL,
  threat INTEGER NOT NULL DEFAULT 0, warp INTEGER NOT NULL DEFAULT 1, level INTEGER NOT NULL DEFAULT 1, kills INTEGER NOT NULL DEFAULT 0,
  time INTEGER, mutator TEXT, at INTEGER NOT NULL,
  PRIMARY KEY (board, pid)
);
-- reading a board's top, and counting who is above a pilot, walk this index instead of the whole table
CREATE INDEX IF NOT EXISTS scores_rank ON scores (board, score DESC, at);
-- boards: how many pilots are on each (kept as a count, so it is not counted row by row on every view)
CREATE TABLE IF NOT EXISTS boards (board TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
-- days: who used the boards on each UTC day (how many people play; api/admin.mjs stats)
CREATE TABLE IF NOT EXISTS days (day TEXT NOT NULL, pid TEXT NOT NULL, PRIMARY KEY (day, pid));
