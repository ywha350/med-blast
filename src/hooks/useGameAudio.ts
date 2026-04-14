import { useEffect, useRef } from 'react';
import { GameState } from '../game/types';
import { AudioManager } from '../game/audio';

export function useGameAudio(state: GameState): void {
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;

    // Initialize audio context on first user-driven state change
    AudioManager.init();

    if (!prev) return;

    // Game phase transitions
    if (state.phase === 'playing' && (prev.phase === 'start' || prev.phase === 'game_over')) {
      AudioManager.play('game_start');
      return;
    }

    if (state.phase === 'skill_select' && prev.phase !== 'skill_select') {
      AudioManager.play('level_up');
      return;
    }

    if (state.phase === 'game_over' && prev.phase !== 'game_over') {
      AudioManager.play('game_over');
      return;
    }

    if (state.phase !== 'playing') return;

    // Movement: tick advanced means a move occurred
    if (state.tick > prev.tick) {
      AudioManager.play('move');
    }

    // Damage numbers: detect new entries this tick
    const prevDmgIds = new Set(prev.damageNumbers.map(d => d.id));
    const newDmg = state.damageNumbers.filter(d => !prevDmgIds.has(d.id));

    let attackedEnemy = false;
    let playerWasHit = false;
    for (const d of newDmg) {
      if (d.isPlayer) {
        playerWasHit = true;
      } else {
        attackedEnemy = true;
      }
    }
    if (playerWasHit) AudioManager.play('player_hit');
    if (attackedEnemy) AudioManager.play('attack');

    // Enemy deaths: enemies in prev but not in current
    const currEnemyIds = new Set(state.enemies.map(e => e.id));
    const deaths = prev.enemies.filter(e => !currEnemyIds.has(e.id));
    // Cap at 3 simultaneous death sounds to avoid audio overload
    const deathCount = Math.min(deaths.length, 3);
    for (let i = 0; i < deathCount; i++) {
      AudioManager.play('enemy_death');
    }

    // Boss spawn: boss appeared this tick
    const prevBossIds = new Set(prev.enemies.filter(e => e.type === 'boss').map(e => e.id));
    const newBoss = state.enemies.some(e => e.type === 'boss' && !prevBossIds.has(e.id));
    if (newBoss) AudioManager.play('boss_spawn');

    // Item pickup: item count decreased
    if (state.items.length < prev.items.length) {
      AudioManager.play('item_pickup');
    }

    // Shield activated
    if (state.player.shieldActive && !prev.player.shieldActive) {
      AudioManager.play('shield_activate');
    }

    // Regen: player HP increased without picking up an hp_potion
    const pickedHpPotion =
      state.items.length < prev.items.length &&
      prev.items.some(item => item.type === 'hp_potion' && !state.items.find(i => i.id === item.id));
    if (state.player.hp > prev.player.hp && !pickedHpPotion) {
      AudioManager.play('regen');
    }
  }, [state]);
}
