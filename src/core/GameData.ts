import type { CharacterProgress, ItemBonus, ItemDrop, Role, StatBlock } from "./types";
import { ALL_ROLES, EMPTY_BONUS } from "./types";

export interface SkillMeta {
  id: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
}

export interface RoleTemplate {
  role: Role;
  nameEs: string;
  nameEn: string;
  baseStats: StatBlock;
  baseSkillIds: string[];
  unlockableSkillIds: string[];
}

const TEMPLATES: Record<Role, RoleTemplate> = {
  swordsman: {
    role: "swordsman",
    nameEs: "Espadachin",
    nameEn: "Swordsman",
    baseStats: { maxHp: 620, hp: 620, attack: 72, magic: 10, defense: 25, speed: 14, healPower: 0 },
    baseSkillIds: ["slash", "execute"],
    unlockableSkillIds: ["whirlwind"]
  },
  tank: {
    role: "tank",
    nameEs: "Tanque",
    nameEn: "Tank",
    baseStats: { maxHp: 920, hp: 920, attack: 40, magic: 10, defense: 55, speed: 9, healPower: 0 },
    baseSkillIds: ["bash", "taunt"],
    unlockableSkillIds: ["fortify"]
  },
  mage: {
    role: "mage",
    nameEs: "Mago Invocador",
    nameEn: "Summoner Mage",
    baseStats: { maxHp: 520, hp: 520, attack: 20, magic: 76, defense: 16, speed: 13, healPower: 0 },
    baseSkillIds: ["arcane_bolt", "summon_storm"],
    unlockableSkillIds: ["focus_aura"]
  },
  healer: {
    role: "healer",
    nameEs: "Curandera",
    nameEn: "Healer",
    baseStats: { maxHp: 470, hp: 470, attack: 18, magic: 45, defense: 18, speed: 11, healPower: 68 },
    baseSkillIds: ["mend", "revive_light"],
    unlockableSkillIds: ["wing_pulse"]
  },
  ranger: {
    role: "ranger",
    nameEs: "Ranger",
    nameEn: "Ranger",
    baseStats: { maxHp: 560, hp: 560, attack: 62, magic: 25, defense: 22, speed: 15, healPower: 0 },
    baseSkillIds: ["precise_shot", "rainbow_arrow"],
    unlockableSkillIds: ["hunter_mark"]
  }
};

export const SKILL_META: Record<string, SkillMeta> = {
  slash: {
    id: "slash",
    nameEs: "Corte",
    nameEn: "Slash",
    descriptionEs: "Ataque fisico basico.",
    descriptionEn: "Basic physical attack."
  },
  execute: {
    id: "execute",
    nameEs: "Ejecutar",
    nameEn: "Execute",
    descriptionEs: "Finaliza objetivos con vida baja.",
    descriptionEn: "Finishes low HP targets."
  },
  whirlwind: {
    id: "whirlwind",
    nameEs: "Torbellino",
    nameEn: "Whirlwind",
    descriptionEs: "Golpea a todos los enemigos.",
    descriptionEn: "Hits all enemies."
  },
  bash: {
    id: "bash",
    nameEs: "Embate",
    nameEn: "Bash",
    descriptionEs: "Ataque defensivo.",
    descriptionEn: "Defensive strike."
  },
  taunt: {
    id: "taunt",
    nameEs: "Provocar",
    nameEn: "Taunt",
    descriptionEs: "Fuerza aggro por 1 turno.",
    descriptionEn: "Forces aggro for 1 turn."
  },
  fortify: {
    id: "fortify",
    nameEs: "Fortificar",
    nameEn: "Fortify",
    descriptionEs: "Aumenta defensa de aliados.",
    descriptionEn: "Increases allies defense."
  },
  arcane_bolt: {
    id: "arcane_bolt",
    nameEs: "Rayo Arcano",
    nameEn: "Arcane Bolt",
    descriptionEs: "Dano magico puntual.",
    descriptionEn: "Focused magic damage."
  },
  summon_storm: {
    id: "summon_storm",
    nameEs: "Invocar Bestia",
    nameEn: "Summon Beast",
    descriptionEs: "Invoca una bestia temporal aliada.",
    descriptionEn: "Summons a temporary allied beast."
  },
  focus_aura: {
    id: "focus_aura",
    nameEs: "Aura de Foco",
    nameEn: "Focus Aura",
    descriptionEs: "Aumenta el ataque magico propio.",
    descriptionEn: "Boosts caster magic."
  },
  mend: {
    id: "mend",
    nameEs: "Sanar",
    nameEn: "Mend",
    descriptionEs: "Cura un aliado.",
    descriptionEn: "Heal one ally."
  },
  revive_light: {
    id: "revive_light",
    nameEs: "Luz Vital",
    nameEn: "Revive Light",
    descriptionEs: "Resucita a un aliado.",
    descriptionEn: "Resurrect one ally."
  },
  wing_pulse: {
    id: "wing_pulse",
    nameEs: "Pulso Alado",
    nameEn: "Wing Pulse",
    descriptionEs: "Cura a todos los aliados.",
    descriptionEn: "Heals all allies."
  },
  precise_shot: {
    id: "precise_shot",
    nameEs: "Disparo Preciso",
    nameEn: "Precise Shot",
    descriptionEs: "Dano fisico puntual.",
    descriptionEn: "Single physical damage."
  },
  rainbow_arrow: {
    id: "rainbow_arrow",
    nameEs: "Flecha Arcoiris",
    nameEn: "Rainbow Arrow",
    descriptionEs: "Dano en area + debuff.",
    descriptionEn: "AoE damage + debuff."
  },
  hunter_mark: {
    id: "hunter_mark",
    nameEs: "Marca del Cazador",
    nameEn: "Hunter Mark",
    descriptionEs: "Golpe fuerte a un objetivo.",
    descriptionEn: "Strong single hit."
  }
};

