import Phaser from "phaser";
import { installViewportPan } from "../core/ViewportPan";
import { SCENE_SELECTION } from "./SceneKeys";

export class GameOverScene extends Phaser.Scene {
  private payload = { reachedFloor: 0, bestFloor: 0 };

  constructor() {
    super("game_over");
  }

  create(data: { reachedFloor: number; bestFloor: number }): void {
    this.payload = data;
    this.cameras.main.setBackgroundColor("#08080f");
    this.renderResponsive();
    this.scale.on("resize", () => this.renderResponsive());
    installViewportPan(this);
  }

  private renderResponsive(): void {
    this.children.removeAll(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 760;

    this.add
      .text(width / 2, height * 0.28, "GAME OVER", { fontSize: compact ? "44px" : "62px", color: "#ff6666", fontStyle: "bold" })
      .setOrigin(0.5)
      .setStroke("#2a0a0a", 6)
      .setShadow(0, 2, "#000000", 0.85, true, true);
    this.add
      .text(width / 2, height * 0.46, `Piso alcanzado: ${this.payload.reachedFloor}`, { fontSize: compact ? "20px" : "24px", color: "#ffffff" })
      .setOrigin(0.5)
      .setStroke("#0a0c12", 4);
    this.add
      .text(width / 2, height * 0.54, `Mejor piso: ${this.payload.bestFloor}`, { fontSize: compact ? "20px" : "24px", color: "#89b4ff" })
      .setOrigin(0.5)
      .setStroke("#0a0f1d", 4);

    const retry = this.add
      .text(width / 2, height * 0.72, "[ Volver al menu ]", {
        fontSize: compact ? "24px" : "30px",
        color: "#161616",
        backgroundColor: "#8cf7b6",
        padding: { x: compact ? 14 : 18, y: compact ? 6 : 8 }
      })
      .setOrigin(0.5)
      .setStroke("#dcffe9", 1)
      .setInteractive({ useHandCursor: true });
    retry.on("pointerdown", () => this.scene.start(SCENE_SELECTION));
  }
}
