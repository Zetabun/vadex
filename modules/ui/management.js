// Shared management-mode rules. UI layout and the simulation loop both read these
// so tactical slowdown and reserved battlefield space cannot drift apart.
export const TACTICAL_TIME_SCALE = 0.30;
export const MANAGEMENT_BATTLE_SHARE = 0.30;
export const MANAGEMENT_PANEL_SHARE = 0.56;

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
 * Between-wave Command Phase fills the viewport above the navigation bar.
 * The battlefield and HUD are hidden while the intermission is deliberately paused.
 */
export function commandPanelHeight(viewHeight, hudHeight, navHeight) {
  const h = Math.max(1, Number(viewHeight) || 1);
  const nav = Math.max(0, Number(navHeight) || 0);
  return Math.max(88, h - nav);
}

/** Smoothly enter tactical time and ease back to full speed when management closes. */
export function approachManagementScale(current, managementOpen, dt) {
  const target = managementOpen ? TACTICAL_TIME_SCALE : 1;
  const tau = managementOpen ? 0.055 : 0.12;
  const step = 1 - Math.exp(-Math.max(0, dt) / tau);
  const next = current + (target - current) * step;
  return Math.abs(next - target) < 0.001 ? target : next;
}
