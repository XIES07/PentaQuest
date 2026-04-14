import type { Character } from "../entities/Character";
import type { TargetType } from "../core/types";

export interface SkillContext {
  caster: Character;
  allies: Character[];
  enemies: Character[];
  targets: Character[];
}

export interface SkillResult {
  logs: string[];
}

export interface ISkill {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly descriptionEs: string;
  readonly descriptionEn: string;
  readonly targetType: TargetType;
  canUse(ctx: SkillContext): boolean;
  execute(ctx: SkillContext): SkillResult;
}
