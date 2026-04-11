import { useCallback, useEffect, useReducer, useState } from 'react';
import { useGameAudio } from './hooks/useGameAudio';
import { GameState, Direction } from './game/types';
import { createInitialState, startGame, processTick, applySkill, restartGame, calcScore } from './game/engine';
import { StartScreen } from './components/StartScreen';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { SkillSelect } from './components/SkillSelect';
import { GameOver } from './components/GameOver';

type Action =
  | { type: 'START' }
  | { type: 'MOVE'; dir: Direction }
  | { type: 'SELECT_SKILL'; skillId: string }
  | { type: 'RESTART' }
  | { type: 'TITLE' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return startGame(state);
    case 'MOVE':
      if (state.phase !== 'playing') return state;
      return processTick(state, action.dir);
    case 'SELECT_SKILL':
      return applySkill(state, action.skillId);
    case 'RESTART':
      return restartGame(state);
    case 'TITLE':
      return { ...createInitialState(), lastScore: state.lastScore, bestScore: state.bestScore };
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  useGameAudio(state);
  const [showSkillSelect, setShowSkillSelect] = useState(false);

  // Reset overlay when leaving skill_select phase
  useEffect(() => {
    if (state.phase !== 'skill_select') setShowSkillSelect(false);
  }, [state.phase]);

  const handleMove = useCallback((dir: Direction) => {
    dispatch({ type: 'MOVE', dir });
  }, []);

  const handleSelectSkill = useCallback((skillId: string) => {
    dispatch({ type: 'SELECT_SKILL', skillId });
  }, []);

  if (state.phase === 'start') {
    return (
      <div className="app">
        <StartScreen
          lastScore={state.lastScore}
          bestScore={state.bestScore}
          onPlay={() => dispatch({ type: 'START' })}
        />
      </div>
    );
  }

  const score = calcScore(state.tick);

  return (
    <div className="app">
      <div className="game-wrapper">
        <HUD
          player={state.player}
          kills={state.kills}
          level={state.player.level}
          score={score}
        />
        <div className="canvas-container">
          <GameCanvas state={state} onMove={handleMove} onSkillSelectReady={() => setShowSkillSelect(true)} />
          {showSkillSelect && state.phase === 'skill_select' && (
            <SkillSelect
              skills={state.pendingSkills}
              level={state.player.level}
              onSelect={handleSelectSkill}
            />
          )}
          {state.phase === 'game_over' && (
            <GameOver
              score={score}
              kills={state.kills}
              level={state.player.level}
              bestScore={state.bestScore}
              onRestart={() => dispatch({ type: 'RESTART' })}
              onTitle={() => dispatch({ type: 'TITLE' })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
