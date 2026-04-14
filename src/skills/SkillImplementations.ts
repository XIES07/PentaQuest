import { SKILL_META } from "../core/GameData";
import type { Character } from "../entities/Character";
import type { ISkill, SkillContext, SkillResult } from "./ISkill";
import type { TargetType } from "../core/types";

class BasicSkill implements ISkill {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly descriptionEs: string;
  readonly descriptionEn: string;
  readonly targetType: TargetType;
  private readonly run: (ctx: SkillContext) => SkillResult;
  private readonly validator?: (ctx: SkillContext) => boolean;

  constructor(
    id: string,
    targetType: TargetType,
    run: (ctx: SkillContext) => SkillResult,
    validator?: (ctx: SkillContext) => boolean
  ) {
    const meta = SKILL_META[id];
    this.id = id;
    this.nameEs = meta?.nameEs ?? id;
    this.nameEn = meta?.nameEn ?? id;
    this.descriptionEs = meta?.descriptionEs ?? id;
    this.descriptionEn = meta?.descriptionEn ?? id;
    this.targetType = targetType;
    this.run = run;
    this.validator = validator;
  }

  canUse(ctx: SkillContext): boolean {
    if (!this.validator) {
      return true;
    }
    return this.validator(ctx);
  }

  execute(ctx: SkillContext): SkillResult {
    return this.run(ctx);
  }
}

const scale = (value: number, ratio: number): number => Math.max(1, Math.round(value * ratio));

function damage(caster: Character, target: Character, ratio: number, useMagic = false): number {
  const source = useMagic ? caster.stats.magic : caster.stats.attack;
  return target.receiveDamage(scale(source, ratio));
}

export const SKILLS: Record<string, ISkill> = {
  slash: new BasicSkill("slash", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 1.1);
    return { logs: [`${caster.name} usa Corte y causa ${dealt}.`] };
  }),
  execute: new BasicSkill("execute", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    if (t.stats.hp / t.stats.maxHp <= 0.25) {
      t.receiveDamage(99999);
      return { logs: [`${caster.name} ejecuta a ${t.name}.`] };
    }
    const dealt = damage(caster, t, 0.85);
    return { logs: [`${caster.name} usa Ejecutar y causa ${dealt}.`] };
  }),
  whirlwind: new BasicSkill("whirlwind", "all_enemies", ({ caster, enemies }) => {
    const logs: string[] = [];
    enemies.filter((e) => e.isAlive).forEach((enemy) => {
      const dealt = damage(caster, enemy, 0.9);
      logs.push(`Torbellino golpea a ${enemy.name} por ${dealt}.`);
    });
    return { logs };
  }),
  bash: new BasicSkill("bash", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 0.95);
    caster.battleDefenseBonus += 4;
    return { logs: [`${caster.name} embiste a ${t.name} por ${dealt} y se protege.`] };
  }),
  taunt: new BasicSkill("taunt", "self", ({ caster }) => {
    caster.tauntTurns = 1;
    caster.thornsTurns = 1;
    caster.thornsReflectRatio = 0.35;
    return {
      logs: [
        `${caster.name} provoca y activa Espinas (devuelve 35% del dano recibido durante 1 turno).`
      ]
    };
  }),
  fortify: new BasicSkill("fortify", "all_allies", ({ caster, allies }) => {
    allies.filter((a) => a.isAlive).forEach((ally) => {
      ally.battleDefenseBonus += 8;
    });
    return { logs: [`${caster.name} fortifica al equipo (+DEF temporal).`] };
  }),
  arcane_bolt: new BasicSkill("arcane_bolt", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 1.2, true);
    return { logs: [`${caster.name} lanza Rayo Arcano (${dealt}).`] };
  }),
  summon_storm: new BasicSkill("summon_storm", "self", ({ caster }) => {
    return { logs: [`${caster.name} canaliza una invocacion.`] };
  }),
  focus_aura: new BasicSkill("focus_aura", "self", ({ caster }) => {
    caster.stats.magic += 10;
    return { logs: [`${caster.name} concentra su poder magico.`] };
  }),
  mend: new BasicSkill("mend", "single_ally", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const healed = t.heal(Math.round(caster.stats.healPower * 1.15));
    return { logs: [`${caster.name} cura a ${t.name} por ${healed}.`] };
  }),
  revive_light: new BasicSkill("revive_light", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 1.05, true);
    const lifesteal = Math.max(1, Math.round(dealt * 0.6));
    const healed = caster.heal(lifesteal);
    return {
      logs: [
        `${caster.name} drena a ${t.name} por ${dealt} y recupera ${healed} HP (robo de vida).`
      ]
    };
  }),
  wing_pulse: new BasicSkill("wing_pulse", "all_allies", ({ caster, allies }) => {
    const logs: string[] = [];
    allies.filter((a) => a.isAlive).forEach((ally) => {
      const healed = ally.heal(Math.round(caster.stats.healPower * 0.7));
      logs.push(`${ally.name} recupera ${healed} HP.`);
    });
    return { logs };
  }),
  precise_shot: new BasicSkill("precise_shot", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 1.15);
    caster.evadeTurns = 1;
    caster.evadeChance = 0.5;
    return { logs: [`${caster.name} dispara a ${t.name} por ${dealt} y gana 50% de evasion por 1 turno.`] };
  }),
  rainbow_arrow: new BasicSkill("rainbow_arrow", "all_enemies", ({ caster, enemies }) => {
    const logs: string[] = [];
    enemies.filter((e) => e.isAlive).forEach((enemy) => {
      enemy.stats.attack = Math.max(1, enemy.stats.attack - 4);
      const dealt = damage(caster, enemy, 0.8);
      logs.push(`Flecha Arcoiris hiere a ${enemy.name} (${dealt}) y reduce ATK.`);
    });
    return { logs };
  }),
  hunter_mark: new BasicSkill("hunter_mark", "single_enemy", ({ caster, targets }) => {
    const t = targets[0];
    if (!t) return { logs: [] };
    const dealt = damage(caster, t, 1.5);
    return { logs: [`${caster.name} marca y golpea a ${t.name} por ${dealt}.`] };
  })
};
