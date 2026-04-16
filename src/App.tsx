import { useCallback, useEffect, useReducer, useState } from 'react';
import { useGameAudio } from './hooks/useGameAudio';
import { AudioManager } from './game/audio';
import { GameState, GameMode, Direction } from './game/types';
import { createInitialState, startGame, processTick, applySkill, restartGame, calcScore } from './game/engine';
import { TIME_ATTACK_DURATION } from './game/waves';
import { StartScreen } from './components/StartScreen';
import { GuideScreen } from './components/GuideScreen';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { SkillSelect } from './components/SkillSelect';
import { GameOver } from './components/GameOver';

const TUTORIAL_KEY = 'medblast_seen_tutorial';
import { TICK_DURATION, AFTER_MOVE_DELAY, EFFECT_DURATION, HIT_FLASH_DURATION, DEATH_DURATION } from './game/animTypes';

type Action =
  | { type: 'START'; mode: GameMode }
  | { type: 'MOVE'; dir: Direction }
  | { type: 'SELECT_SKILL'; skillId: string }
  | { type: 'RESTART' }
  | { type: 'TITLE' };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return startGame(state, action.mode);
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
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem(TUTORIAL_KEY));
  const [showSkillSelect, setShowSkillSelect] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    setDisplayTime(Date.now() - state.startTime);
    const id = setInterval(() => setDisplayTime(Date.now() - state.startTime), 1000);
    return () => clearInterval(id);
  }, [state.phase, state.startTime]);

  useEffect(() => {
    if (state.phase === 'game_over') {
      const delay = TICK_DURATION + AFTER_MOVE_DELAY + EFFECT_DURATION + HIT_FLASH_DURATION + DEATH_DURATION;
      const id = setTimeout(() => setShowGameOver(true), delay);
      return () => clearTimeout(id);
    } else {
      setShowGameOver(false);
    }
  }, [state.phase]);

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

  if (showGuide) {
    return (
      <div className="app">
        <GuideScreen onDismiss={() => { localStorage.setItem(TUTORIAL_KEY, '1'); setShowGuide(false); }} />
      </div>
    );
  }

  if (state.phase === 'start') {
    return (
      <div className="app">
        <StartScreen
          lastScore={state.lastScore}
          bestScore={state.bestScore}
          taLastScore={state.taLastScore}
          taBestScore={state.taBestScore}
          onPlayMode={(mode) => { AudioManager.init(); AudioManager.play('game_start'); dispatch({ type: 'START', mode }); }}
          onGuide={() => setShowGuide(true)}
        />
      </div>
    );
  }

  const score = calcScore(state);

  return (
    <div className="app">
      <div className="game-wrapper">
        <HUD
          player={state.player}
          kills={state.kills}
          level={state.player.level}
          score={score}
          elapsedTime={displayTime}
          gameMode={state.gameMode}
          timeLimit={TIME_ATTACK_DURATION}
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
          {showGameOver && (
            <GameOver
              score={score}
              kills={state.kills}
              level={state.player.level}
              bestScore={state.gameMode === 'time_attack' ? state.taBestScore : state.bestScore}
              elapsedTime={state.elapsedTime}
              gameMode={state.gameMode}
              gameOverReason={state.gameOverReason}
              onRestart={() => dispatch({ type: 'RESTART' })}
              onTitle={() => dispatch({ type: 'TITLE' })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
