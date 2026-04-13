import {
  GameState, Player, Enemy, Direction, Position,
  DamageNumber, ItemType, EnemyType, Projectile, Trace
} from './types';
import { pickRandomSkills, getExpThresholds } from './skills';
import {
  ENEMY_STATS, SPAWN, BOSS_HP_SCALE, BOSS_BURST_MOVES, ENEMY_SHIELD_CHANCE,
  pickEnemyType, getSpawnInterval,
} from './waves';

const VIEWPORT_HALF = 7;
const SPAWN_MARGIN = 1;

export function createInitialState(): GameState {
  return {
    phase: 'start',
    player: createPlayer(),
    enemies: [],
    projectiles: [],
    items: [],
    tick: 0,
    kills: 0,
    startTime: 0,
    elapsedTime: 0,
    pendingSkills: [],
    selectedSkillIds: [],
    lastScore: getLastScore(),
    bestScore: getBestScore(),
    nextEnemyId: 1,
    nextItemId: 1,
    nextDmgId: 1,
    nextProjectileId: 1,
    damageNumbers: [],
    hitFlash: false,
    hitFlashTick: 0,
    traces: [],
    nextTraceId: 1,
    bossesSpawned: 0,
    tilesWalked: 0,
    shockerPositions: [],
  };
}

function createPlayer(): Player {
  return {
    pos: { x: 0, y: 0 },
    lastDir: null,
    hp: 3,
    maxHp: 3,
    attack: 1,
    exp: 0,
    level: 1,
    expThresholds: getExpThresholds(50),
    attackTargets: 1,
    attackRange: 3,
    piercing: false,
    bulletCount: 0,
    expMultiplier: 1,
    dropRateBonus: 0,
    counterAttack: false,
    chainAttack: 0,
    hasRevive: false,
    shieldActive: false,
    attackBoostCharges: 0,
    regenChance: 0,
  };
}

function getLastScore(): number {
  try { return parseInt(localStorage.getItem('gridRogue_lastScore') || '0'); } catch { return 0; }
}
function getBestScore(): number {
  try { return parseInt(localStorage.getItem('gridRogue_bestScore') || '0'); } catch { return 0; }
}

export function startGame(state: GameState): GameState {
  return {
    ...createInitialState(),
    phase: 'playing',
    lastScore: state.lastScore,
    bestScore: state.bestScore,
    startTime: Date.now(),
  };
}

export function calcScore(state: { tilesWalked: number; player: { exp: number } }): number {
  return state.tilesWalked + state.player.exp;
}

