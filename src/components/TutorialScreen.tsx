import { useEffect } from 'react';

interface TutorialScreenProps {
  onDismiss: () => void;
}

const STEPS = [
  'Swipe or press WASD / arrow keys to move.',
  'You automatically attack the nearest enemy after each move.',
  'Most enemies rest for a turn after moving. But speedies don\'t.',
  'Move and kill to score higher.',
];

export function TutorialScreen({ onDismiss }: TutorialScreenProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  return (
    <div className="screen tutorial-screen" onClick={onDismiss}>
      <div className="tutorial-content">
        <h2 className="tutorial-title">HOW TO PLAY</h2>
        <ol className="tutorial-steps">
          {STEPS.map((step, i) => (
            <li key={i} className="tutorial-step">
              <span className="tutorial-num">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="tutorial-dismiss">TAP TO CONTINUE</p>
      </div>
    </div>
  );
}
