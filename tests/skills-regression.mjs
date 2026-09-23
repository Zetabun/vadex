import assert from 'node:assert/strict';
import { Big } from '@last-orbit/core/big.js';
import { G, recalc } from '@last-orbit/core/game.js';
import { newState, SCHEMA } from '@last-orbit/core/state.js';
import { xpForLevel } from '@last-orbit/data/experience.js';
import { buySkill, respecSkills, skillPoints, skillRank } from '@last-orbit/progression/skills.js';
import { hitEnemy } from '@last-orbit/combat/world.js';
import { parseSave } from '@last-orbit/save/save.js';

G.state = newState();
G.state.settings.dmgNumbers = false;
G.state.unlocks.skills = Date.now();
G.state.run.xp = xpForLevel(19); // Nine points to test branch prerequisites and effects.
recalc();
assert.equal(skillPoints(), 9);
assert.equal(buySkill('calibration'), false, 'entry perks wait for Wave 8');
G.state.run.best = 8;
assert.equal(buySkill('rapid'), false, 'second tier waits for Wave 12');
G.state.run.best = 20;
assert.equal(buySkill('siphon'), false, 'deep perks need their prerequisites');
assert.equal(buySkill('plating'), true);
assert.equal(buySkill('plating'), true);
assert.equal(buySkill('repair'), true);
assert.equal(buySkill('repair'), true);
assert.equal(buySkill('siphon'), true);
assert.equal(skillRank('siphon'), 1);
assert.equal(skillPoints(), 4);
assert.ok(G.sheet.n('lifeSteal') > 0);

const enemy = { alive: true, invuln: false, hp: 1, hpMax: Big.from(100), armour: 0, shielded: false, weakOpen: false, boss: null, parent: null, elite: null, x: 0, y: 0 };
const world = { player: { alive: true, hull: 0.5, leechBudget: 0.08, focus: 0, energy: 0 }, foundryBurst: 0, painted: null, acc: {}, wave: {} };
hitEnemy(world, enemy, { id: 'test', dmg: Big.from(10), critChance: 0, critMult: 1 }, 1, 0, 0, true);
assert.ok(world.player.hull > 0.5 && world.player.hull < 0.51, 'lifesteal heals a bounded amount from actual damage');
assert.equal(respecSkills(), true);
assert.equal(skillPoints(), 9);
assert.equal(G.sheet.n('lifeSteal'), 0);

const old = newState(); old.v = 12; old.run.skills = undefined; old.onboarding.step = 9;
const migrated = parseSave(JSON.stringify(old));
assert.equal(migrated.v, SCHEMA);
assert.deepEqual(migrated.run.skills, {});
assert.equal(migrated.onboarding.step, 10, 'an active old lesson keeps its place after Skills is inserted');
console.log('Skill progression, lifesteal, reset and save migration pass.');