function manDist(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Returns all 4 tiles occupied by a 2×2 abnormal enemy (top-left corner = pos). */
export function abnormalTiles(pos: Position): Position[] {
  return [pos, { x: pos.x + 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x + 1, y: pos.y + 1 }];
}

function isTileBlockedByAbnormal(pos: Position, enemies: Enemy[], excludeId?: number): boolean {
  return enemies.some(e =>
    e.type === 'abnormal' && e.id !== excludeId &&
    abnormalTiles(e.pos).some(t => posEq(t, pos))
  );
}

function abnormalFootprintFree(topLeft: Position, enemies: Enemy[], excludeId?: number): boolean {
  return abnormalTiles(topLeft).every(t =>
    !enemies.some(e => e.id !== excludeId && (posEq(e.pos, t) || isTileBlockedByAbnormal(t, enemies, excludeId)))
  );
}

function isOccupiedByEnemy(pos: Position, enemies: Enemy[], excludeId?: number): boolean {
  return enemies.some(e => e.id !== excludeId && posEq(e.pos, pos))
      || isTileBlockedByAbnormal(pos, enemies, excludeId);
}

function playerMovingToward(player: Player, enemy: Enemy): boolean {
  if (!player.lastDir) return false;
  // Only stay when adjacent — enemy's next step would land on the player's tile
  if (manDist(player.pos, enemy.pos) !== 1) return false;
  const dx = enemy.pos.x - player.pos.x;
  const dy = enemy.pos.y - player.pos.y;
  const dominant = Math.abs(dx) >= Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
  return dominant === player.lastDir;
}

function moveEnemyTowardPlayer(enemy: Enemy, player: Player, enemies: Enemy[]): Position {
  if (playerMovingToward(player, enemy)) return enemy.pos;

  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;

  const moves: Position[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
    if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
  } else {
    if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
    if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
  }

  // Strictly perpendicular slides — never retreat toward/away from player
  const perp: Position[] = Math.abs(dx) >= Math.abs(dy)
    ? [{ x: enemy.pos.x, y: enemy.pos.y + 1 }, { x: enemy.pos.x, y: enemy.pos.y - 1 }]
    : [{ x: enemy.pos.x + 1, y: enemy.pos.y }, { x: enemy.pos.x - 1, y: enemy.pos.y }];

  if (manDist(player.pos, enemy.pos) === 1) {moves.length = 0; perp.length = 0;} // Don't move if already adjacent — wait for player to come to us


  for (const move of [...moves, ...perp]) {
    if (!posEq(move, player.pos) && !isOccupiedByEnemy(move, enemies, enemy.id)) return move;
  }
  return enemy.pos;
}

function moveRangedEnemy(enemy: Enemy, player: Player, enemies: Enemy[]): Position {
  const dist = manDist(enemy.pos, player.pos);
  // Retreat if too close, approach if too far, hover at 4 tiles
  if (dist < 3) {
    // Move away from player
    const dx = enemy.pos.x - player.pos.x;
    const dy = enemy.pos.y - player.pos.y;
    const moves: Position[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
      if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
    } else {
      if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
      if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
    }
    for (const m of moves) {
      if (!posEq(m, player.pos) && !isOccupiedByEnemy(m, enemies, enemy.id)) return m;
    }
    return enemy.pos;
  }
  if (dist > 5) {
    if (playerMovingToward(player, enemy)) return enemy.pos;
    return moveEnemyTowardPlayer(enemy, player, enemies);
  }
  return enemy.pos; // hover
}

function moveAbnormalTowardPlayer(enemy: Enemy, player: Player, enemies: Enemy[]): Position {
  // Adjacent if any of the 4 tiles is within manDist 1 of player
  const alreadyAdj = abnormalTiles(enemy.pos).some(t => manDist(t, player.pos) <= 1);
  if (alreadyAdj) return enemy.pos;

  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;

  const moves: Position[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
    if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
  } else {
    if (dy !== 0) moves.push({ x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) });
    if (dx !== 0) moves.push({ x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y });
  }

  const perp: Position[] = Math.abs(dx) >= Math.abs(dy)
    ? [{ x: enemy.pos.x, y: enemy.pos.y + 1 }, { x: enemy.pos.x, y: enemy.pos.y - 1 }]
    : [{ x: enemy.pos.x + 1, y: enemy.pos.y }, { x: enemy.pos.x - 1, y: enemy.pos.y }];

  for (const move of [...moves, ...perp]) {
    if (!posEq(move, player.pos) && abnormalFootprintFree(move, enemies, enemy.id)) return move;
  }
  return enemy.pos;
}

function edgeSpawnPos(px: number, py: number): Position {
  const vp = VIEWPORT_HALF + SPAWN_MARGIN;
  const spread = rng(2 * vp + 1) - vp;
  switch (Math.floor(Math.random() * 4)) {
    case 0: return { x: px + spread, y: py - vp };
    case 1: return { x: px + spread, y: py + vp };
    case 2: return { x: px - vp, y: py + spread };
    default: return { x: px + vp, y: py + spread };
  }
}

function dirSpawnPos(px: number, py: number, dir: Direction): Position {
  const vp = VIEWPORT_HALF + SPAWN_MARGIN;
  const spread = rng(2 * vp + 1) - vp;
  switch (dir) {
    case 'up':    return { x: px + spread, y: py - vp };
    case 'down':  return { x: px + spread, y: py + vp };
    case 'left':  return { x: px - vp, y: py + spread };
    case 'right': return { x: px + vp, y: py + spread };
  }
}

