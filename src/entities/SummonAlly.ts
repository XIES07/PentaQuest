import type { StatBlock } from "../core/types";
import { Character } from "./Character";

export type SummonType = "snake" | "bear" | "healer";

export class SummonAlly extends Character {
  readonly ownerId: string;
  readonly summonType: SummonType;
  readonly isTemporary = true;

  constructor(id: string, name: string, stats: StatBlock, ownerId: string, summonType: SummonType) {
    super(id, name, "player", stats);
    this.ownerId = ownerId;
    this.summonType = summonType;
  }
}
