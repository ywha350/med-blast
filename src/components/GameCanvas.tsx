import { useEffect, useRef, useCallback } from 'react';
import { GameState, Direction } from '../game/types';
import { renderFrame, TILE, VIEWPORT } from '../game/renderer';
import { AnimDiff, ChainLink, DeathAnim, TICK_DURATION, DEATH_DURATION, AFTER_MOVE_DELAY, EFFECT_DURATION, HIT_FLASH_DURATION } from '../game/animTypes';

interface GameCanvasProps {
  state: GameState;
  onMove: (dir: Direction) => void;
  onSkillSelectReady?: () => void;
}

/** Build the per-tick animation diff by comparing two consecutive game states. */
function buildAnimDiff(prev: GameState, curr: GameState): AnimDiff {
  const prevMap = new Map(prev.enemies.map(e => [e.id, e]));
  const currMap = new Map(curr.enemies.map(e => [e.id, e]));

  // Surviving enemies with from/to positions
  const enemies = curr.enemies.map(e => {
    const prev = prevMap.get(e.id);
    return {
      id: e.id,
      from: prev ? prev.pos : e.pos,  // new enemies: don't interpolate from thin air
      to: e.pos,
      hp: e.hp,
      maxHp: e.maxHp,
      type: e.type,
      isHit: prev !== undefined && prev.hp > e.hp,
    };
  });

  // Map victimId → post-movement position from this tick's damage numbers
  const killPosMap = new Map(
    curr.damageNumbers
      .filter(d => d.tick === curr.tick && !d.isPlayer && d.victimId !== undefined)
      .map(d => [d.victimId!, { x: d.worldX, y: d.worldY }])
  );

  // Deaths: present in prev, absent in curr — animate from pre-tick to post-movement
  const deaths = prev.enemies
    .filter(e => !currMap.has(e.id))
    .map(e => ({ id: e.id, from: e.pos, pos: killPosMap.get(e.id) ?? e.pos, type: e.type }));

  // Attack positions: direct hits only (exclude chain hits — those get their own animation)
  const attackPositions = curr.damageNumbers
    .filter(d => d.tick === curr.tick && !d.isPlayer && !d.isChain)
    .map(d => ({ x: d.worldX, y: d.worldY }));

  // Chain links: infection spreads from the nearest primary-target hit
  const primaryHits = curr.damageNumbers.filter(d => d.tick === curr.tick && !d.isPlayer && !d.isChain);
  const chainLinks: ChainLink[] = curr.damageNumbers
    .filter(d => d.tick === curr.tick && !d.isPlayer && d.isChain)
    .map(chain => {
      // Find the primary hit closest (adjacent) to this chain target
      const source = primaryHits
        .map(p => ({ p, dist: Math.abs(p.worldX - chain.worldX) + Math.abs(p.worldY - chain.worldY) }))
        .sort((a, b) => a.dist - b.dist)[0]?.p;
      return source ? { from: { x: source.worldX, y: source.worldY }, to: { x: chain.worldX, y: chain.worldY } } : null;
    })
    .filter((l): l is ChainLink => l !== null);

  const playerHit = curr.hitFlash && curr.hitFlashTick === curr.tick;

  // Enemies adjacent to player post-tick that caused a hit lunge toward player
  const enemyLunges = playerHit
    ? curr.enemies
        .filter(e => {
          const dx = Math.abs(e.pos.x - curr.player.pos.x);
          const dy = Math.abs(e.pos.y - curr.player.pos.y);
          return dx + dy <= 1;
        })
        .map(e => ({
          id: e.id,
          dirX: Math.sign(curr.player.pos.x - e.pos.x),
          dirY: Math.sign(curr.player.pos.y - e.pos.y),
        }))
    : [];

  // Projectile interpolation
  const prevProjMap = new Map(prev.projectiles.map(p => [p.id, p]));
  const projectiles = curr.projectiles.map(p => ({
    id: p.id,
    from: prevProjMap.get(p.id)?.pos ?? p.pos,
    to: p.pos,
    dx: p.dx,
    dy: p.dy,
  }));

  return {
    playerFrom: prev.player.pos,
    playerTo: curr.player.pos,
    enemies,
    deaths,
    attackPositions,
    chainLinks,
    playerHit,
    projectiles,
    enemyLunges,
  };
}