const ITEM_POOL: ItemDrop[] = [
  { id: "item_atk", name: "Filo de Bronce", bonus: { ...EMPTY_BONUS, attack: 8 } },
  { id: "item_mag", name: "Orbe Runico", bonus: { ...EMPTY_BONUS, magic: 8 } },
  { id: "item_hp", name: "Amuleto Vital", bonus: { ...EMPTY_BONUS, maxHp: 70 } },
  { id: "item_def", name: "Broquel Ligero", bonus: { ...EMPTY_BONUS, defense: 6 } },
  { id: "item_heal", name: "Pluma Sagrada", bonus: { ...EMPTY_BONUS, healPower: 8 } }
];

export function getTemplate(role: Role): RoleTemplate {
  return TEMPLATES[role];
}

export function getAllTemplates(): RoleTemplate[] {
  return ALL_ROLES.map((role) => TEMPLATES[role]);
}

export function createInitialProgress(role: Role): CharacterProgress {
  const template = getTemplate(role);
  return {
    id: `${role}-1`,
    role,
    name: template.nameEs,
    unlockedSkillIds: [...template.baseSkillIds],
    floorsSinceUnlock: 0,
    totalFloorsSurvived: 0,
    bonus: { ...EMPTY_BONUS }
  };
}

export function getRandomItem(): ItemDrop {
  if (ITEM_POOL.length === 0) {
    return { id: "fallback", name: "Objeto Improvisado", bonus: { ...EMPTY_BONUS } };
  }
  const index = Math.floor(Math.random() * ITEM_POOL.length);
  return ITEM_POOL[index] ?? ITEM_POOL[0]!;
}

export function mergeBonus(a: ItemBonus, b: ItemBonus): ItemBonus {
  return {
    maxHp: a.maxHp + b.maxHp,
    attack: a.attack + b.attack,
    magic: a.magic + b.magic,
    defense: a.defense + b.defense,
    healPower: a.healPower + b.healPower
  };
}

export function buildPlayerStats(progress: CharacterProgress): StatBlock {
  const base = getTemplate(progress.role).baseStats;
  const maxHp = base.maxHp + progress.bonus.maxHp;
  return {
    maxHp,
    hp: maxHp,
    attack: base.attack + progress.bonus.attack,
    magic: base.magic + progress.bonus.magic,
    defense: base.defense + progress.bonus.defense,
    speed: base.speed,
    healPower: base.healPower + progress.bonus.healPower
  };
}

export function getEnemyStatsByFloor(floor: number): StatBlock {
  const growth = Math.pow(1.12, floor - 1);
  const variance = 0.92 + Math.random() * 0.16;
  const scale = growth * variance;
  const maxHp = Math.round(280 * scale);
  return {
    maxHp,
    hp: maxHp,
    attack: Math.round(38 * scale),
    magic: Math.round(30 * scale),
    defense: Math.round(14 * scale),
    speed: Math.max(8, Math.round(8 + floor * 0.35)),
    healPower: 0
  };
}
