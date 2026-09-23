import assert from 'node:assert/strict';
import { Big } from '@last-orbit/core/big.js';
import { G, recalc } from '@last-orbit/core/game.js';
import { newState } from '@last-orbit/core/state.js';
import { UPGRADES } from '@last-orbit/data/upgrades.js';
import { buyUpgrade, upgradeVisible } from '@last-orbit/progression/economy.js';
import { createWorld, setWaveBase, hurtPlayer, spawnEnemy, killEnemy } from '@last-orbit/combat/world.js';

G.state = newState();
G.state.cur.credits = Big.from(1000);
recalc();
const shield = UPGRADES.find((d) => d.id === 'shield');
const recharge = UPGRADES.find((d) => d.id === 'srech');
G.state.stats.bestWave = 2;
assert.equal(upgradeVisible(shield), false);
G.state.stats.bestWave = 3;
assert.equal(upgradeVisible(shield), true);
assert.equal(upgradeVisible(recharge), false);
assert.equal(buyUpgrade('shield', 1, true), 1);
assert.equal(G.sheet.n('shieldRatio'), 0.12);
const firstCapacity = G.sheet.b('hull').mul(G.sheet.n('shieldRatio'));

const w = G.world = createWorld();
w.wave.num = 3; w.wave.state = 'fighting';
setWaveBase(w, 3, 0);
assert.equal(w.base.hasShield, true);
hurtPlayer(w, 0.1, null);
assert.ok(w.player.shield < 1 && w.player.shield > 0, 'early shield absorbs a small hit');
assert.equal(w.player.hull, 1, 'hull remains untouched while the shield holds');
assert.equal(buyUpgrade('shield', 1, true), 1);
assert.ok(G.sheet.b('hull').mul(G.sheet.n('shieldRatio')).gt(firstCapacity), 'more shield levels increase capacity');
G.state.stats.bestWave = 6;
assert.equal(upgradeVisible(recharge), true);

G.state.unlocks.arsenal = Date.now();
G.state.run.upgrades.scrapc = 1;
recalc(); setWaveBase(w, 4, 0); w.wave.num = 4;
const enemy = spawnEnemy(w, 'grunt', 0, 90);
enemy.elite = { color: 0xffb547 }; // Elite kills always drop Scrap.
const before = G.state.cur.scrap;
killEnemy(w, enemy, null);
const drop = w.fx.find((event) => event.k === 'salvageDrop');
assert.ok(drop, 'a paid Scrap drop sends its amount to the collector visual');
assert.equal(drop.c.toString(), G.state.cur.scrap.sub(before).toString(), 'visual amount matches the immediate payout');
console.log('Early shield capacity, absorption, recharge timing and Scrap collector payout pass.');
