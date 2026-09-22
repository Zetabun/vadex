// Shared management-mode rules. UI layout and the simulation loop both read these
// so tactical slowdown and reserved battlefield space cannot drift apart.
export const TACTICAL_TIME_SCALE = 0.30;
export const MANAGEMENT_BATTLE_SHARE = 0.30;
export const MANAGEMENT_PANEL_SHARE = 0.56;
export const COMMAND_PANEL_SHARE = 0.86;

/** True when an open management panel is being used during a deliberately paused safe intermission. */
export function commandPhaseActive(managementOpen, wave) {
  return !!managementOpen && wave?.state === 'cleared' && !!wave.intermission && !!wave.intermissionPaused;
}

/**
 * Height available to the scrolling management panel while preserving the live battlefield.
 * `chromeHeight` is the compact status strip + navigation (everything below the panel).
 */
export function managementPanelHeight(viewHeight, hudHeight, chromeHeight) {
  const h = Math.max(1, Number(viewHeight) || 1);
  const top = Math.max(0, Number(hudHeight) || 0);
  const chrome = Math.max(0, Number(chromeHeight) || 0);
  const reserve = h * MANAGEMENT_BATTLE_SHARE;
  const room = h - top - chrome - reserve;
  return Math.max(88, Math.min(h * MANAGEMENT_PANEL_SHARE, room));
}

/**
 * Expanded between-wave Command Phase. It intentionally gives management nearly all
 * remaining room because there is no live threat to monitor. The HUD and navigation stay
 * visible, with only a small sliver of the battlefield/background left above the panel.
 */
export function commandPanelHeight(viewHeight, hudHeight, navHeight) {
  const h = Math.max(1, Number(viewHeight) || 1);
  const top = Math.max(0, Number(hudHeight) || 0);
  const nav = Math.max(0, Number(navHeight) || 0);
  const room = Math.max(88, h - top - nav - 10);
  return Math.max(88, Math.min(h * COMMAND_PANEL_SHARE, room));
}

/** Smoothly enter tactical time and ease back to full speed when management closes. */
export function approachManagementScale(current, managementOpen, dt) {
  const target = managementOpen ? TACTICAL_TIME_SCALE : 1;
  const tau = managementOpen ? 0.055 : 0.12;
  const step = 1 - Math.exp(-Math.max(0, dt) / tau);
  const next = current + (target - current) * step;
  return Math.abs(next - target) < 0.001 ? target : next;
}
