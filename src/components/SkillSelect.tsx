import { Zap, Shield, Target, Star, Activity, ChevronRight } from 'lucide-react';
import { Skill } from '../game/types';

interface SkillSelectProps {
  skills: Skill[];
  level: number;
  onSelect: (skillId: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Attack': <Target size={14} strokeWidth={2} />,
  'Range': <Zap size={14} strokeWidth={2} />,
  'Bullet': <Star size={14} strokeWidth={2} />,
  'Survival': <Shield size={14} strokeWidth={2} />,
  'Utility': <Activity size={14} strokeWidth={2} />,
  'Special': <ChevronRight size={14} strokeWidth={2} />,
};

export function SkillSelect({ skills, level, onSelect }: SkillSelectProps) {
  return (
    <div className="overlay skill-overlay">
      <div className="skill-container">
        <div className="skill-header">
          <span className="skill-level-tag">LEVEL {level}</span>
          <h2 className="skill-title">Choose Treatment</h2>
        </div>
        <div className="skill-cards">
          {skills.map((skill) => (
            <button
              key={skill.id}
              className="skill-card"
              onClick={() => onSelect(skill.id)}
            >
              <div className="skill-card-header">
                <span className="skill-category-icon">
                  {categoryIcons[skill.category] ?? <Zap size={14} />}
                </span>
                <span className="skill-category">{skill.category}</span>
              </div>
              <div className="skill-card-name">{skill.name}</div>
              <div className="skill-card-desc">{skill.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