function spawnEnemy(state: GameState, forceType?: EnemyType): GameState {
  const { pos: { x: px, y: py } } = state.player;
  const spawnPos = edgeSpawnPos(px, py);
  const wave = Math.floor(state.tick / SPAWN.waveLength);
  const type = forceType ?? pickEnemyType(wave);
  if (type === 'abnormal') {
    if (!abnormalFootprintFree(spawnPos, state.enemies)) return state;
  } else {
    if (isOccupiedByEnemy(spawnPos, state.enemies)) return state;
  }
  const bossLevel = type === 'boss' ? state.bossesSpawned + 1 : undefined;
  const enemy = buildEnemy(state.nextEnemyId, spawnPos, type, wave, bossLevel);
  const bossesSpawned = type === 'boss' ? state.bossesSpawned + 1 : state.bossesSpawned;
  return { ...state, enemies: [...state.enemies, enemy], nextEnemyId: state.nextEnemyId + 1, bossesSpawned };
}

function spawnEnemyInDirection(state: GameState, dir: Direction): GameState {
  const { pos: { x: px, y: py } } = state.player;
  const spawnPos = dirSpawnPos(px, py, dir);
  if (isOccupiedByEnemy(spawnPos, state.enemies)) return state;
  const wave = Math.floor(state.tick / SPAWN.waveLength);
  const enemy = buildEnemy(state.nextEnemyId, spawnPos, pickEnemyType(wave), wave);
  return { ...state, enemies: [...state.enemies, enemy], nextEnemyId: state.nextEnemyId + 1 };
}

function rng(n: number): number { return Math.floor(Math.random() * n); }

// ── Shared helpers ───────────────────────────────────────────────────────────

const ITEM_TYPES: ItemType[] = ['hp_potion', 'attack_boost', 'magnet', 'shield'];

function mkDmg(
  id: number, pos: Position, value: number, tick: number,
  isPlayer: boolean, extra?: Partial<DamageNumber>
): DamageNumber {
  return { id, worldX: pos.x, worldY: pos.y, value, tick, isPlayer, ...extra };
}

function tryDrop(pos: Position, dropChance: number, nextItemId: number) {
  if (Math.random() >= dropChance) return null;
  return { id: nextItemId, pos: { ...pos }, type: ITEM_TYPES[rng(ITEM_TYPES.length)] };
}

function buildEnemy(id: number, pos: Position, type: EnemyType, wave: number, bossLevel?: number): Enemy {
  const stats = ENEMY_STATS[type];
  const hp = stats.hp + (type === 'boss' ? wave * BOSS_HP_SCALE : 0);
  const exp = type === 'boss' ? hp * 2 : stats.exp;
  const burstMovesLeft = (type === 'boss' && (bossLevel ?? 1) >= 4) ? BOSS_BURST_MOVES : undefined;
  const shield = Math.random() < ENEMY_SHIELD_CHANCE ? true : undefined;
  return {
    id, pos, hp, maxHp: hp, exp, type, fireCooldown: 0, bossLevel, burstMovesLeft,
    hidden: type === 'assassin' ? false : undefined,
    assassinMoves: type === 'assassin' ? 2 : undefined,
    size: type === 'abnormal' ? 2 : undefined,
    shield,
  };
}

// ── Ranged: fire projectile toward player ────────────────────────────────────
function fireProjectile(enemy: Enemy, player: Player, state: GameState): { projectiles: Projectile[]; nextId: number } {
  const dx = Math.sign(player.pos.x - enemy.pos.x);
  const dy = Math.sign(player.pos.y - enemy.pos.y);
  // Fire along dominant axis only (cardinal direction)
  const proj: Projectile = {
    id: state.nextProjectileId,
    pos: { ...enemy.pos },
    dx: Math.abs(player.pos.x - enemy.pos.x) >= Math.abs(player.pos.y - enemy.pos.y) ? dx : 0,
    dy: Math.abs(player.pos.x - enemy.pos.x) >= Math.abs(player.pos.y - enemy.pos.y) ? 0 : dy,
    ticksLeft: SPAWN.projectileLifespan,
    fromBoss: enemy.type === 'boss',
  };
  return {
    projectiles: [...state.projectiles, proj],
    nextId: state.nextProjectileId + 1,
  };
}