export function GameCanvas({ state, onMove, onSkillSelectReady }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSize = TILE * VIEWPORT;

  // Animation refs — managed outside React to avoid re-render churn
  const prevStateRef = useRef<GameState>(state);
  const currStateRef = useRef<GameState>(state);
  const diffRef = useRef<AnimDiff | null>(null);
  const animStartRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const pendingDirRef = useRef<Direction | null>(null);
  const onMoveRef = useRef(onMove);
  const onSkillSelectReadyRef = useRef(onSkillSelectReady);
  const pendingSkillSelectRef = useRef(false);
  const lingeringDeathsRef = useRef<{ death: DeathAnim; startTime: number }[]>([]);
  const pendingItemsRef = useRef<Map<number, number>>(new Map()); // itemId → visibleAt

  // Keep callback refs fresh
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { onSkillSelectReadyRef.current = onSkillSelectReady; }, [onSkillSelectReady]);

  // Start/continue the RAF loop
  const startRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    const loop = () => {
      const diff = diffRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const now = Date.now();
      const elapsed = now - animStartRef.current;
      const t = Math.min(1, elapsed / TICK_DURATION);

      // effectT: attack lines, starts right after movement
      const effectElapsed = Math.max(0, elapsed - TICK_DURATION - AFTER_MOVE_DELAY);
      const effectT = Math.min(1, effectElapsed / EFFECT_DURATION);

      // hitFlashT: player hit overlay, starts after attack phase
      const hitFlashElapsed = Math.max(0, elapsed - TICK_DURATION - AFTER_MOVE_DELAY - EFFECT_DURATION);
      const hitFlashT = Math.min(1, hitFlashElapsed / HIT_FLASH_DURATION);

      // Compute death overlay with independent timer (clamped to [0,1])
      const deathOverlay = lingeringDeathsRef.current.map(d => ({
        death: d.death,
        t: Math.max(0, Math.min(1, (now - d.startTime) / DEATH_DURATION)),
        started: now >= d.startTime,
      }));
      lingeringDeathsRef.current = lingeringDeathsRef.current.filter(
        d => now < d.startTime + DEATH_DURATION  // keep until burst fully done
      );

      // Reveal items whose delay has passed
      const hiddenItemIds = new Set<number>();
      for (const [id, visibleAt] of pendingItemsRef.current) {
        if (now < visibleAt) hiddenItemIds.add(id);
        else pendingItemsRef.current.delete(id);
      }

      renderFrame(canvas, currStateRef.current, diff, t, deathOverlay, effectT, hitFlashT, hiddenItemIds);

      const playerHit = diffRef.current?.playerHit ?? false;

      // Unblock input only when ALL animations are done
      const allDone =
        t >= 1 &&
        effectT >= 1 &&
        (!playerHit || hitFlashT >= 1);

      if (allDone && isAnimatingRef.current) {
        isAnimatingRef.current = false;
        if (pendingSkillSelectRef.current) {
          pendingSkillSelectRef.current = false;
          pendingDirRef.current = null;  // discard any queued move
          onSkillSelectReadyRef.current?.();
        } else {
          const pending = pendingDirRef.current;
          if (pending !== null) {
            pendingDirRef.current = null;
            onMoveRef.current(pending);
          }
        }
      }

      // Keep RAF alive while moving, effects, hit flash, or deaths are still running
      if (t < 1 || effectT < 1 || (playerHit && hitFlashT < 1) || lingeringDeathsRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // When the game state changes, build a new AnimDiff and start animating
  useEffect(() => {
    const prev = currStateRef.current;
    const curr = state;

    // Don't animate the very first render or non-playing states
    if (prev === curr) return;

    prevStateRef.current = prev;
    currStateRef.current = curr;

    const wasPlaying = prev.phase === 'playing';
    const isPlayingOrSkillSelect = curr.phase === 'playing' || curr.phase === 'skill_select';
    if (wasPlaying && isPlayingOrSkillSelect) {
      const newDiff = buildAnimDiff(prev, curr);
      const deathStart = Date.now() + TICK_DURATION + AFTER_MOVE_DELAY + EFFECT_DURATION;
      // Hand deaths off to lingering tracker with their own start time
      if (newDiff.deaths.length > 0) {
        lingeringDeathsRef.current = [
          ...lingeringDeathsRef.current,
          ...newDiff.deaths.map(death => ({ death, startTime: deathStart })),
        ];
      }
      // Delay newly dropped items until after the death burst starts
      const prevItemIds = new Set(prev.items.map(i => i.id));
      for (const item of curr.items) {
        if (!prevItemIds.has(item.id)) {
          pendingItemsRef.current.set(item.id, deathStart);
        }
      }
      diffRef.current = newDiff;
      // Signal RAF to show skill select overlay after animations finish
      if (curr.phase === 'skill_select') {
        pendingSkillSelectRef.current = true;
      }
    } else {
      // For overlays (game_over, etc.) jump straight to final state
      lingeringDeathsRef.current = [];
      pendingItemsRef.current.clear();
      pendingSkillSelectRef.current = false;
      diffRef.current = null;
    }

    animStartRef.current = Date.now();
    isAnimatingRef.current = true;
    startRaf();
  }, [state, startRaf]);

  // Initial render (no animation)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderFrame(canvas, state, null, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (state.phase !== 'playing') return;
    let dir: Direction | null = null;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': dir = 'up'; break;
      case 'ArrowDown': case 's': case 'S': dir = 'down'; break;
      case 'ArrowLeft': case 'a': case 'A': dir = 'left'; break;
      case 'ArrowRight': case 'd': case 'D': dir = 'right'; break;
    }
    if (!dir) return;
    e.preventDefault();

    if (!isAnimatingRef.current) {
      onMoveRef.current(dir);
    } else {
      pendingDirRef.current = dir;  // queue at most 1 ahead
    }
  }, [state.phase]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Touch / swipe input
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || state.phase !== 'playing') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;

    const dir: Direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');

    if (!isAnimatingRef.current) {
      onMoveRef.current(dir);
    } else {
      pendingDirRef.current = dir;
    }
  }, [state.phase]);

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className="game-canvas"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
