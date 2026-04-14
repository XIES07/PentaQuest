export type Role = "swordsman" | "tank" | "mage" | "healer" | "ranger";
export type Team = "player" | "enemy";
export type TargetType = "single_enemy" | "single_ally" | "all_enemies" | "all_allies" | "self";

export interface StatBlock {
  maxHp: number;
  hp: number;
  attack: number;
  magic: number;
  defense: number;
  speed: number;
  healPower: number;
}

export interface ItemBonus {
  maxHp: number;
  attack: number;
  magic: number;
  defense: number;
  healPower: number;
}

export interface ItemDrop {
  id: string;
  name: string;
  bonus: ItemBonus;
}

export interface CharacterProgress {
  id: string;
  role: Role;
  name: string;
  unlockedSkillIds: string[];
  floorsSinceUnlock: number;
  totalFloorsSurvived: number;
  bonus: ItemBonus;
}

export interface RunState {
  floor: number;
  bestFloor: number;
  roster: CharacterProgress[];
  logHistory: string[];
}

export interface BattleContext {
  floor: number;
}

export const EMPTY_BONUS: ItemBonus = {
  maxHp: 0,
  attack: 0,
  magic: 0,
  defense: 0,
  healPower: 0
};

export const ALL_ROLES: Role[] = ["swordsman", "tank", "mage", "healer", "ranger"];