// ── Main tick ────────────────────────────────────────────────────────────────
export function processTick(state: GameState, dir: Direction): GameState {
  if (state.phase !== 'playing') return state;
  if (state.player.hp <= 0) return { ...state, phase: 'game_over' };

  let s = { ...state, tick: state.tick + 1, elapsedTime: Date.now() - state.startTime };

  // Move player — blocked if an enemy occupies the target tile
  const targetPos = moveInDir(s.player.pos, dir);
  const blocked = isOccupiedByEnemy(targetPos, s.enemies);
  s = { ...s, player: { ...s.player, pos: blocked ? s.player.pos : targetPos, lastDir: dir }, tilesWalked: s.tilesWalked + (blocked ? 0 : 1) };

  // Repeated direction → spawn an enemy in that direction
  if (state.player.lastDir === dir) s = spawnEnemyInDirection(s, dir);

  // Regen
  if (s.player.regenChance > 0 && Math.random() < s.player.regenChance && s.player.hp < s.player.maxHp) {
    s = { ...s, player: { ...s.player, hp: s.player.hp + 1 } };
  }

  // Pick up items
  s = pickUpItems(s);

  // ── Trace decay & damage ────────────────────────────────────────────────
  {
    const decayed = s.traces
      .map(t => ({ ...t, ticksLeft: t.ticksLeft - 1 }))
      .filter(t => t.ticksLeft > 0);
    const onTrace = decayed.find(t => posEq(t.pos, s.player.pos));
    if (onTrace) {
      s = {
        ...s,
        traces: decayed,
        player: { ...s.player, hp: s.player.hp - 1 },
        hitFlash: true,
        hitFlashTick: s.tick,
        damageNumbers: [...s.damageNumbers, mkDmg(s.nextDmgId, s.player.pos, 1, s.tick, true)],
        nextDmgId: s.nextDmgId + 1,
      };
    } else {
      s = { ...s, traces: decayed };
    }
  }

  // ── Spawn enemies ───────────────────────────────────────────────────────
  const MAX_ENEMIES = 10;
  const visibleCount = s.enemies.filter(e =>
    Math.abs(e.pos.x - s.player.pos.x) <= VIEWPORT_HALF &&
    Math.abs(e.pos.y - s.player.pos.y) <= VIEWPORT_HALF
  ).length;
  const interval = getSpawnInterval(s.tick);
  if (visibleCount < MAX_ENEMIES && s.tick % interval === 0) s = spawnEnemy(s);
  if (visibleCount < MAX_ENEMIES && s.tick % (interval * 2) === 0) s = spawnEnemy(s);
  // Boss spawn
  if (s.tick > 0 && s.tick % SPAWN.bossEvery === 0) s = spawnEnemy(s, 'boss');

  // ── Move enemies ────────────────────────────────────────────────────────
  let projectiles = [...s.projectiles];
  let nextProjectileId = s.nextProjectileId;
  let traces = [...s.traces];
  let nextTraceId = s.nextTraceId;

  // Build moves sequentially so each enemy sees already-committed positions
  const shockerFiredAt: Position[] = [];
  const movedEnemies: Enemy[] = [];
  for (const enemy of s.enemies) {
    let moved = enemy;

    // An enemy with interval N moves when tick % N === N-1.
    // Pass movedEnemies (already committed) so no two enemies share a tile.
    const interval = ENEMY_STATS[enemy.type].interval;
    const takesStep = s.tick % interval === interval - 1;

    switch (enemy.type) {
      case 'speedy':
        moved = { ...enemy, pos: moveEnemyTowardPlayer(enemy, s.player, movedEnemies) };
        break;
      case 'tracer': {
        const tracerNewPos = moveEnemyTowardPlayer(enemy, s.player, movedEnemies);
        if (!posEq(tracerNewPos, enemy.pos) && !traces.some(t => posEq(t.pos, enemy.pos))) {
          traces.push({ id: nextTraceId++, pos: { ...enemy.pos }, ticksLeft: SPAWN.bossTraceDuration } as Trace);
        }
        moved = { ...enemy, pos: tracerNewPos };
        break;
      }
      case 'normal':
      case 'tanker':
        if (!takesStep) { moved = enemy; break; }
        moved = { ...enemy, pos: moveEnemyTowardPlayer(enemy, s.player, movedEnemies) };
        break;
      case 'boss': {
        const bossLevel = enemy.bossLevel ?? 1;
        const canFire  = bossLevel >= 2;
        const canTrace = bossLevel >= 3;

        if (bossLevel >= 4) {
          // ── 4th boss: burst pattern (BOSS_BURST_MOVES steps, then 1 rest tick) ──
          const burst = enemy.burstMovesLeft ?? BOSS_BURST_MOVES;
          if (burst === 0) {
            moved = { ...enemy, burstMovesLeft: BOSS_BURST_MOVES };
            break;
          }
          const bossNewPos = moveEnemyTowardPlayer(enemy, s.player, movedEnemies);
          if (canTrace && !posEq(bossNewPos, enemy.pos) && !traces.some(t => posEq(t.pos, enemy.pos))) {
            traces.push({ id: nextTraceId++, pos: { ...enemy.pos }, ticksLeft: SPAWN.bossTraceDuration } as Trace);
          }
          let bossCooldown = Math.max(0, enemy.fireCooldown - 1);
          if (canFire && bossCooldown === 0 && manDist(enemy.pos, s.player.pos) <= 10) {
            const fired = fireProjectile(enemy, s.player, { ...s, projectiles, nextProjectileId });
            projectiles = fired.projectiles;
            nextProjectileId = fired.nextId;
            bossCooldown = SPAWN.bossFire;
          }
          moved = { ...enemy, pos: bossNewPos, fireCooldown: bossCooldown, burstMovesLeft: burst - 1 };
          break;
        }

        // ── Boss levels 1–3: move on interval ───────────────────────────────
        if (!takesStep) { moved = enemy; break; }
        const bossNewPos = moveEnemyTowardPlayer(enemy, s.player, movedEnemies);
        if (canTrace && !posEq(bossNewPos, enemy.pos) && !traces.some(t => posEq(t.pos, enemy.pos))) {
          traces.push({ id: nextTraceId++, pos: { ...enemy.pos }, ticksLeft: SPAWN.bossTraceDuration } as Trace);
        }
        let bossCooldown = Math.max(0, enemy.fireCooldown - 1);
        if (canFire && bossCooldown === 0 && manDist(enemy.pos, s.player.pos) <= 10) {
          const fired = fireProjectile(enemy, s.player, { ...s, projectiles, nextProjectileId });
          projectiles = fired.projectiles;
          nextProjectileId = fired.nextId;
          bossCooldown = SPAWN.bossFire;
        }
        moved = { ...enemy, pos: bossNewPos, fireCooldown: bossCooldown };
        break;
      }
      case 'ranged': {
        const newPos = takesStep ? moveRangedEnemy(enemy, s.player, movedEnemies) : enemy.pos;
        let cooldown = Math.max(0, enemy.fireCooldown - 1);
        if (takesStep && cooldown === 0 && manDist(enemy.pos, s.player.pos) <= 6) {
          const fired = fireProjectile(enemy, s.player, { ...s, projectiles, nextProjectileId });
          projectiles = fired.projectiles;
          nextProjectileId = fired.nextId;
          cooldown = SPAWN.rangedFire;
        }
        moved = { ...enemy, pos: newPos, fireCooldown: cooldown };
        break;
      }
      case 'abnormal': {
        if (!takesStep) { moved = enemy; break; }
        moved = { ...enemy, pos: moveAbnormalTowardPlayer(enemy, s.player, movedEnemies) };
        break;
      }
      case 'assassin': {
        if (enemy.hidden) {
          // Hiding tick: stay still, reveal for next cycle
          moved = { ...enemy, hidden: false, assassinMoves: 2 };
          break;
        }
        const assassinNewPos = moveEnemyTowardPlayer(enemy, s.player, movedEnemies);
        const movesLeft = (enemy.assassinMoves ?? 2) - 1;
        if (movesLeft <= 0) {
          moved = { ...enemy, pos: assassinNewPos, hidden: true, assassinMoves: 0 };
        } else {
          moved = { ...enemy, pos: assassinNewPos, assassinMoves: movesLeft };
        }
        break;
      }
      case 'shocker': {
        if (!takesStep) { moved = enemy; break; }
        const shockerNewPos = moveEnemyTowardPlayer(enemy, s.player, movedEnemies);
        if (!posEq(shockerNewPos, enemy.pos)) {
          shockerFiredAt.push(shockerNewPos);
        }
        moved = { ...enemy, pos: shockerNewPos };
        break;
      }
    }
    movedEnemies.push(moved);
  }

  s = { ...s, enemies: movedEnemies, projectiles, nextProjectileId, traces, nextTraceId, shockerPositions: shockerFiredAt };

  // ── Move projectiles & check player collision ────────────────────────────
  const movedProjs: Projectile[] = [];
  let playerHitByProjectile = false;

  for (const proj of s.projectiles) {
    const newPos = { x: proj.pos.x + proj.dx, y: proj.pos.y + proj.dy };
    const remaining = proj.ticksLeft - 1;
    if (remaining <= 0) continue;
    if (posEq(newPos, s.player.pos)) {
      playerHitByProjectile = true;
      continue; // consume projectile
    }
    movedProjs.push({ ...proj, pos: newPos, ticksLeft: remaining });
  }
  s = { ...s, projectiles: movedProjs };

  // ── Auto attack ─────────────────────────────────────────────────────────
  s = performAttack(s);

  // ── Level up check ──────────────────────────────────────────────────────
  s = checkLevelUp(s);
  if (s.phase === 'skill_select') return s;

  // ── Collision / damage ──────────────────────────────────────────────────
  s = checkCollision(s, playerHitByProjectile);

  // Clean up
  s = {
    ...s,
    damageNumbers: s.damageNumbers.filter(d => s.tick - d.tick < 20),
    hitFlash: s.hitFlash && s.tick - s.hitFlashTick < 3,
  };

  if (s.player.hp <= 0) {
    const clearOfEnemies = s.enemies.every(e => manDist(e.pos, s.player.pos) > 3);
    if (s.player.hasRevive && clearOfEnemies) {
      s = { ...s, player: { ...s.player, hp: 1 } };
    } else {
      return endGame(s);
    }
  }
  return s;
}

