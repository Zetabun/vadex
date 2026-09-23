import assert from 'node:assert/strict';
import { Big } from '@last-orbit/core/big.js';
import { weaponReadout, loadoutDps } from '@last-orbit/ui/weapon-readout.js';
import { commandPanelHeight, managementPanelHeight } from '@last-orbit/ui/management.js';
import { xpForLevel, levelBonuses } from '@last-orbit/data/experience.js';
import { skillPointsEarned } from '@last-orbit/data/skills.js';

const cannon = { dmg: Big.from(100), rate: 2, proj: 2, critChance: .25, critMult: 2 };
const beam = { dmg: Big.from(50), rate: 1, proj: 1, critChance: 0, critMult: 2 };
assert.equal(weaponReadout(cannon).dps.toNumber(), 500);
assert.equal(loadoutDps(['cannon', 'beam'], { cannon, beam }).toNumber(), 550);
assert.equal(loadoutDps(['cannon', '', null], { cannon }).toNumber(), 500);
assert.equal(commandPanelHeight(800, 100, 72), 728);
assert.ok(managementPanelHeight(800, 100, 72) < commandPanelHeight(800, 100, 72));
assert.equal(xpForLevel(1), 0);
assert.equal(skillPointsEarned(3), 1);
assert.equal(skillPointsEarned(4), 1);
assert.equal(levelBonuses(3).damage, 1.016);
console.log('Weapon readout, command layout and XP milestones pass.');
