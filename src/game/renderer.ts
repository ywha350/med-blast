import { GameState } from './types';
import { AnimDiff, ChainLink, DeathAnim } from './animTypes';
import { enemyMovesNextTick } from './engine';

export const TILE = 40;
export const VIEWPORT = 13;

// ── Renderer constants ───────────────────────────────────────────────────────
const RESTING_ALPHA   = 0.55;   // alpha for enemies that won't move this tick
const LUNGE_FACTOR    = 0.28;   // how far enemies lunge toward player (in tiles)
const HIT_WINDOW_LO   = 0.1;    // enemy hit-flash start (anim progress)
const HIT_WINDOW_HI   = 0.55;   // enemy hit-flash end
const FLASH_ALPHA     = 0.45;   // max alpha of player hit overlay
const WARN_ARM        = 9;      // corner-bracket arm length (px)
const WARN_TH         = 3;      // corner-bracket thickness (px)
const WARN_M          = 1;      // corner-bracket margin (px)
const TRACE_ALPHA_MIN = 0.12;
const TRACE_ALPHA_RNG = 0.22;
const CHAIN_ARM       = 7;      // corner-bracket arm for trace hazard marker

// Clinical/medical color palette
const C = {
  bg: '#f0f4f8',
  grid: '#d0dce8',
  player: '#ffffff',
  playerOutline: '#1a2a3a',
  playerCross: '#e63946',
  enemyNormal:       '#7bc67e', enemyNormalOutline:  '#2d6a4f',
  enemyTanker:       '#9d4edd', enemyTankerOutline:  '#4a0e8f',
  enemySpeedy:       '#ffd60a', enemySpeedyOutline:  '#b5800a',
  enemyRanged:       '#4cc9f0', enemyRangedOutline:  '#0077a8',
  enemyBoss:         '#e63946', enemyBossOutline:    '#7a0000',
  projectile: '#4cc9f0',
  hpBar: '#e63946',
  attackLine: '#e63946',
  hitFlashEnemy: '#ffffff',
  attackRangeFill:   'rgba(230,57,70,0.07)',
  attackRangeStroke: 'rgba(230,57,70,0.25)',
  shieldGlow:        'rgba(67,97,238,0.25)',
  item_hp_potion: '#e63946',
  item_attack_boost: '#f4a261',
  item_magnet: '#4cc9f0',
  item_shield: '#4361ee',
};