function moveInDir(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up':    return { x: pos.x, y: pos.y - 1 };
    case 'down':  return { x: pos.x, y: pos.y + 1 };
    case 'left':  return { x: pos.x - 1, y: pos.y };
    case 'right': return { x: pos.x + 1, y: pos.y };
  }
}

function performAttack(state: GameState): GameState {
  let { player, enemies, items } = state;
  let kills = state.kills;
  let nextItemId = state.nextItemId;
  let nextDmgId = state.nextDmgId;
  const newItems = [...items];
  const dmgNums = [...state.damageNumbers];

  const distMap = new Map(enemies.map(e => [
    e.id,
    e.type === 'abnormal'
      ? Math.min(...abnormalTiles(e.pos).map(t => manDist(t, player.pos)))
      : manDist(e.pos, player.pos),
  ]));
  const inRange = enemies
    .filter(e => (distMap.get(e.id) ?? Infinity) <= player.attackRange)
    .sort((a, b) => (distMap.get(a.id) ?? 0) - (distMap.get(b.id) ?? 0));

  const damage = player.attackBoostCharges > 0 ? player.attack * 2 : player.attack;
  let boostCharges = player.attackBoostCharges;

  let targets: Enemy[];
  if (player.bulletCount > 0) {
    const dirs = [
      [0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1],
    ].slice(0, player.bulletCount * 2);
    const targetSet = new Set<number>();
    targets = [];
    for (const [dx, dy] of dirs) {
      for (let d = 1; d <= player.attackRange; d++) {
        const p = { x: player.pos.x + dx * d, y: player.pos.y + dy * d };
        const hit = inRange.find(e => !targetSet.has(e.id) && (
          e.type === 'abnormal' ? abnormalTiles(e.pos).some(t => posEq(t, p)) : posEq(e.pos, p)
        ));
        if (hit) { targets.push(hit); targetSet.add(hit.id); break; }
      }
    }
    for (const e of inRange) {
      if (targets.length >= player.attackTargets + player.bulletCount * 2) break;
      if (!targetSet.has(e.id)) { targets.push(e); targetSet.add(e.id); }
    }
  } else {
    targets = inRange.slice(0, player.attackTargets);
  }

  const updated = [...enemies];
  const idxMap = new Map(updated.map((e, i) => [e.id, i]));
  const dead = new Set<number>();
  const targetIds = new Set(targets.map(t => t.id));

  function applyDamage(id: number, dmg: number, isChain = false): void {
    const idx = idxMap.get(id);
    if (idx === undefined) return;
    const e = updated[idx];
    if (e.shield) {
      updated[idx] = { ...e, shield: undefined };
      return;
    }
    const newHp = e.hp - dmg;
    const dmgPos = e.type === 'abnormal'
      ? abnormalTiles(e.pos).reduce((best, t) => manDist(t, player.pos) < manDist(best, player.pos) ? t : best)
      : e.pos;
    dmgNums.push(mkDmg(nextDmgId++, dmgPos, dmg, state.tick, false, { victimId: e.id, isChain: isChain || undefined }));
    if (newHp <= 0) {
      dead.add(e.id);
      kills += 1;
      player = { ...player, exp: player.exp + Math.round(e.exp * player.expMultiplier) };
      const drop = tryDrop(e.pos, 0.05 + player.dropRateBonus, nextItemId);
      if (drop) { newItems.push(drop); nextItemId++; }
    } else {
      updated[idx] = { ...e, hp: newHp };
    }
  }

  for (const target of targets) {
    applyDamage(target.id, damage);
    if (boostCharges > 0) boostCharges--;

    if (player.chainAttack > 0) {
      const chainTargets = updated
        .filter(ce => {
          if (dead.has(ce.id) || targetIds.has(ce.id) || ce.id === target.id) return false;
          const ceTiles  = ce.type     === 'abnormal' ? abnormalTiles(ce.pos)     : [ce.pos];
          const tgtTiles = target.type === 'abnormal' ? abnormalTiles(target.pos) : [target.pos];
          return ceTiles.some(ct => tgtTiles.some(tt => manDist(ct, tt) <= 1));
        })
        .sort((a, b) => (distMap.get(a.id) ?? 0) - (distMap.get(b.id) ?? 0))
        .slice(0, player.chainAttack);
      for (const ct of chainTargets) applyDamage(ct.id, damage, true);
    }
  }

  player = { ...player, attackBoostCharges: boostCharges };
  return {
    ...state,
    player,
    enemies: updated.filter(e => !dead.has(e.id)),
    items: newItems,
    kills,
    nextItemId,
    nextDmgId,
    damageNumbers: dmgNums,
  };
}

