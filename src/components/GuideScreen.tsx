interface GuideScreenProps {
  onDismiss: () => void;
}

// ── Sprite helpers (match game renderer palette) ─────────────────────────────

function Sq({ bg, border, w = 28, h = 28 }: { bg: string; border: string; w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, background: bg, boxShadow: `0 0 0 2px ${border}`, flexShrink: 0 }} />
  );
}

function PlayerSq({ size = 24 }: { size?: number }) {
  const bar = Math.round(size * 0.14);
  const arm = Math.round(size * 0.57);
  const cx = Math.round(size / 2);
  return (
    <div style={{ width: size, height: size, background: '#fff', boxShadow: '0 0 0 2px #1a2a3a', position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: cx - bar, top: cx - arm / 2, width: bar * 2, height: arm, background: '#e63946' }} />
      <div style={{ position: 'absolute', left: cx - arm / 2, top: cx - bar, width: arm, height: bar * 2, background: '#e63946' }} />
    </div>
  );
}

function DPad() {
  const cell = <div style={{ width: 10, height: 10, background: 'var(--text-dim)' }} />;
  const gap  = <div style={{ width: 10, height: 10 }} />;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 10px)', gap: 2 }}>
      {gap}{cell}{gap}
      {cell}{cell}{cell}
      {gap}{cell}{gap}
    </div>
  );
}

function TipRow({ icon, name, desc }: { icon: React.ReactNode; name: string; desc: string }) {
  return (
    <div className="guide-tip-row">
      <div className="guide-tip-icon">{icon}</div>
      <div className="guide-tip-text">
        <div className="guide-tip-name">{name}</div>
        <div className="guide-tip-desc">{desc}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GuideScreen({ onDismiss }: GuideScreenProps) {
  return (
    <div className="screen guide-overlay">
      <div className="guide-card">
        <div className="guide-header">
          <span className="guide-title">HOW TO PLAY</span>
          <button className="guide-close" onClick={onDismiss}>✕</button>
        </div>

        <div className="guide-body">
          <div className="guide-page">
            <TipRow
              icon={<DPad />}
              name="MOVE"
              desc="Swipe or press WASD / arrow keys. Each step advances the game by one turn."
            />
            <TipRow
              icon={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <PlayerSq size={22} />
                  <div style={{ width: 16, height: 3, background: '#e63946' }} />
                  <Sq bg="#7bc67e" border="#2d6a4f" w={22} h={22} />
                </div>
              }
              name="AUTO-ATTACK"
              desc="After moving, you automatically attack the nearest enemy within range."
            />
            <TipRow
              icon={
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <Sq bg="#7bc67e" border="#2d6a4f" w={22} h={22} />
                  <div style={{ opacity: 0.4 }}>
                    <Sq bg="#7bc67e" border="#2d6a4f" w={22} h={22} />
                  </div>
                </div>
              }
              name="ENEMY REST"
              desc="Most enemies rest for one turn after moving. Faded = resting. Speedies move every turn."
            />
            <TipRow
              icon={
                <div style={{ fontFamily: 'var(--font)', fontSize: 7, color: 'var(--accent-yellow)', lineHeight: 1.6, textAlign: 'center' }}>
                  MOVES<br />+<br />XP
                </div>
              }
              name="SCORE"
              desc="Score = tiles walked + total XP earned. Move constantly and kill for XP."
            />
          </div>
        </div>

        <div className="guide-footer guide-footer--single">
          <button className="guide-nav-btn guide-nav-btn--play" onClick={onDismiss}>
            PLAY ▶
          </button>
        </div>
      </div>
    </div>
  );
}
