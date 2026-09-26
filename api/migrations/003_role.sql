-- v2.24: a role shown beside a pilot's name on the boards ('dev', 'mod'), set only with api/admin.mjs role.
--   npx wrangler d1 execute last-orbit --remote --file migrations/003_role.sql   (from api/, once)
ALTER TABLE players ADD COLUMN role TEXT NOT NULL DEFAULT '';