const CROSS_DIRS = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

function checkCollision(state: GameState, alsoHitByProjectile: boolean): GameState {
  let { player, enemies } = state;
  let nextDmgId = state.nextDmgId;
  const dmgNums = [...state.damageNumbers];

  const adjacentEnemies = enemies.filter(e => {
    if (e.hidden) return false;
    if (e.type === 'abnormal') {
      return abnormalTiles(e.pos).some(t => manDist(t, player.pos) <= 1);
    }
    return manDist(e.pos, player.pos) <= 1;
  });

  // Shocker shockwave hits: cross tiles at distance 1 from each shocker's fired position
  const shockerHits = state.shockerPositions.filter(sp =>
    CROSS_DIRS.some(d => posEq({ x: sp.x + d.x, y: sp.y + d.y }, player.pos))
  ).length;

  const tookHit = adjacentEnemies.length > 0 || alsoHitByProjectile || shockerHits > 0;

  if (!tookHit) return state;

  if (player.shieldActive) {
    return { ...state, player: { ...player, shieldActive: false } };
  }

  const hitCount = adjacentEnemies.length + (alsoHitByProjectile ? 1 : 0) + shockerHits;
  player = { ...player, hp: player.hp - hitCount };
  dmgNums.push(mkDmg(nextDmgId++, player.pos, hitCount, state.tick, true));

  const adjacentIds = new Set(adjacentEnemies.map(e => e.id));
  let updatedEnemies = [...enemies];
  if (player.counterAttack) {
    updatedEnemies = updatedEnemies
      .map(e => adjacentIds.has(e.id) ? { ...e, hp: e.hp - 1 } : e)
      .filter(e => e.hp > 0);
  }

  return {
    ...state,
    player,
    enemies: updatedEnemies,
    nextDmgId,
    damageNumbers: dmgNums,
    hitFlash: true,
    hitFlashTick: state.tick,
  };
}

