import type { StatBlock, Team } from "../core/types";

export abstract class Character {
  readonly id: string;
  readonly name: string;
  readonly team: Team;
  stats: StatBlock;
  isAlive = true;
  tauntTurns = 0;
  battleDefenseBonus = 0;

  protected constructor(id: string, name: string, team: Team, stats: StatBlock) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.stats = { ...stats };
  }

  receiveDamage(value: number): number {
    if (!this.isAlive) {
      return 0;
    }
    const mitigated = Math.max(1, Math.round(value - (this.stats.defense + this.battleDefenseBonus) * 0.45));
    this.stats.hp = Math.max(0, this.stats.hp - mitigated);
    if (this.stats.hp <= 0) {
      this.isAlive = false;
    }
    return mitigated;
  }

  heal(value: number): number {
    if (!this.isAlive) {
      return 0;
    }
    const before = this.stats.hp;
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + value);
    return this.stats.hp - before;
  }

  resurrect(percentage = 0.3): boolean {
    if (this.isAlive) {
      return false;
    }
    this.isAlive = true;
    this.stats.hp = Math.max(1, Math.floor(this.stats.maxHp * percentage));
    return true;
  }
}
