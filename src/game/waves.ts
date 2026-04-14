/**
 * waves.ts — Wave & Enemy Design File
 *
 * This is the single place to tune enemy composition, stats, and spawn pacing.
 * No probability math needed: just set relative weights per enemy type and the
 * engine resolves them automatically. Weights don't need to sum to any specific
 * number — they're relative to each other.
 *
 * QUICK REFERENCE
 * ───────────────
 * Enemy types: 'normal' | 'speedy' | 'tanker' | 'ranged' | 'tracer' | 'boss' | 'abnormal'
 *
 * To add a new named wave:   push a new entry into WAVE_DEFS
 * To change wave 3's mix:    edit WAVE_DEFS[3].weights
 * To change late-game mix:   edit DEFAULT_WAVE.weights
 * To change spawn speed:     edit SPAWN.*
 * To change base enemy HP:   edit ENEMY_BASE_STATS.*
 * To change enemy move speed: edit ENEMY_STATS[type].interval
 * To change boss burst:      edit BOSS_BURST_MOVES
 */

import type { EnemyType } from './types';

// ── Enemy stats ───────────────────────────────────────────────────────────────
// hp:       wave-0 baseline (actual HP = hp + wave scaling for bosses)
// exp:      XP awarded on kill
// interval: ticks between move steps (1 = every tick, 2 = every other tick)

export const ENEMY_STATS: Record<EnemyType, { hp: number; exp: number; interval: number }> = {
  normal:   { hp: 1, exp: 1,  interval: 2 },
  speedy:   { hp: 1, exp: 2,  interval: 1 },
  tanker:   { hp: 3, exp: 3,  interval: 2 },
  ranged:   { hp: 1, exp: 2,  interval: 2 },
  tracer:   { hp: 1, exp: 3,  interval: 1 },
  boss:     { hp: 4, exp: 10, interval: 2 },
  abnormal: { hp: 7, exp: 5,  interval: 2 },
  assassin: { hp: 5, exp: 4,  interval: 1 },
  shocker:  { hp: 7, exp: 4,  interval: 2 },
};

// Boss HP scales with wave number: BOSS_HP_SCALE * wave added on top of base HP
export const BOSS_HP_SCALE = 4;

// Boss level 4+ burst pattern: moves this many steps in a row, then pauses for 1 tick.
export const BOSS_BURST_MOVES = 3;

// Chance for any enemy to spawn with a shield that absorbs one hit.
export const ENEMY_SHIELD_CHANCE = 0.08;

// ── Spawn timing ─────────────────────────────────────────────────────────────

export const SPAWN = {
  baseInterval:      4,   // ticks between normal spawns at tick 0
  minInterval:       1,   // spawn interval floor (never faster than this)
  intervalDecayRate: 80,  // interval drops by 1 every N ticks
  waveLength:        80,  // ticks per wave
  bossEvery:         160, // a boss spawns every N ticks
  bossFire:          2,   // ticks between boss projectile shots
  rangedFire:        4,   // ticks between ranged enemy shots
  bossTraceDuration: 10,   // ticks a tracer/boss trace tile persists
  projectileLifespan: 10, // ticks a projectile travels before disappearing
};

// ── Wave definitions ─────────────────────────────────────────────────────────
// WAVE_DEFS[n] applies when Math.floor(tick / SPAWN.waveLength) === n.
// Omitting a type is the same as giving it weight 0.
// Add or remove entries freely — the default wave kicks in for any index >= WAVE_DEFS.length.

export interface WaveDef {
  weights: Partial<Record<EnemyType, number>>;
}

export const WAVE_DEFS: WaveDef[] = [
  { weights: { normal: 45, speedy: 30, tanker: 25 } },
  // Wave 3 — ranged enemies arrive
  { weights: { normal: 32, speedy: 30, tanker: 18, ranged: 20 } },
  // Wave 4 — tanker-heavy push
  { weights: { normal: 25, speedy: 15, tanker: 35, ranged: 15, tracer: 10 } },
  // Wave 5 — ranged-heavy push
  { weights: { normal: 30, speedy: 15, tanker: 15, ranged: 25, tracer: 15 } },
  // Wave 6 — speedy swarm
  { weights: { normal: 20, speedy: 30, tanker: 25, ranged: 10, tracer: 15 } },
  // Wave 7 — tracer-heavy push (tracers are fast but fragile, so a good warmup for the boss)
  { weights: { normal: 20, speedy: 10, tanker: 0, ranged: 10, tracer: 70 } },
  // Wave 8 — abnormal arrives
  { weights: { normal: 20, speedy: 15, tanker: 15, ranged: 15, tracer: 10, abnormal: 25 } },
  // Wave 9 — abnormal-heavy push
  { weights: { normal: 18, speedy: 12, tanker: 12, ranged: 12, tracer: 10, abnormal: 36 } },
  // Wave 10 — all-rounder chaos
  { weights: { normal: 15, speedy: 10, tanker: 12, ranged: 12, tracer: 8, abnormal: 28 } },

];

// Wave 11+ — all types, balanced chaos (applies when wave >= WAVE_DEFS.length)
export const DEFAULT_WAVE: WaveDef = {
  weights: { normal: 10, speedy: 10, tanker: 15, ranged: 12, tracer: 10, abnormal: 22 },
};

// ── Helpers (used by engine.ts — no need to edit these) ─────────────────────

/** Returns the WaveDef for the given wave number. */
export function getWaveDef(wave: number): WaveDef {
  return wave < WAVE_DEFS.length ? WAVE_DEFS[wave] : DEFAULT_WAVE;
}

/** Picks a random enemy type according to the weighted mix for this wave. */
export function pickEnemyType(wave: number): EnemyType {
  const def = getWaveDef(wave);
  const entries = Object.entries(def.weights) as [EnemyType, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  // Fallback (floating-point edge case)
  return entries[entries.length - 1][0];
}


/** Returns ticks between spawns at a given tick. */
export function getSpawnInterval(tick: number): number {
  return Math.max(
    SPAWN.minInterval,
    SPAWN.baseInterval - Math.floor(tick / SPAWN.intervalDecayRate),
  );
}
