import { Heart, Zap, Crosshair, Trophy } from 'lucide-react';
import { Player } from '../game/types';

interface HUDProps {
  player: Player;
  kills: number;
  level: number;
  score: number;
}

export function HUD({ player, kills, level, score }: HUDProps) {
  const expThreshold = player.expThresholds[player.level - 1] ?? 999;
  const expPct = Math.min(1, player.exp / expThreshold);

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
        <div className="hud-exp-row">
          <Zap size={10} strokeWidth={2} />
          <div className="exp-bar-track">
            <div className="exp-bar-fill" style={{ width: `${expPct * 100}%` }} />
          </div>
          <span className="exp-label">Lv.{level}</span>
        </div>
      </div>

      <div className="hud-center">
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
      </div>
    </div>
  );
}
