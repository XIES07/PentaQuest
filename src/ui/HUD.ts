import Phaser from "phaser";
import type { Character } from "../entities/Character";
import type { ISkill } from "../skills/ISkill";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly turnLabel: Phaser.GameObjects.Text;
  private readonly logLabel: Phaser.GameObjects.Text;
  private readonly queueLabel: Phaser.GameObjects.Text;
  private readonly historyButton: Phaser.GameObjects.Text;
  private readonly historyPanelBg: Phaser.GameObjects.Rectangle;
  private readonly historyPanelText: Phaser.GameObjects.Text;
  private historyVisible = false;
  private readonly recentLogs: string[] = [];
  private readonly skillButtons: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.turnLabel = scene.add
      .text(16, 470, "", { fontSize: "18px", color: "#ffffff" })
      .setDepth(1000);
    this.logLabel = scene.add
      .text(16, 500, "Listo", { fontSize: "16px", color: "#d2d2d2", wordWrap: { width: 980 } })
      .setDepth(1000);
    this.queueLabel = scene.add
      .text(16, 16, "", { fontSize: "14px", color: "#89b4ff" })
      .setDepth(1000);

    this.historyButton = scene.add
      .text(890, 16, "Historial", {
        fontSize: "14px",
        color: "#0f162b",
        backgroundColor: "#89b4ff",
        padding: { x: 8, y: 4 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.historyButton.on("pointerdown", () => {
      this.historyVisible = !this.historyVisible;
      this.historyPanelBg.setVisible(this.historyVisible);
      this.historyPanelText.setVisible(this.historyVisible);
    });

    this.historyPanelBg = scene.add.rectangle(775, 170, 480, 300, 0x050b1a, 0.92).setDepth(1090);
    this.historyPanelText = scene.add
      .text(545, 30, "Ultimos movimientos", {
        fontSize: "12px",
        color: "#ffffff",
        wordWrap: { width: 450 }
      })
      .setDepth(1091);
    this.historyPanelBg.setVisible(false);
    this.historyPanelText.setVisible(false);
  }

  setTurnText(value: string): void {
    this.turnLabel.setText(value);
  }

  setLog(value: string): void {
    this.logLabel.setText(value);
  }

  pushHistory(value: string): void {
    if (!value.trim()) {
      return;
    }
    this.recentLogs.unshift(value);
    if (this.recentLogs.length > 15) {
      this.recentLogs.length = 15;
    }
    const content =
      "Ultimos 15 movimientos\n\n" +
      this.recentLogs.map((line, idx) => `${idx + 1}. ${line}`).join("\n");
    this.historyPanelText.setText(content);
  }

  setQueue(value: string): void {
    this.queueLabel.setText(value);
  }

  clearSkillButtons(): void {
    this.skillButtons.forEach((btn) => btn.destroy());
    this.skillButtons.length = 0;
  }

  renderSkills(skills: ISkill[], onClick: (skill: ISkill) => void): void {
    this.clearSkillButtons();
    skills.forEach((skill, index) => {
      const x = 16 + index * 195;
      const button = this.scene.add
        .text(x, 540, `[${index + 1}] ${skill.nameEs}`, {
          fontSize: "16px",
          color: "#ffd37a",
          backgroundColor: "#1a2238",
          padding: { x: 8, y: 5 }
        })
        .setInteractive({ useHandCursor: true })
        .setDepth(1000);
      button.on("pointerdown", () => onClick(skill));
      this.skillButtons.push(button);
    });
  }

  renderTeamInfo(active: Character): void {
    this.setTurnText(
      `Turno: ${active.name} | HP ${active.stats.hp}/${active.stats.maxHp} | ATK ${active.stats.attack} | DEF ${active.stats.defense}`
    );
  }
}
