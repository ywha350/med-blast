import { Trophy } from 'lucide-react';
import { GameMode } from '../game/types';

interface StartScreenProps {
  lastScore: number;
  bestScore: number;
  taLastScore: number;
  taBestScore: number;
  onPlayMode: (mode: GameMode) => void;
  onGuide: () => void;
}

export function StartScreen({ bestScore, taBestScore, onPlayMode, onGuide }: StartScreenProps) {
  return (
    <div className="screen start-screen">
      <div className="start-content">
        <div className="title-block">
          <div className="title-pixel-art">
            <div className="pixel-doctor" />
          </div>
          <h1 className="game-title">MEDBLAST</h1>
          <p className="game-subtitle">Doctor vs. Germs</p>
        </div>

        <div className="mode-select">
          <button className="mode-button" onClick={() => onPlayMode('classic')}>
            <span className="mode-label">CLASSIC</span>
            <span className="mode-best">
              <Trophy size={10} strokeWidth={2} />
              {bestScore.toLocaleString()}
            </span>
          </button>

          <button className="mode-button mode-button-ta" onClick={() => onPlayMode('time_attack')}>
            <span className="mode-label">TIME ATTACK</span>
            <span className="mode-best">
              <Trophy size={10} strokeWidth={2} />
              {taBestScore.toLocaleString()}
            </span>
          </button>
        </div>

        <button className="guide-open-btn" onClick={onGuide}>? HOW TO PLAY</button>

      </div>
    </div>
  );
}
