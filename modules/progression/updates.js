// What's new: whether this pilot has an update to hear about (the red "!" on the settings gear) and marking it heard
// (opening Settings > Updates). The history itself is modules/data/updates.js, built from CHANGELOG.md.
// The build's version comes from the import map's ?v= stamp (tools/build_importmap.py): '2.24.0', or '2.24.0-u1' for
// a preview (its suffix dropped here), or nothing in Node.
export const VERSION = (import.meta.url.split('?v=')[1] || '').split('&')[0];
export const RELEASE = VERSION.replace(/-.*/, '');

/** Compare versions such as '2.24.0': negative when a is older, 0 when the same, positive when newer. */
export function cmpVersion(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
/** Whether there is an update this pilot has not looked at. A brand-new pilot starts up to date (it is all new to
 *  them); a pilot from before this was tracked hears about the build they have now. */
export function updatesUnseen(st, release = RELEASE) {
  if (!release) return false;
  const m = st.meta; if (!m.seenUpdate) { if (!(st.stats?.sorties > 0)) { m.seenUpdate = release; return false; } return true; }
  return cmpVersion(release, m.seenUpdate) > 0;
}
/** The pilot has seen the Updates tab: returns the version they had seen before (to mark what is new to them). */
export function markUpdatesSeen(st, release = RELEASE) { const was = st.meta.seenUpdate || ''; if (release) st.meta.seenUpdate = release; return was; }
