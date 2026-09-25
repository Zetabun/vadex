// Haptic taps. Android browsers have navigator.vibrate. iPhone Safari has no vibration API, but from iOS 18 a click on
// the label of a switch-style checkbox plays the system's light haptic, so a hidden one stands in there (a no-op on
// older iOS). Rate-limited, and off when the Vibration setting is.
import { G } from '@last-orbit/core/game.js';

const PATTERN = { tick: 7, thud: 24, launch: [30, 40, 18], hit: 45 };
let label = null, lastT = 0;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** kind: 'tick' (a gun firing), 'thud' (a reload), 'launch' (a missile away), 'hit' (the station struck). */
export function haptic(kind = 'tick') {
  if (G.state?.settings?.haptics === false || typeof document === 'undefined') return;
  const now = performance.now(), gap = kind === 'tick' ? (canVibrate ? 110 : 240) : 90; if (now - lastT < gap) return; lastT = now;
  try { if (canVibrate) { navigator.vibrate(PATTERN[kind] ?? 10); return; } } catch { /* not allowed here */ }
  try {
    if (!label) {
      const box = document.createElement('div'), input = document.createElement('input'); box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      input.type = 'checkbox'; input.setAttribute('switch', ''); input.id = 'lo-haptic'; input.tabIndex = -1; label = document.createElement('label'); label.htmlFor = 'lo-haptic';
      box.append(input, label); document.body.append(box);
    }
    label.click();
  } catch { /* no haptics on this device */ }
}
