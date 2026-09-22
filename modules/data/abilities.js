// Active abilities. cd seconds, dur seconds, power scales with abilityPower stat. unlock: best wave this run (or ever, once seen).
export const ABILITIES = {
  overdrive: { name: 'Overdrive', icon: '⚡', cd: 40, dur: 8, unlock: 6, color: '#ffb547', desc: 'Fire rate ×2 for 8s. Uses up to 10 Energy/s to slow its duration drain by 50%; at 0 Energy it continues normally.', tag: 'offence' },
  emp: { name: 'EMP', icon: '◎', cd: 45, dur: 3, unlock: 12, color: '#5ee6ff', desc: 'Wipes enemy bullets and stuns everything for 3s.', tag: 'defence' },
  barrage: { name: 'Missile barrage', icon: '⟰', cd: 50, dur: 0, unlock: 18, color: '#ff8a3d', desc: 'Launches 14 heavy homing missiles.', tag: 'offence' },
  aegis: { name: 'Hard shield', icon: '⬡', cd: 60, dur: 5, unlock: 26, color: '#7aa2ff', desc: 'Invulnerable for 5s.', tag: 'defence' },
  strike: { name: 'Orbital strike', icon: '✸', cd: 70, dur: 0, unlock: 40, color: '#ff4d7a', desc: 'Calls a lance down on the toughest enemy: 60× weapon damage. Always hits weak points.', tag: 'boss' },
  slow: { name: 'Time dilation', icon: '◴', cd: 60, dur: 6, unlock: 60, color: '#b69cff', desc: 'Enemies and their bullets move at 35% speed for 6s.', tag: 'defence' },
  swarm: { name: 'Drone swarm', icon: '⁂', cd: 80, dur: 12, unlock: 95, color: '#66ffc2', desc: 'Six temporary attack drones for 12s.', tag: 'drone' },
  hole: { name: 'Black hole', icon: '●', cd: 90, dur: 5, unlock: 150, color: '#c77dff', desc: 'Drags enemies together and crushes them for 5s. Made for splash builds.', tag: 'offence' },
  charge: { name: 'Weapon overcharge', icon: '✦', cd: 55, dur: 0, unlock: 210, color: '#ffe066', desc: 'Your next 12 volleys deal ×6 damage and always crit.', tag: 'boss' },
};
export const ABILITY_ORDER = ['overdrive', 'emp', 'barrage', 'aegis', 'strike', 'slow', 'swarm', 'hole', 'charge'];
export const AUTO_CONDITIONS = [['never', 'Never'], ['ready', 'Whenever ready'], ['boss', 'During bosses'], ['crowd', '15+ enemies alive'], ['hurt', 'Hull below 40%'], ['elite', 'Elite or boss present']];
