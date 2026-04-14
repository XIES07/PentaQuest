import type { StatBlock } from "../core/types";
import { Character } from "./Character";

export type EnemyKind = "slime" | "skeleton_mage" | "demon" | "slime_blob" | "skeleton_minion";

export class Enemy extends Character {
  readonly kind: EnemyKind;
  readonly isMainWaveEnemy: boolean;
  readonly baseAttackSnapshot: number;
  private demonSummon75Done = false;
  private demonSummon25Done = false;

  constructor(id: string, name: string, stats: StatBlock, kind: EnemyKind, isMainWaveEnemy = false) {
    super(id, name, "enemy", stats);
    this.kind = kind;
    this.isMainWaveEnemy = isMainWaveEnemy;
    this.baseAttackSnapshot = stats.attack;
  }

  shouldTriggerDemonSummon(): boolean {
    if (this.kind !== "demon" || !this.isAlive) {
      return false;
    }
    const ratio = this.stats.hp / this.stats.maxHp;
    if (ratio <= 0.25 && !this.demonSummon25Done) {
      this.demonSummon25Done = true;
      return true;
    }
    if (ratio <= 0.75 && !this.demonSummon75Done) {
      this.demonSummon75Done = true;
      return true;
    }
    return false;
  }
}
