import { RotateCcw, Home, Trophy, Crosshair, Zap, Timer } from 'lucide-react';

interface GameOverProps {
  score: number;
  kills: number;
  level: number;
  bestScore: number;
  elapsedTime: number;
  onRestart: () => void;
  onTitle: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function GameOver({ score, kills, level, bestScore, elapsedTime, onRestart, onTitle }: GameOverProps) {
  const isNewBest = score >= bestScore;
  const elapsedSec = elapsedTime / 1000;
  const scorePerSec = elapsedSec > 0 ? (score / elapsedSec).toFixed(1) : '0.0';

  return (
    <div className="overlay gameover-overlay">
      <div className="gameover-container">
        <div className="gameover-header">
          <div className="gameover-pixel-germ" />
          <h2 className="gameover-title">INFECTED</h2>
          {isNewBest && <span className="new-best-badge">NEW BEST!</span>}
        </div>

        <div className="gameover-stats">
          <div className="stat-row">
            <Crosshair size={12} strokeWidth={2} />
            <span className="stat-label">Kills</span>
            <span className="stat-value">{kills}</span>
          </div>
          <div className="stat-row">
            <Zap size={12} strokeWidth={2} />
            <span className="stat-label">Level</span>
            <span className="stat-value">{level}</span>
          </div>
          <div className="stat-row">
            <Timer size={12} strokeWidth={2} />
            <span className="stat-label">Time</span>
            <span className="stat-value">{formatTime(elapsedTime)}</span>
          </div>
          <div className="stat-row">
            <Timer size={12} strokeWidth={2} />
            <span className="stat-label">Score/s</span>
            <span className="stat-value">{scorePerSec}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-row stat-score">
            <Trophy size={14} strokeWidth={2} />
            <span className="stat-label">Score</span>
            <span className="stat-value score-final">{score.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <Trophy size={12} strokeWidth={2} />
            <span className="stat-label">Best</span>
            <span className="stat-value">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        <div className="gameover-actions">
          <button className="action-button primary" onClick={onRestart}>
            <RotateCcw size={14} strokeWidth={2.5} />
            <span>RETRY</span>
          </button>
          <button className="action-button secondary" onClick={onTitle}>
            <Home size={14} strokeWidth={2.5} />
            <span>TITLE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
