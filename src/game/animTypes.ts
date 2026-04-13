import { Position, EnemyType } from './types';

export interface EnemyAnimData {
  id: number;
  from: Position;
  to: Position;
  hp: number;
  maxHp: number;
  type: EnemyType;
  isHit: boolean;
  bossLevel?: number;
  burstMovesLeft?: number;
  hidden?: boolean;
  shield?: boolean;
  assassinAnim?: 'hiding' | 'appearing';
}

export interface DeathAnim {
  id: number;
  from: Position;  // pre-movement position
  pos: Position;   // post-movement position (where death burst plays)
  type: EnemyType;
  size?: number;   // 2 for abnormal, undefined for 1×1
}

export interface ProjectileAnimData {
  id: number;
  from: Position;
  to: Position;
  dx: number;
  dy: number;
  fromBoss?: boolean;
}

export interface EnemyLungeAnim {
  id: number;
  dirX: number;  // normalized direction toward player (-1|0|1)
  dirY: number;
}

export interface ChainLink {
  from: Position;  // primary target (where infection originates)
  to: Position;    // chain target (where infection spreads)
}

export interface AnimDiff {
  playerFrom: Position;
  playerTo: Position;
  enemies: EnemyAnimData[];
  deaths: DeathAnim[];
  attackPositions: Position[];
  chainLinks: ChainLink[];
  playerHit: boolean;
  playerDied: boolean;
  projectiles: ProjectileAnimData[];
  enemyLunges: EnemyLungeAnim[];
  shockwaves: Position[];   // shocker fire positions this tick
}

export const TICK_DURATION = 160;
export const DEATH_DURATION = 420;
export const AFTER_MOVE_DELAY = 0;   // attack starts immediately after movement
export const EFFECT_DURATION = 130;  // ms for attack line animation
export const HIT_FLASH_DURATION = 130; // ms for player hit flash (after attack phase)
