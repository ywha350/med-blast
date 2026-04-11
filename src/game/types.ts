export interface Position {
  x: number;
  y: number;
}

export type EnemyType = 'normal' | 'tanker' | 'speedy' | 'ranged' | 'boss';
export type ItemType = 'hp_potion' | 'attack_boost' | 'magnet' | 'shield';
export type GamePhase = 'start' | 'playing' | 'skill_select' | 'game_over';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Player {
  pos: Position;
  lastDir: Direction | null;
  hp: number;
  maxHp: number;
  attack: number;
  exp: number;
  level: number;
  expThresholds: number[];
  // Skill modifiers
  attackTargets: number;
  attackRange: number;
  piercing: boolean;
  bulletCount: number;
  expMultiplier: number;
  dropRateBonus: number;
  counterAttack: boolean;
  chainAttack: boolean;
  hasRevive: boolean;
  shieldActive: boolean;
  attackBoostCharges: number;
  regenChance: number;
}

export interface Enemy {
  id: number;
  pos: Position;
  hp: number;
  maxHp: number;
  exp: number;
  type: EnemyType;
  fireCooldown: number;   // ranged/boss: ticks until next shot (0 = ready)
}

export interface Projectile {
  id: number;
  pos: Position;
  dx: number;   // direction: -1 | 0 | 1
  dy: number;
  ticksLeft: number;
}

export interface DropItem {
  id: number;
  pos: Position;
  type: ItemType;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  apply: (player: Player) => Player;
}

export interface DamageNumber {
  id: number;
  worldX: number;
  worldY: number;
  value: number;
  tick: number;
  isPlayer: boolean;
  victimId?: number;  // enemy id if this damage was dealt to an enemy
  isChain?: boolean;  // true if this hit was a Contagion chain spread
}

export interface Trace {
  id: number;
  pos: Position;
  ticksLeft: number;  // 3 → 2 → 1 → removed
}

export interface GameState {
  phase: GamePhase;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  items: DropItem[];
  tick: number;
  kills: number;
  startTime: number;
  elapsedTime: number;
  pendingSkills: Skill[];
  selectedSkillIds: string[];
  lastScore: number;
  bestScore: number;
  nextEnemyId: number;
  nextItemId: number;
  nextDmgId: number;
  nextProjectileId: number;
  damageNumbers: DamageNumber[];
  hitFlash: boolean;
  hitFlashTick: number;
  traces: Trace[];
  nextTraceId: number;
}