function checkLevelUp(state: GameState): GameState {
  const { player } = state;
  const threshold = player.expThresholds[player.level - 1];
  if (threshold === undefined || player.exp < threshold) return state;
  const skills = pickRandomSkills(3, state.selectedSkillIds);
  return { ...state, player: { ...player, level: player.level + 1 }, phase: 'skill_select', pendingSkills: skills };
}

function pickUpItems(state: GameState): GameState {
  let { player, items } = state;
  const remaining: typeof items = [];
  for (const item of items) {
    if (posEq(item.pos, player.pos)) player = applyItem(player, item.type);
    else remaining.push(item);
  }
  return { ...state, player, items: remaining };
}

function applyItem(player: Player, type: ItemType): Player {
  switch (type) {
    case 'hp_potion':    return { ...player, hp: Math.min(player.hp + 1, player.maxHp) };
    case 'attack_boost': return { ...player, attackBoostCharges: player.attackBoostCharges + 5 };
    case 'magnet':       return { ...player, exp: player.exp + 5 };
    case 'shield':       return { ...player, shieldActive: true };
  }
}

export function applySkill(state: GameState, skillId: string): GameState {
  const skill = state.pendingSkills.find(s => s.id === skillId);
  if (!skill) return { ...state, phase: 'playing' };
  return {
    ...state,
    player: skill.apply(state.player),
    phase: 'playing',
    pendingSkills: [],
    selectedSkillIds: [...state.selectedSkillIds, skillId],
  };
}

function endGame(state: GameState): GameState {
  const elapsed = Date.now() - state.startTime;
  const score = calcScore(state);
  const bestScore = Math.max(score, state.bestScore);
  try {
    localStorage.setItem('gridRogue_lastScore', score.toString());
    localStorage.setItem('gridRogue_bestScore', bestScore.toString());
  } catch { /* ignore */ }
  return { ...state, phase: 'game_over', elapsedTime: elapsed, lastScore: score, bestScore };
}

export function restartGame(state: GameState): GameState {
  return startGame(state);
}

/** Returns true if this enemy type will move on the NEXT player step.
 *  An enemy with interval N moves when tick % N === N-1, so it moves next tick
 *  when currentTick % N === N-2. */
export function enemyMovesNextTick(type: EnemyType, currentTick: number, burstMovesLeft?: number): boolean {
  const interval = ENEMY_STATS[type].interval;
  if (interval === 1) return true;
  if (type === 'boss' && burstMovesLeft !== undefined) return burstMovesLeft > 0;
  return currentTick % interval === interval - 2;
}
