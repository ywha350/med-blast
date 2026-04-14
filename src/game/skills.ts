import { Skill, Player } from './types';

/** Generate `count` copies of a skill with sequentially suffixed IDs. */
function times(
  count: number,
  baseId: string,
  name: string,
  description: string,
  category: string,
  apply: (p: Player) => Player,
): Skill[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i === 0 ? baseId : `${baseId}_${i + 1}`,
    name, description, category, apply,
  }));
}

export const ALL_SKILLS: Skill[] = [
  ...times(2, 'first_aid',     'First Aid',  'Heal 1 HP and gain 1 max HP',               'Survival',
    (p) => ({ ...p, maxHp: p.maxHp + 1, hp: Math.min(p.hp + 1, p.maxHp + 1) })),
...times(2, 'range_up',      'Long Reach', 'Attack range +1 tile',                      'Attack',
    (p) => ({ ...p, attackRange: p.attackRange + 1 })),
  ...times(0, 'multi_target',  'Spread',     'Attack one additional enemy per turn',       'Attack',
    (p) => ({ ...p, attackTargets: Math.min(p.attackTargets + 1, 6) })),
  {
    id: 'antiseptic',
    name: 'Antiseptic',
    description: '5% chance to restore 1 HP after each move',
    category: 'Survival',
    apply: (p) => ({ ...p, regenChance: Math.min(p.regenChance + 0.05, 0.6) }),
  },
  {
    id: 'exp_boost',
    name: 'Keen Eye',
    description: 'Gain 20% more XP',
    category: 'Utility',
    apply: (p) => ({ ...p, expMultiplier: Math.round((p.expMultiplier + 0.2) * 10) / 10 }),
  },
  ...times(1, 'scavenger',     'Scavenger',  'Item drop rate +10%',                       'Utility',
    (p) => ({ ...p, dropRateBonus: Math.round((p.dropRateBonus + 0.10) * 100) / 100 })),
  {
    id: 'chain_attack',
    name: 'Contagion',
    description: 'Hitting an enemy also damages the nearest adjacent enemy',
    category: 'Special',
    apply: (p) => ({ ...p, chainAttack: 1 }),
  },
  {
    id: 'revive',
    name: 'Second Wind',
    description: 'Upon death, revive with 1 HP and destroy all enemies within 3 tiles',
    category: 'Special',
    apply: (p) => ({ ...p, hasRevive: true }),
  },
  {
    id: 'full_hp_shield',
    name: 'Adrenaline',
    description: 'Fully restore HP and activate shield',
    category: 'Special',
    apply: (p) => ({ ...p, hp: p.maxHp, shieldActive: true }),
  },
];

export function pickRandomSkills(count: number, excludeIds: string[]): Skill[] {
  const selected = new Set(excludeIds);
  const pool = ALL_SKILLS.filter(s =>
    !selected.has(s.id) &&
    (s.requires === undefined || selected.has(s.requires))
  );
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

export function getExpThresholds(maxLevel: number): number[] {
  return Array.from({ length: maxLevel }, (_, i) => Math.round(30 * (i + 1) * (i + 2)));
}
