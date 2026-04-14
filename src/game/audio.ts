// Procedural audio for Med Blast (Doctor vs. Germs)
// All sounds synthesized via Web Audio API — no external files needed.

export type SoundName =
  | 'attack'
  | 'hit_enemy'
  | 'enemy_death'
  | 'player_hit'
  | 'item_pickup'
  | 'level_up'
  | 'game_over'
  | 'game_start'
  | 'boss_spawn'
  | 'shield_activate'
  | 'regen'
  | 'move';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (!ctx || ctx.state === 'closed') return null;
  return ctx;
}

function time(): number {
  return ctx ? ctx.currentTime : 0;
}

// --- Utility helpers ---

function makeGain(vol: number): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(vol, time());
  g.connect(masterGain!);
  return g;
}

function makeNoise(duration: number): AudioBufferSourceNode {
  const sampleRate = ctx!.sampleRate;
  const bufLen = Math.ceil(sampleRate * duration);
  const buffer = ctx!.createBuffer(1, bufLen, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx!.createBufferSource();
  src.buffer = buffer;
  return src;
}

function makeLowpass(freq: number, q = 1): BiquadFilterNode {
  const f = ctx!.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, time());
  f.Q.setValueAtTime(q, time());
  return f;
}

function makeHighpass(freq: number): BiquadFilterNode {
  const f = ctx!.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.setValueAtTime(freq, time());
  return f;
}

// --- Sound generators ---

function playAttack() {
  // Scalpel snip: short sawtooth sweep + metallic click
  const c = getCtx(); if (!c) return;
  const t = time();

  // Main sweep: sawtooth, 800→200 Hz
  const g = makeGain(0.18);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.07);

  // Click transient: short noise burst
  const ng = makeGain(0.12);
  ng.gain.setValueAtTime(0.12, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

  const noise = makeNoise(0.03);
  const hp = makeHighpass(3000);
  noise.connect(hp);
  hp.connect(ng);
  noise.start(t);
  noise.stop(t + 0.03);
}

function playHitEnemy() {
  // Germ squelch: noise through lowpass, fast decay
  const c = getCtx(); if (!c) return;
  const t = time();

  const g = makeGain(0.22);
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

  const noise = makeNoise(0.1);
  const lp = makeLowpass(600, 5);
  noise.connect(lp);
  lp.connect(g);
  noise.start(t);
  noise.stop(t + 0.1);
}

function playEnemyDeath() {
  // Germ burst: noise burst + sine pitch drop
  const c = getCtx(); if (!c) return;
  const t = time();

  // Noise pop
  const ng = makeGain(0.28);
  ng.gain.setValueAtTime(0.28, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

  const noise = makeNoise(0.2);
  const lp = makeLowpass(900, 3);
  noise.connect(lp);
  lp.connect(ng);
  noise.start(t);
  noise.stop(t + 0.2);

  // Pitch drop
  const og = makeGain(0.15);
  og.gain.setValueAtTime(0.15, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
  osc.connect(og);
  osc.start(t);
  osc.stop(t + 0.2);
}

function playPlayerHit() {
  // Medical alarm: two short square-wave buzzes
  const c = getCtx(); if (!c) return;
  const t = time();

  [0, 0.12].forEach(offset => {
    const g = makeGain(0.0);
    g.gain.setValueAtTime(0.0, t + offset);
    g.gain.linearRampToValueAtTime(0.25, t + offset + 0.01);
    g.gain.setValueAtTime(0.25, t + offset + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.11);

    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t + offset);
    osc.connect(g);
    osc.start(t + offset);
    osc.stop(t + offset + 0.12);
  });
}

function playItemPickup() {
  // Clinical dispenser: two ascending sine tones
  const c = getCtx(); if (!c) return;
  const t = time();

  [{ freq: 880, delay: 0 }, { freq: 1320, delay: 0.1 }].forEach(({ freq, delay }) => {
    const g = makeGain(0.15);
    g.gain.setValueAtTime(0.15, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + delay);
    osc.connect(g);
    osc.start(t + delay);
    osc.stop(t + delay + 0.13);
  });
}

function playLevelUp() {
  // Monitor beep sequence: 4 ascending clinical beeps
  const c = getCtx(); if (!c) return;
  const t = time();

  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  freqs.forEach((freq, i) => {
    const delay = i * 0.12;
    const g = makeGain(0.18);
    g.gain.setValueAtTime(0.18, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + delay);
    osc.connect(g);
    osc.start(t + delay);
    osc.stop(t + delay + 0.11);
  });
}

function playGameOver() {
  // Flatline: sustained monotone sine that fades out
  const c = getCtx(); if (!c) return;
  const t = time();

  const g = makeGain(0.22);
  g.gain.setValueAtTime(0.22, t);
  g.gain.setValueAtTime(0.22, t + 1.2);
  g.gain.linearRampToValueAtTime(0.0, t + 1.8);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, t);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 1.85);
}

