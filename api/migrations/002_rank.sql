-- v2.24: each pilot's rank, for the badge beside their name on the boards (0 until they next post or look).
--   npx wrangler d1 execute last-orbit --remote --file migrations/002_rank.sql   (from api/, once)
ALTER TABLE players ADD COLUMN rank INTEGER NOT NULL DEFAULT 0;
