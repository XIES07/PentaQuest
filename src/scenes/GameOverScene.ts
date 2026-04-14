import Phaser from "phaser";
import { SCENE_SELECTION } from "./SceneKeys";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("game_over");
  }

  create(data: { reachedFloor: number; bestFloor: number }): void {
    this.cameras.main.setBackgroundColor("#08080f");
    this.add
      .text(512, 190, "GAME OVER", { fontSize: "62px", color: "#ff6666", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(512, 280, `Piso alcanzado: ${data.reachedFloor}`, { fontSize: "24px", color: "#ffffff" })
      .setOrigin(0.5);
    this.add
      .text(512, 320, `Mejor piso: ${data.bestFloor}`, { fontSize: "24px", color: "#89b4ff" })
      .setOrigin(0.5);

    const retry = this.add
      .text(512, 430, "[ Volver al menu ]", {
        fontSize: "30px",
        color: "#161616",
        backgroundColor: "#8cf7b6",
        padding: { x: 18, y: 8 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retry.on("pointerdown", () => this.scene.start(SCENE_SELECTION));
  }
}
