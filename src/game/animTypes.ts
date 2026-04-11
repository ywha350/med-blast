import { Position, EnemyType } from './types';

export interface EnemyAnimData {
  id: number;
  from: Position;
  to: Position;
  hp: number;
  maxHp: number;
  type: EnemyType;
  isHit: boolean;
}

export interface DeathAnim {
  id: number;
  from: Position;  // pre-movement position
  pos: Position;   // post-movement position (where death burst plays)
  type: EnemyType;
}

export interface ProjectileAnimData {
  id: number;
  from: Position;
  to: Position;
  dx: number;
  dy: number;
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
  projectiles: ProjectileAnimData[];
  enemyLunges: EnemyLungeAnim[];
}

export const TICK_DURATION = 130;
export const DEATH_DURATION = 300;
export const AFTER_MOVE_DELAY = 0;   // attack starts immediately after movement
export const EFFECT_DURATION = 100;  // ms for attack line animation
export const HIT_FLASH_DURATION = 100; // ms for player hit flash (after attack phase)
