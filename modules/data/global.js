// The global boards: pilots' scores from every device, kept by a small server of their own (api/, a Cloudflare Worker
// deployed apart from the game). What the game needs to know of it: where it is, which boards there are to look at,
// and how patient to be. progression/global.js posts and fetches; the Records tab shows them (ui/hangar.js).
export const API = 'https://last-orbit-api.adambullas.workers.dev';
export const BOARD_TTL = 90e3; // a board fetched in the last minute and a half is shown again without asking
export const TIMEOUT = 8000; // a request that takes longer is given up on (and a post waits for the next try)
export const RETRY_MS = 120e3; // posts still waiting are tried again this often while in the hangar
export const POST_GAP = 3200; // the server takes one post every few seconds from a pilot
export const PENDING_MAX = 6; // posts kept waiting at most (the oldest go first)
export const TOP_SHOWN = 50;
/** The boards to look at in Records: today's and yesterday's Daily Sortie, and every pilot's best. */
export const BOARD_TABS = [
  { id: 'today', name: 'Today\'s Daily', empty: 'Nobody has posted today\'s Daily yet. Fly it and be first on the board.' },
  { id: 'yday', name: 'Yesterday', empty: 'Nobody posted yesterday\'s Daily.' },
  { id: 'all', name: 'All-time', empty: 'The board is empty. Your best sortie goes up with your next post.' },
];
export const dailyBoard = (key) => 'daily:' + key;