function playGameStart() {
  // Boot-up blip: 3-note ascending sequence
  const c = getCtx(); if (!c) return;
  const t = time();

  const freqs = [330, 494, 660];
  freqs.forEach((freq, i) => {
    const delay = i * 0.1;
    const g = makeGain(0.16);
    g.gain.setValueAtTime(0.16, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.09);

    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + delay);
    osc.connect(g);
    osc.start(t + delay);
    osc.stop(t + delay + 0.1);
  });
}

function playBossSpawn() {
  // Warning alarm: descending FM sweep, harsh
  const c = getCtx(); if (!c) return;
  const t = time();

  // Carrier
  const g = makeGain(0.0);
  g.gain.linearRampToValueAtTime(0.2, t + 0.05);
  g.gain.setValueAtTime(0.2, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

  const carrier = c.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.setValueAtTime(440, t);
  carrier.frequency.linearRampToValueAtTime(180, t + 0.6);

  // Modulator for FM effect
  const modGain = c.createGain();
  modGain.gain.setValueAtTime(80, t);
  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(8, t);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  mod.start(t);
  mod.stop(t + 0.65);

  carrier.connect(g);
  carrier.start(t);
  carrier.stop(t + 0.65);
}

function playShieldActivate() {
  // Force field: quick FM sweep up, electronic
  const c = getCtx(); if (!c) return;
  const t = time();

  const g = makeGain(0.15);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.26);

  // Shimmer layer
  const g2 = makeGain(0.08);
  g2.gain.setValueAtTime(0.08, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  const osc2 = c.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(600, t);
  osc2.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
  osc2.connect(g2);
  osc2.start(t);
  osc2.stop(t + 0.26);
}

function playMove() {
  // Soft footstep on hospital linoleum: muffled noise thud + faint click
  const c = getCtx(); if (!c) return;
  const t = time();

  // Thud: short noise burst through lowpass
  const ng = makeGain(0.09);
  ng.gain.setValueAtTime(0.09, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

  const noise = makeNoise(0.06);
  const lp = makeLowpass(280, 0.8);
  noise.connect(lp);
  lp.connect(ng);
  noise.start(t);
  noise.stop(t + 0.06);

  // Subtle click transient on top
  const cg = makeGain(0.06);
  cg.gain.setValueAtTime(0.06, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

  const click = makeNoise(0.02);
  const hp = makeHighpass(1800);
  click.connect(hp);
  hp.connect(cg);
  click.start(t);
  click.stop(t + 0.02);
}

function playRegen() {
  // Healing pulse: soft high sine blip
  const c = getCtx(); if (!c) return;
  const t = time();

  const g = makeGain(0.13);
  g.gain.setValueAtTime(0.13, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1760, t); // A6
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.16);
}

// --- Public API ---

const soundMap: Record<SoundName, () => void> = {
  attack: playAttack,
  hit_enemy: playHitEnemy,
  enemy_death: playEnemyDeath,
  player_hit: playPlayerHit,
  item_pickup: playItemPickup,
  level_up: playLevelUp,
  game_over: playGameOver,
  game_start: playGameStart,
  boss_spawn: playBossSpawn,
  shield_activate: playShieldActivate,
  regen: playRegen,
  move: playMove,
};

export const AudioManager = {
  init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
    masterGain.connect(ctx.destination);
  },

  play(sound: SoundName) {
    if (!ctx || ctx.state !== 'running') return;
    try {
      soundMap[sound]();
    } catch {
      // Swallow audio errors silently
    }
  },
};
