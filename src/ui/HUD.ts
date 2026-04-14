import Phaser from "phaser";
import type { Character } from "../entities/Character";
import type { ISkill } from "../skills/ISkill";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly onAbandon: () => void;
  private readonly bottomPanel: Phaser.GameObjects.Rectangle;
  private readonly actionPanel: Phaser.GameObjects.Rectangle;
  private readonly turnLabel: Phaser.GameObjects.Text;
  private readonly logLabel: Phaser.GameObjects.Text;
  private readonly queueLabel: Phaser.GameObjects.Text;
  private readonly historyButton: Phaser.GameObjects.Text;
  private readonly abandonButton: Phaser.GameObjects.Text;
  private readonly historyPanelBg: Phaser.GameObjects.Rectangle;
  private readonly historyPanelText: Phaser.GameObjects.Text;
  private readonly confirmBg: Phaser.GameObjects.Rectangle;
  private readonly confirmText: Phaser.GameObjects.Text;
  private readonly confirmYes: Phaser.GameObjects.Text;
  private readonly confirmNo: Phaser.GameObjects.Text;
  private historyVisible = false;
  private confirmVisible = false;
  private readonly recentLogs: string[] = [];
  private readonly skillButtons: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, onAbandon: () => void) {
    this.scene = scene;
    this.onAbandon = onAbandon;
    this.bottomPanel = scene.add.rectangle(0, 0, 10, 10, 0x081232, 0.96).setDepth(995).setOrigin(0);
    this.actionPanel = scene.add.rectangle(0, 0, 10, 10, 0x111d44, 0.98).setDepth(997).setOrigin(0);
    this.turnLabel = scene.add
      .text(16, 470, "", { fontSize: "22px", color: "#ffffff", wordWrap: { width: 920 } })
      .setDepth(1000);
    this.logLabel = scene.add
      .text(16, 500, "Listo", { fontSize: "20px", color: "#d2d2d2", wordWrap: { width: 980 } })
      .setDepth(1000);
    this.queueLabel = scene.add
      .text(16, 16, "", { fontSize: "18px", color: "#89b4ff" })
      .setDepth(1000);

    this.historyButton = scene.add
      .text(890, 16, "Historial", {
        fontSize: "17px",
        color: "#0f162b",
        backgroundColor: "#89b4ff",
        padding: { x: 10, y: 6 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.historyButton.on("pointerdown", () => {
      this.historyVisible = !this.historyVisible;
      this.historyPanelBg.setVisible(this.historyVisible);
      this.historyPanelText.setVisible(this.historyVisible);
    });
    this.abandonButton = scene.add
      .text(760, 16, "Abandonar", {
        fontSize: "17px",
        color: "#ffffff",
        backgroundColor: "#8f2433",
        padding: { x: 10, y: 6 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.abandonButton.on("pointerdown", () => this.toggleConfirm(true));

    this.historyPanelBg = scene.add.rectangle(775, 170, 480, 300, 0x050b1a, 0.92).setDepth(1090);
    this.historyPanelText = scene.add
      .text(545, 30, "Ultimos movimientos", {
        fontSize: "15px",
        color: "#ffffff",
        wordWrap: { width: 450 }
      })
      .setDepth(1091);
    this.historyPanelBg.setVisible(false);
    this.historyPanelText.setVisible(false);
    this.confirmBg = scene.add.rectangle(512, 300, 560, 220, 0x050b1a, 0.96).setDepth(1200);
    this.confirmText = scene.add
      .text(512, 260, "¿Seguro que quieres abandonar esta partida?", {
        fontSize: "24px",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 520 }
      })
      .setDepth(1201)
      .setOrigin(0.5);
    this.confirmYes = scene.add
      .text(440, 340, "Si, abandonar", {
        fontSize: "20px",
        color: "#171717",
        backgroundColor: "#ff8a8a",
        padding: { x: 12, y: 8 }
      })
      .setDepth(1201)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.confirmNo = scene.add
      .text(585, 340, "No", {
        fontSize: "20px",
        color: "#171717",
        backgroundColor: "#8cf7b6",
        padding: { x: 16, y: 8 }
      })
      .setDepth(1201)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.confirmYes.on("pointerdown", () => {
      this.toggleConfirm(false);
      this.onAbandon();
    });
    this.confirmNo.on("pointerdown", () => this.toggleConfirm(false));
    this.toggleConfirm(false);

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
    const buttonWidth = isCompact ? 176 : 220;
    const buttonHeight = isCompact ? 40 : 46;
    const marginX = isCompact ? 10 : 16;
    const gapX = isCompact ? 8 : 10;
    const buttonsPerRow = Math.max(2, Math.floor((width - marginX * 2 + gapX) / (buttonWidth + gapX)));
    skills.forEach((skill, index) => {
      const row = Math.floor(index / buttonsPerRow);
      const col = index % buttonsPerRow;
      const x = marginX + col * (buttonWidth + gapX);
      const y = panelTop + bottomPanelHeight - buttonHeight - row * (buttonHeight + 10) - 10;
      const rect = this.scene.add
        .rectangle(x + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 0x22356e, 1)
        .setStrokeStyle(2, 0x8cc8ff)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true });
      const text = this.scene.add
        .text(x + 8, y + 8, `[${index + 1}] ${skill.nameEs}`, {
          fontSize: isCompact ? "16px" : "19px",
          color: "#f8f9ff",
          wordWrap: { width: buttonWidth - 16 }
        })
        .setDepth(1001);
      rect.on("pointerdown", () => onClick(skill));
      rect.on("pointerover", () => rect.setFillStyle(0x2d4a97, 1));
      rect.on("pointerout", () => rect.setFillStyle(0x22356e, 1));
      this.skillButtons.push(rect, text);
    });

    if (skills.length === 0) {
      const placeholder = this.scene.add
        .text(marginX, panelTop + bottomPanelHeight - buttonHeight - 10, "Esperando turno...", {
          fontSize: isCompact ? "16px" : "19px",
          color: "#9db0db",
          backgroundColor: "#1a2238",
          padding: { x: 12, y: 8 }
        })
        .setDepth(1000);
      this.skillButtons.push(placeholder);
    }
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
    const bottomPanelHeight = Math.max(190, Math.floor(height * 0.32));
    const panelTop = height - bottomPanelHeight;
    const queueSize = isCompact ? "15px" : "19px";
    const turnSize = isCompact ? "19px" : "24px";
    const logSize = isCompact ? "17px" : "21px";

    this.bottomPanel.setPosition(0, panelTop).setSize(width, bottomPanelHeight);
    this.actionPanel.setPosition(0, panelTop + 96).setSize(width, bottomPanelHeight - 96);
    this.turnLabel
      .setPosition(12, panelTop + 12)
      .setFontSize(turnSize)
      .setWordWrapWidth(width - 24);
    this.logLabel
      .setPosition(12, panelTop + 52)
      .setFontSize(logSize)
      .setWordWrapWidth(width - 24);
    this.queueLabel.setPosition(12, 10).setFontSize(queueSize);

    this.historyButton.setPosition(width - 140, 10).setFontSize(queueSize);
    this.abandonButton.setPosition(width - 300, 10).setFontSize(queueSize);
    this.historyPanelBg.setPosition(width * 0.5, Math.max(140, height * 0.28));
    this.historyPanelBg.setSize(Math.min(width * 0.9, 500), Math.min(height * 0.42, 330));
    this.historyPanelText
      .setPosition(this.historyPanelBg.x - this.historyPanelBg.width / 2 + 14, this.historyPanelBg.y - this.historyPanelBg.height / 2 + 12)
      .setFontSize(isCompact ? "13px" : "15px")
      .setWordWrapWidth(this.historyPanelBg.width - 24);

    const confirmWidth = Math.min(width * 0.88, 620);
    const confirmHeight = Math.min(height * 0.34, 240);
    this.confirmBg.setPosition(width / 2, height * 0.47).setSize(confirmWidth, confirmHeight);
    this.confirmText
      .setPosition(width / 2, this.confirmBg.y - 30)
      .setFontSize(isCompact ? "20px" : "24px")
      .setWordWrapWidth(confirmWidth - 36);
    this.confirmYes.setPosition(width / 2 - 90, this.confirmBg.y + 44).setFontSize(isCompact ? "18px" : "20px");
    this.confirmNo.setPosition(width / 2 + 90, this.confirmBg.y + 44).setFontSize(isCompact ? "18px" : "20px");
  }

  private toggleConfirm(visible: boolean): void {
    this.confirmVisible = visible;
    this.confirmBg.setVisible(visible);
    this.confirmText.setVisible(visible);
    this.confirmYes.setVisible(visible);
    this.confirmNo.setVisible(visible);
  }
}
