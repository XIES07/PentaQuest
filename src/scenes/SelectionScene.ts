import Phaser from "phaser";
import { createInitialProgress, getAllTemplates } from "../core/GameData";
import { SaveService } from "../core/SaveService";
import type { RunState, Role } from "../core/types";
import { SCENE_BATTLE } from "./SceneKeys";

export class SelectionScene extends Phaser.Scene {
  private readonly saveService = new SaveService();

  constructor() {
    super("selection");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b1025");
    this.add.text(512, 70, "PentaQuest", { fontSize: "46px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(512, 120, "Selecciona tu heroe inicial", { fontSize: "20px", color: "#ffd37a" }).setOrigin(0.5);

    const save = this.saveService.load();
    if (save) {
      const continueBtn = this.add
        .text(512, 170, "[ Continuar partida ]", {
          fontSize: "24px",
          color: "#6cf797",
          backgroundColor: "#133820",
          padding: { x: 16, y: 8 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      continueBtn.on("pointerdown", () => this.scene.start(SCENE_BATTLE, { runState: save }));
    }

    const templates = getAllTemplates();
    templates.forEach((template, index) => {
      const x = 180 + index * 165;
      const y = 320;
      this.add.rectangle(x, y, 135, 160, 0x1a2238, 1).setStrokeStyle(2, 0x35508a);
      this.add
        .text(x, y - 40, template.nameEs, { fontSize: "16px", color: "#ffffff", align: "center" })
        .setOrigin(0.5);
      this.add
        .text(x, y - 5, `HP ${template.baseStats.maxHp}\nATK ${template.baseStats.attack}\nDEF ${template.baseStats.defense}`, {
          fontSize: "12px",
          color: "#d2ddff",
          align: "center"
        })
        .setOrigin(0.5);

      const btn = this.add
        .text(x, y + 55, "Elegir", {
          fontSize: "14px",
          color: "#121212",
          backgroundColor: "#ffd37a",
          padding: { x: 10, y: 5 }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => this.startNewRun(template.role));
    });
  }

  private startNewRun(role: Role): void {
    const runState: RunState = {
      floor: 1,
      bestFloor: 1,
      roster: [createInitialProgress(role)],
      logHistory: ["Partida iniciada."]
    };
    this.saveService.save(runState);
    this.scene.start(SCENE_BATTLE, { runState });
  }
}
