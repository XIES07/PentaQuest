import Phaser from "phaser";
import type { Character } from "../entities/Character";
import type { ISkill } from "../skills/ISkill";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly bottomPanel: Phaser.GameObjects.Rectangle;
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
    this.bottomPanel = scene.add.rectangle(0, 0, 10, 10, 0x081232, 0.96).setDepth(995).setOrigin(0);
    this.turnLabel = scene.add
      .text(16, 470, "", { fontSize: "18px", color: "#ffffff", wordWrap: { width: 920 } })
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

    this.layout();
    scene.scale.on("resize", () => this.layout());
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
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const bottomPanelHeight = Math.max(170, Math.floor(height * 0.3));
    const panelTop = height - bottomPanelHeight;
    const isCompact = width < 760;
    const buttonWidth = isCompact ? 160 : 190;
    const buttonHeight = isCompact ? 30 : 36;
    const marginX = isCompact ? 10 : 16;
    const gapX = isCompact ? 8 : 10;
    const buttonsPerRow = Math.max(2, Math.floor((width - marginX * 2 + gapX) / (buttonWidth + gapX)));
    const buttonStyle = {
      fontSize: isCompact ? "14px" : "16px",
      color: "#ffd37a",
      backgroundColor: "#1a2238",
      padding: { x: 8, y: 5 }
    };

    skills.forEach((skill, index) => {
      const row = Math.floor(index / buttonsPerRow);
      const col = index % buttonsPerRow;
      const x = marginX + col * (buttonWidth + gapX);
      const y = panelTop + bottomPanelHeight - buttonHeight - row * (buttonHeight + 8) - 8;
      const button = this.scene.add
        .text(x, y, `[${index + 1}] ${skill.nameEs}`, buttonStyle)
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

  layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const isCompact = width < 760;
    const bottomPanelHeight = Math.max(170, Math.floor(height * 0.3));
    const panelTop = height - bottomPanelHeight;
    const queueSize = isCompact ? "12px" : "14px";
    const turnSize = isCompact ? "15px" : "18px";
    const logSize = isCompact ? "14px" : "16px";

    this.bottomPanel.setPosition(0, panelTop).setSize(width, bottomPanelHeight);
    this.turnLabel
      .setPosition(12, panelTop + 14)
      .setFontSize(turnSize)
      .setWordWrapWidth(width - 24);
    this.logLabel
      .setPosition(12, panelTop + 44)
      .setFontSize(logSize)
      .setWordWrapWidth(width - 24);
    this.queueLabel.setPosition(12, 10).setFontSize(queueSize);

    this.historyButton.setPosition(width - 100, 10).setFontSize(queueSize);
    this.historyPanelBg.setPosition(width * 0.5, Math.max(140, height * 0.28));
    this.historyPanelBg.setSize(Math.min(width * 0.9, 500), Math.min(height * 0.42, 330));
    this.historyPanelText
      .setPosition(this.historyPanelBg.x - this.historyPanelBg.width / 2 + 14, this.historyPanelBg.y - this.historyPanelBg.height / 2 + 12)
      .setFontSize(isCompact ? "11px" : "12px")
      .setWordWrapWidth(this.historyPanelBg.width - 24);
  }
}
