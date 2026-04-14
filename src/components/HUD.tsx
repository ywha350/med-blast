import { Heart, Zap, Crosshair, Trophy, Timer } from 'lucide-react';
import { Player, GameMode } from '../game/types';

interface HUDProps {
  player: Player;
  kills: number;
  level: number;
  score: number;
  elapsedTime: number;
  gameMode: GameMode;
  timeLimit: number;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function HUD({ player, kills, level, score, elapsedTime, gameMode, timeLimit }: HUDProps) {
  const isTimeAttack = gameMode === 'time_attack';
  const countdown = Math.max(0, timeLimit - elapsedTime);
  const countdownWarning = isTimeAttack && countdown < 10_000;
  const prevThreshold = player.expThresholds[player.level - 2] ?? 0;
  const nextThreshold = player.expThresholds[player.level - 1] ?? 999;
  const expPct = Math.min(1, (player.exp - prevThreshold) / (nextThreshold - prevThreshold));

  return (
    <div className="hud">
      <div className="hud-left">
        <div className="hud-hp">
          {Array.from({ length: player.maxHp }).map((_, i) => (
            <span key={i} className={`hp-heart ${i < player.hp ? 'hp-full' : 'hp-empty'}`}>
              <Heart size={16} fill={i < player.hp ? '#e63946' : 'none'} strokeWidth={2} />
            </span>
          ))}
        </div>
        {!isTimeAttack && (
          <div className="hud-exp-row">
            <Zap size={10} strokeWidth={2} />
            <div className="exp-bar-track">
              <div className="exp-bar-fill" style={{ width: `${expPct * 100}%` }} />
            </div>
            <span className="exp-label">Lv.{level}</span>
          </div>
        )}
      </div>

      <div className="hud-center">
        <div className={`hud-stat${countdownWarning ? ' hud-countdown-warning' : ''}`}>
          <Timer size={12} strokeWidth={2} />
          <span>{isTimeAttack ? formatTime(countdown) : formatTime(elapsedTime)}</span>
        </div>
        <div className="hud-stat">
          <Crosshair size={12} strokeWidth={2} />
          <span>{kills}</span>
        </div>
        <div className="hud-stat">
          <Trophy size={12} strokeWidth={2} />
          <span>{score.toLocaleString()}</span>
        </div>
      </div>

      <div className="hud-right">
        {player.shieldActive && (
          <span className="status-badge badge-shield">SHIELD</span>
        )}
        {player.attackBoostCharges > 0 && (
          <span className="status-badge badge-boost">ATK x2 ({player.attackBoostCharges})</span>
        )}
        {player.hasRevive && (
          <span className="status-badge badge-revive">REVIVE</span>
        )}
      </div>
    </div>
  );
}
