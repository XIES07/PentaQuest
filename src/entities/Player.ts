import type { CharacterProgress } from "../core/types";
import { buildPlayerStats } from "../core/GameData";
import { Character } from "./Character";

export class Player extends Character {
  readonly progress: CharacterProgress;

  constructor(progress: CharacterProgress) {
    super(progress.id, progress.name, "player", buildPlayerStats(progress));
    this.progress = progress;
  }
}
