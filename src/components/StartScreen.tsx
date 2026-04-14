import { Play, Trophy, Clock } from 'lucide-react';

interface StartScreenProps {
  lastScore: number;
  bestScore: number;
  onPlay: () => void;
}

export function StartScreen({ lastScore, bestScore, onPlay }: StartScreenProps) {
  return (
    <div className="screen start-screen">
      <div className="start-content">
        <div className="title-block">
          <div className="title-pixel-art">
            {/* Doctor pixel art representation via CSS */}
            <div className="pixel-doctor" />
          </div>
          <h1 className="game-title">MED<br />BLAST</h1>
          <p className="game-subtitle">Doctor vs. Germs</p>
        </div>

        <div className="score-board">
          <div className="score-row">
            <Clock size={14} strokeWidth={2} />
            <span className="score-label">Last Score</span>
            <span className="score-value">{lastScore.toLocaleString()}</span>
          </div>
          <div className="score-divider" />
          <div className="score-row score-best">
            <Trophy size={14} strokeWidth={2} />
            <span className="score-label">Best Score</span>
            <span className="score-value">{bestScore.toLocaleString()}</span>
          </div>
        </div>

        <button className="play-button" onClick={onPlay}>
          <Play size={16} strokeWidth={2.5} fill="currentColor" />
          <span>PLAY</span>
        </button>

      </div>
    </div>
  );
}