/** Main color for an enemy type — shared by drawing and death effects. */
function enemyMainColor(type: string): string {
  switch (type) {
    case 'tanker': return C.enemyTanker;
    case 'speedy': return C.enemySpeedy;
    case 'ranged': return C.enemyRanged;
    case 'boss':   return C.enemyBoss;
    default:       return C.enemyNormal;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Convert world position to screen pixel (top-left of tile).
 *  baseX/baseY = screen coords of the player tile's top-left corner. */
function w2s(
  wx: number, wy: number,
  camX: number, camY: number,
  baseX: number, baseY: number
): { sx: number; sy: number } {
  return {
    sx: baseX + (wx - camX) * TILE,
    sy: baseY + (wy - camY) * TILE,
  };
}

/**
 * Main animated render entry point.
 * @param state   Post-tick game state (items, HUD data, phase)
 * @param diff    Per-tick animation diff (null = render state directly, t ignored)
 * @param t       Animation progress 0→1
 */
export function renderFrame(
  canvas: HTMLCanvasElement,
  state: GameState,
  diff: AnimDiff | null,
  t: number,
  deathOverlay: { death: DeathAnim; t: number; started: boolean }[] = [],
  effectT = 0,                          // 0→1: attack lines, plays right after movement
  hitFlashT = 0,                        // 0→1: player hit flash, plays after attack phase
  hiddenItemIds: ReadonlySet<number> = new Set()  // items not yet revealed (pending drop)
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const halfW = W / 2;
  const halfH = H / 2;
  const playerSX = halfW - TILE / 2;
  const playerSY = halfH - TILE / 2;

  const easedT = easeOutCubic(Math.min(1, t));

  // Camera position: interpolated player world pos
  const camX = diff
    ? lerp(diff.playerFrom.x, diff.playerTo.x, easedT)
    : state.player.pos.x;
  const camY = diff
    ? lerp(diff.playerFrom.y, diff.playerTo.y, easedT)
    : state.player.pos.y;

  // ── Clear ──────────────────────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ── Grid ───────────────────────────────────────────────────────────────
  drawGrid(ctx, camX, camY, W, H, playerSX, playerSY);

  // ── Attack range diamond ───────────────────────────────────────────────
  drawAttackRange(ctx, playerSX, playerSY, state.player.attackRange);

  // helper: world → screen, culled
  const ws = (wx: number, wy: number) => w2s(wx, wy, camX, camY, playerSX, playerSY);
  const inView = (sx: number, sy: number) => sx > -TILE && sx < W + TILE && sy > -TILE && sy < H + TILE;

  // ── Traces (boss contamination) ────────────────────────────────────────
  for (const trace of state.traces) {
    const { sx, sy } = ws(trace.pos.x, trace.pos.y);
    if (!inView(sx, sy)) continue;
    drawTrace(ctx, sx, sy, trace.ticksLeft);
  }

  // ── Items ──────────────────────────────────────────────────────────────
  for (const item of state.items) {
    if (hiddenItemIds.has(item.id)) continue;
    const { sx, sy } = ws(item.pos.x, item.pos.y);
    if (!inView(sx, sy)) continue;
    drawItem(ctx, sx, sy, item.type);
  }

  // ── Surviving enemies (interpolated positions) ─────────────────────────
  if (diff) {
    const lungeMap = new Map(diff.enemyLunges.map(l => [l.id, l]));
    const lungePeak = Math.sin(Math.min(t, 1) * Math.PI) * TILE * LUNGE_FACTOR;
    for (const e of diff.enemies) {
      const ex = lerp(e.from.x, e.to.x, easedT);
      const ey = lerp(e.from.y, e.to.y, easedT);
      let { sx, sy } = ws(ex, ey);
      const lunge = lungeMap.get(e.id);
      if (lunge) { sx += lunge.dirX * lungePeak; sy += lunge.dirY * lungePeak; }
      if (!inView(sx, sy)) continue;
      drawEnemy(ctx, sx, sy, e, e.isHit && t > HIT_WINDOW_LO && t < HIT_WINDOW_HI, enemyMovesNextTick(e.type, state.tick));
    }
  } else {
    for (const enemy of state.enemies) {
      const { sx, sy } = ws(enemy.pos.x, enemy.pos.y);
      if (!inView(sx, sy)) continue;
      drawEnemy(ctx, sx, sy, enemy, false, enemyMovesNextTick(enemy.type, state.tick));
    }
  }

  // ── Death effects (lingering, own timer via deathOverlay) ─────────────
  for (const { death: d, t: dt, started } of deathOverlay) {
    if (!started) {
      const { sx, sy } = ws(lerp(d.from.x, d.pos.x, easedT), lerp(d.from.y, d.pos.y, easedT));
      drawEnemy(ctx, sx, sy, { type: d.type, hp: 1, maxHp: 1 }, false, false);
    } else {
      const { sx, sy } = ws(d.pos.x, d.pos.y);
      drawDeathEffect(ctx, sx, sy, dt, d.type);
    }
  }

  // ── Attack effect lines (delayed, driven by effectT) ─────────────────
  if (diff && diff.attackPositions.length > 0 && effectT > 0 && effectT < 1) {
    for (const ap of diff.attackPositions) {
      const { sx: tsx, sy: tsy } = ws(ap.x, ap.y);
      drawAttackLine(ctx, halfW, halfH, tsx + TILE / 2, tsy + TILE / 2, effectT);
    }
  }

  // ── Contagion chain lines (enemy → enemy, green, after attack lines) ──
  if (diff && diff.chainLinks.length > 0 && effectT > 0 && effectT < 1) {
    for (const link of diff.chainLinks) {
      drawChainLine(ctx, link, playerSX, playerSY, camX, camY, effectT);
    }
  }

  // ── Projectiles (interpolated) ─────────────────────────────────────────
  if (diff) {
    for (const p of diff.projectiles) {
      const { sx, sy } = ws(lerp(p.from.x, p.to.x, easedT), lerp(p.from.y, p.to.y, easedT));
      drawProjectile(ctx, sx, sy, p.dx, p.dy);
    }
  } else {
    for (const p of state.projectiles) {
      const { sx, sy } = ws(p.pos.x, p.pos.y);
      drawProjectile(ctx, sx, sy, p.dx, p.dy);
    }
  }

  // ── Player ────────────────────────────────────────────────────────────
  drawPlayer(ctx, playerSX, playerSY, state.player);

  // ── Player hit flash overlay (plays after attack phase) ────────────────
  if (diff?.playerHit && hitFlashT > 0 && hitFlashT < 1) {
    ctx.fillStyle = `rgba(230,57,70,${((1 - hitFlashT) * FLASH_ALPHA).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Drawing functions ────────────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camX: number, camY: number,
  W: number, H: number,
  playerSX: number, playerSY: number,
) {
  const tilesX = Math.ceil(W / TILE) + 2;
  const tilesY = Math.ceil(H / TILE) + 2;

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;

  const startWX = Math.floor(camX - tilesX / 2);
  const startWY = Math.floor(camY - tilesY / 2);

  for (let wx = startWX; wx <= startWX + tilesX; wx++) {
    const sx = playerSX + (wx - camX) * TILE;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let wy = startWY; wy <= startWY + tilesY; wy++) {
    const sy = playerSY + (wy - camY) * TILE;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }
}

function drawAttackRange(
  ctx: CanvasRenderingContext2D,
  playerSX: number, playerSY: number,
  range: number
) {
  // Camera == player, so each diamond tile is simply playerSX + dx*TILE
  ctx.fillStyle = C.attackRangeFill;
  ctx.strokeStyle = C.attackRangeStroke;
  ctx.lineWidth = 1;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      if (dx === 0 && dy === 0) continue;
      const sx = playerSX + dx * TILE;
      const sy = playerSY + dy * TILE;
      ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
      ctx.strokeRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  player: { shieldActive: boolean }
) {
  const x = sx + 2;
  const y = sy + 2;
  const w = TILE - 4;
  const h = TILE - 4;

  if (player.shieldActive) {
    ctx.fillStyle = C.shieldGlow;
    ctx.fillRect(sx - 5, sy - 5, TILE + 10, TILE + 10);
  }

  ctx.save();
  // Flip vertically around tile center
  ctx.translate(sx + TILE / 2, sy + TILE / 2);
  ctx.scale(1, -1);
  ctx.translate(-(sx + TILE / 2), -(sy + TILE / 2));

  ctx.fillStyle = C.player;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.playerOutline;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2;
  ctx.fillStyle = C.playerCross;
  ctx.fillRect(cx - 2, cy - 8, 4, 16);
  ctx.fillRect(cx - 8, cy - 2, 16, 4);

  // Eyes
  ctx.fillStyle = C.playerOutline;
  ctx.fillRect(cx - 6, sy + 8, 4, 4);
  ctx.fillRect(cx + 2, sy + 8, 4, 4);

  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  enemy: { type: string; hp: number; maxHp: number },
  isHit: boolean,
  movesNext: boolean
) {
  // Dim + desaturate enemies that are resting this step
  ctx.globalAlpha = movesNext ? 1 : RESTING_ALPHA;
  ctx.filter = movesNext ? 'none' : 'grayscale(1)';

  if (isHit) {
    ctx.fillStyle = C.hitFlashEnemy;
    ctx.fillRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
  } else {
    switch (enemy.type) {
      case 'normal':  drawEnemyNormal(ctx, sx, sy); break;
      case 'tanker':  drawEnemyTanker(ctx, sx, sy); break;
      case 'speedy':  drawEnemySpeedy(ctx, sx, sy); break;
      case 'ranged':  drawEnemyRanged(ctx, sx, sy); break;
      case 'boss':    drawEnemyBoss(ctx, sx, sy);   break;
    }
  }

  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  // Warning marks on enemies about to move: 4 corner brackets
  if (movesNext && !isHit) {
    ctx.fillStyle = '#ffd60a';
    const m = WARN_M, s2 = WARN_ARM, th = WARN_TH;
    ctx.fillRect(sx + m,           sy + m,            s2, th);
    ctx.fillRect(sx + m,           sy + m,            th, s2);
    ctx.fillRect(sx + TILE-m-s2,   sy + m,            s2, th);
    ctx.fillRect(sx + TILE-m-th,   sy + m,            th, s2);
    ctx.fillRect(sx + m,           sy + TILE-m-th,    s2, th);
    ctx.fillRect(sx + m,           sy + TILE-m-s2,    th, s2);
    ctx.fillRect(sx + TILE-m-s2,   sy + TILE-m-th,    s2, th);
    ctx.fillRect(sx + TILE-m-th,   sy + TILE-m-s2,    th, s2);
  }

  if (enemy.hp < enemy.maxHp) {
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + 4, sy + TILE - 6, TILE - 8, 3);
    ctx.fillStyle = C.hpBar;
    ctx.fillRect(sx + 4, sy + TILE - 6, (TILE - 8) * (enemy.hp / enemy.maxHp), 3);
  }
}

function drawEnemyNormal(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  const x = sx + 4; const y = sy + 4; const w = TILE - 8; const h = TILE - 8;
  ctx.fillStyle = C.enemyNormal;
  ctx.fillRect(x, y, w, h);
  ctx.fillRect(x - 4, y + 5, 4, 8); ctx.fillRect(x + w, y + 5, 4, 8);
  ctx.fillRect(x + 5, y - 4, 8, 4); ctx.fillRect(x + 5, y + h, 8, 4);
  ctx.strokeStyle = C.enemyNormalOutline; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  // Dot pattern
  ctx.fillStyle = C.enemyNormalOutline;
  ctx.fillRect(x + 4, y + 4, 4, 4); ctx.fillRect(x + w - 8, y + 4, 4, 4);
  ctx.fillRect(x + 4, y + h - 8, 4, 4); ctx.fillRect(x + w - 8, y + h - 8, 4, 4);
}

function drawEnemyTanker(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  const x = sx + 4; const y = sy + 4; const w = TILE - 8; const h = TILE - 8;
  ctx.fillStyle = C.enemyTanker;
  ctx.fillRect(x, y, w, h);
  ctx.fillRect(x - 4, y + 5, 4, 8); ctx.fillRect(x + w, y + 5, 4, 8);
  ctx.fillRect(x + 5, y - 4, 8, 4); ctx.fillRect(x + 5, y + h, 8, 4);
  ctx.strokeStyle = C.enemyTankerOutline; ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  // Stripe pattern
  ctx.fillStyle = C.enemyTankerOutline;
  ctx.fillRect(x + 2, y + 6, w - 4, 3);
  ctx.fillRect(x + 2, y + 13, w - 4, 3);
  ctx.fillRect(x + 2, y + h - 9, w - 4, 3);
}

function drawEnemySpeedy(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Arrow / diamond shape pointing down (moves toward player)
  const cx = sx + TILE / 2; const cy = sy + TILE / 2;
  ctx.fillStyle = C.enemySpeedy;
  // Thin vertical body
  ctx.fillRect(cx - 4, sy + 4, 8, TILE - 8);
  // Arrow head at bottom
  ctx.fillRect(cx - 8, cy, 16, 8);
  ctx.fillRect(cx - 4, cy + 8, 8, 6);
  ctx.strokeStyle = C.enemySpeedyOutline; ctx.lineWidth = 2;
  ctx.strokeRect(cx - 4, sy + 4, 8, TILE - 8);
  // Speed lines on body
  ctx.fillStyle = C.enemySpeedyOutline;
  ctx.fillRect(cx - 2, sy + 6,  4, 2);
  ctx.fillRect(cx - 2, sy + 11, 4, 2);
  ctx.fillRect(cx - 2, sy + 16, 4, 2);
}

function drawEnemyRanged(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  const cx = sx + TILE / 2; const cy = sy + TILE / 2;
  // Round body
  ctx.fillStyle = C.enemyRanged;
  ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
  ctx.strokeStyle = C.enemyRangedOutline; ctx.lineWidth = 2;
  ctx.strokeRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
  // Gun barrel pointing up
  ctx.fillStyle = C.enemyRangedOutline;
  ctx.fillRect(cx - 3, sy, 6, 10);
  // Cross-hatch pattern on body
  ctx.fillStyle = C.enemyRangedOutline;
  ctx.fillRect(sx + 8,  cy - 2, TILE - 16, 2);
  ctx.fillRect(cx - 1,  sy + 8, 2, TILE - 16);
}

function drawEnemyBoss(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Large imposing square with X pattern
  const x = sx + 2; const y = sy + 2; const w = TILE - 4; const h = TILE - 4;
  ctx.fillStyle = C.enemyBoss;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.enemyBossOutline; ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  // X mark
  ctx.fillStyle = C.enemyBossOutline;
  // diagonal \
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 4 + i * 5, y + 4 + i * 5, 4, 4);
  }
  // diagonal /
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + w - 8 - i * 5, y + 4 + i * 5, 4, 4);
  }
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  dx: number, dy: number
) {
  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2;
  const s = 7; // half-size of triangle

  ctx.fillStyle = C.projectile;
  ctx.strokeStyle = C.enemyRangedOutline;
  ctx.lineWidth = 1;
  ctx.beginPath();

  if (dx === 1 && dy === 0) {       // → right
    ctx.moveTo(cx + s, cy);
    ctx.lineTo(cx - s, cy - s);
    ctx.lineTo(cx - s, cy + s);
  } else if (dx === -1 && dy === 0) { // ← left
    ctx.moveTo(cx - s, cy);
    ctx.lineTo(cx + s, cy - s);
    ctx.lineTo(cx + s, cy + s);
  } else if (dx === 0 && dy === -1) { // ↑ up
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx - s, cy + s);
    ctx.lineTo(cx + s, cy + s);
  } else {                            // ↓ down (default)
    ctx.moveTo(cx, cy + s);
    ctx.lineTo(cx - s, cy - s);
    ctx.lineTo(cx + s, cy - s);
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDeathEffect(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  t: number,  // 0→1, where 0=just died, 1=fully faded
  type: string
) {
  const color = enemyMainColor(type);
  const alpha = Math.max(0, 1 - t);
  ctx.globalAlpha = alpha;

  // Center of the tile
  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2;

  // 8 pixel squares scatter outward
  const spread = t * TILE * 1.4;
  const particleSize = Math.max(2, 6 * (1 - t));
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];

  ctx.fillStyle = color;
  for (const [dx, dy] of directions) {
    const px = cx + dx * spread - particleSize / 2;
    const py = cy + dy * spread - particleSize / 2;
    ctx.fillRect(px, py, particleSize, particleSize);
  }

  // Inner flash (bright center that fades first)
  if (t < 0.3) {
    ctx.fillStyle = '#fff';
    const flashSize = (TILE - 8) * (1 - t / 0.3);
    ctx.fillRect(cx - flashSize / 2, cy - flashSize / 2, flashSize, flashSize);
  }

  ctx.globalAlpha = 1;
}

function drawAttackLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  t: number   // 0→1: line appears then fades
) {
  // Peak opacity at t=0.15, gone by t=1
  const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
  ctx.globalAlpha = Math.max(0, alpha) * 0.9;
  ctx.strokeStyle = C.attackLine;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  ticksLeft: number  // 3 = fresh, 1 = about to expire
) {
  const intensity = ticksLeft / 3; // 1.0 → 0.33

  // Hazard fill
  ctx.fillStyle = `rgba(180, 20, 70, ${TRACE_ALPHA_MIN + intensity * TRACE_ALPHA_RNG})`;
  ctx.fillRect(sx, sy, TILE, TILE);

  // Biohazard corner brackets
  ctx.strokeStyle = `rgba(220, 40, 80, ${0.4 + intensity * 0.4})`;
  ctx.lineWidth = 2;
  const arm = CHAIN_ARM;
  const m = 3;
  // TL
  ctx.beginPath(); ctx.moveTo(sx + m, sy + m + arm); ctx.lineTo(sx + m, sy + m); ctx.lineTo(sx + m + arm, sy + m); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(sx + TILE - m - arm, sy + m); ctx.lineTo(sx + TILE - m, sy + m); ctx.lineTo(sx + TILE - m, sy + m + arm); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(sx + m, sy + TILE - m - arm); ctx.lineTo(sx + m, sy + TILE - m); ctx.lineTo(sx + m + arm, sy + TILE - m); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(sx + TILE - m - arm, sy + TILE - m); ctx.lineTo(sx + TILE - m, sy + TILE - m); ctx.lineTo(sx + TILE - m, sy + TILE - m - arm); ctx.stroke();
}

function drawChainLine(
  ctx: CanvasRenderingContext2D,
  link: ChainLink,
  playerSX: number, playerSY: number,
  camX: number, camY: number,
  t: number  // 0→1: same timing as attack lines
) {
  const { sx: fx, sy: fy } = w2s(link.from.x, link.from.y, camX, camY, playerSX, playerSY);
  const { sx: tx, sy: ty } = w2s(link.to.x, link.to.y, camX, camY, playerSX, playerSY);

  const x1 = fx + TILE / 2;
  const y1 = fy + TILE / 2;
  const x2 = tx + TILE / 2;
  const y2 = ty + TILE / 2;

  // Progress along the line: draw it extending from source outward
  const progress = t < 0.5 ? t / 0.5 : 1;
  const ex = x1 + (x2 - x1) * progress;
  const ey = y1 + (y2 - y1) * progress;

  // Fade: visible 0→0.8, fades out 0.8→1
  const alpha = t < 0.8 ? 0.9 : (1 - t) / 0.2 * 0.9;
  ctx.globalAlpha = Math.max(0, alpha);

  // Dashed green arc — infection spreading from germ to germ
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = '#7bc67e';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Dot at the spreading tip
  if (progress < 1) {
    ctx.setLineDash([]);
    ctx.fillStyle = '#7bc67e';
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  type: string
) {
  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2;
  const s = 10;

  switch (type) {
    case 'hp_potion':
      ctx.fillStyle = C.item_hp_potion;
      ctx.fillRect(cx - 3, cy - s, 6, s * 2);
      ctx.fillRect(cx - s, cy - 3, s * 2, 6);
      break;
    case 'attack_boost':
      ctx.fillStyle = C.item_attack_boost;
      ctx.fillRect(cx - 2, cy - s, 6, 10);
      ctx.fillRect(cx - 6, cy, 10, 4);
      ctx.fillRect(cx - 4, cy + 4, 6, 8);
      break;
    case 'magnet':
      ctx.strokeStyle = C.item_magnet;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy + 2, s - 2, Math.PI, 0, false);
      ctx.stroke();
      ctx.fillStyle = C.item_magnet;
      ctx.fillRect(cx - s + 2, cy + 2, 4, s - 2);
      ctx.fillRect(cx + s - 6, cy + 2, 4, s - 2);
      break;
    case 'shield':
      ctx.fillStyle = C.item_shield;
      ctx.fillRect(cx - s + 2, cy - s + 2, (s - 2) * 2, (s - 2) * 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 2, cy - 6, 4, 12);
      ctx.fillRect(cx - 6, cy - 2, 12, 4);
      break;
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
}
