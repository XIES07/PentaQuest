import Phaser from "phaser";
import {
  getTypographyScale,
  loadTypographyMode,
  saveTypographyMode,
  type TypographyMode
} from "../core/AccessibilitySettings";
import type { Character } from "../entities/Character";
import type { ISkill } from "../skills/ISkill";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly onAbandon: () => void;
  private readonly onTypographyChanged: () => void;
  private textMode: TypographyMode = loadTypographyMode();
  private textScale = getTypographyScale(this.textMode);
  private readonly bottomPanel: Phaser.GameObjects.Rectangle;
  private readonly actionPanel: Phaser.GameObjects.Rectangle;
  private readonly turnLabel: Phaser.GameObjects.Text;
  private readonly logLabel: Phaser.GameObjects.Text;
  private readonly queueLabel: Phaser.GameObjects.Text;
  private readonly historyButton: Phaser.GameObjects.Text;
  private readonly abandonButton: Phaser.GameObjects.Text;
  private readonly settingsButton: Phaser.GameObjects.Text;
  private readonly historyPanelBg: Phaser.GameObjects.Rectangle;
  private readonly historyPanelText: Phaser.GameObjects.Text;
  private readonly settingsPanelBg: Phaser.GameObjects.Rectangle;
  private readonly settingsTitle: Phaser.GameObjects.Text;
  private readonly settingNormalBtn: Phaser.GameObjects.Text;
  private readonly settingLargeBtn: Phaser.GameObjects.Text;
  private readonly settingXLargeBtn: Phaser.GameObjects.Text;
  private readonly confirmBg: Phaser.GameObjects.Rectangle;
  private readonly confirmText: Phaser.GameObjects.Text;
  private readonly confirmYes: Phaser.GameObjects.Text;
  private readonly confirmNo: Phaser.GameObjects.Text;
  private historyVisible = false;
  private settingsVisible = false;
  private confirmVisible = false;
  private readonly recentLogs: string[] = [];
  private readonly skillButtons: Phaser.GameObjects.GameObject[] = [];
  private activeSkills: ISkill[] = [];
  private activeSkillClick: ((skill: ISkill) => void) | null = null;

  constructor(scene: Phaser.Scene, onAbandon: () => void, onTypographyChanged: () => void) {
    this.scene = scene;
    this.onAbandon = onAbandon;
    this.onTypographyChanged = onTypographyChanged;
    this.bottomPanel = scene.add.rectangle(0, 0, 10, 10, 0x081232, 0.96).setDepth(995).setOrigin(0);
    this.actionPanel = scene.add.rectangle(0, 0, 10, 10, 0x111d44, 0.98).setDepth(997).setOrigin(0);
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
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#8f2433",
        padding: { x: 10, y: 6 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.abandonButton.on("pointerdown", () => this.toggleConfirm(true));
    this.settingsButton = scene.add
      .text(640, 16, "⚙️", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#22366b",
        padding: { x: 10, y: 4 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.settingsButton.on("pointerdown", () => this.toggleSettings(!this.settingsVisible));

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
    this.settingsPanelBg = scene.add.rectangle(540, 170, 380, 250, 0x050b1a, 0.94).setDepth(1140);
    this.settingsTitle = scene.add
      .text(540, 95, "Ajustes", {
        fontSize: "22px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(1141);
    this.settingNormalBtn = scene.add
      .text(540, 140, "Tipografia: Normal", {
        fontSize: "16px",
        color: "#0f172a",
        backgroundColor: "#9dd1ff",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingLargeBtn = scene.add
      .text(540, 185, "Tipografia: Grande", {
        fontSize: "16px",
        color: "#0f172a",
        backgroundColor: "#9dd1ff",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingXLargeBtn = scene.add
      .text(540, 230, "Tipografia: Extra", {
        fontSize: "16px",
        color: "#0f172a",
        backgroundColor: "#9dd1ff",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingNormalBtn.on("pointerdown", () => this.setTextMode("normal"));
    this.settingLargeBtn.on("pointerdown", () => this.setTextMode("large"));
    this.settingXLargeBtn.on("pointerdown", () => this.setTextMode("xlarge"));
    this.toggleSettings(false);
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
    this.activeSkills = skills;
    this.activeSkillClick = onClick;
    this.clearSkillButtons();
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const bottomPanelHeight = Math.max(170, Math.floor(height * 0.3));
    const panelTop = height - bottomPanelHeight;
    const isCompact = width < 760;
    const buttonWidth = isCompact ? 176 * this.textScale : 220 * this.textScale;
    const buttonHeight = isCompact ? 40 * this.textScale : 46 * this.textScale;
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
          fontSize: `${(isCompact ? 16 : 19) * this.textScale}px`,
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
          fontSize: `${(isCompact ? 16 : 19) * this.textScale}px`,
          color: "#9db0db",
          backgroundColor: "#1a2238",
          padding: { x: 12 * this.textScale, y: 8 * this.textScale }
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
    const bottomPanelHeight = Math.max(190 * this.textScale, Math.floor(height * (0.3 + 0.08 * (this.textScale - 1))));
    const panelTop = height - bottomPanelHeight;
    const queueSize = (isCompact ? 15 : 19) * this.textScale;
    const turnSize = (isCompact ? 19 : 24) * this.textScale;
    const logSize = (isCompact ? 17 : 21) * this.textScale;

    this.bottomPanel.setPosition(0, panelTop).setSize(width, bottomPanelHeight);
    this.actionPanel.setPosition(0, panelTop + 96).setSize(width, bottomPanelHeight - 96);
    this.turnLabel
      .setPosition(12, panelTop + 16)
      .setFontSize(turnSize)
      .setWordWrapWidth(width - 24);
    this.logLabel
      .setPosition(12, panelTop + 92)
      .setFontSize(logSize)
      .setWordWrapWidth(width - 24);
    this.queueLabel.setPosition(12, 10).setFontSize(queueSize);

    this.historyButton.setPosition(width - 250, 10).setFontSize(queueSize);
    this.abandonButton.setPosition(width - 560, 10).setFontSize(queueSize);
    this.settingsButton.setPosition(width - 700, 10).setFontSize(queueSize);
    this.historyPanelBg.setPosition(width * 0.5, Math.max(140, height * 0.28));
    this.historyPanelBg.setSize(Math.min(width * 0.9, 500), Math.min(height * 0.42, 330));
    this.historyPanelText
      .setPosition(this.historyPanelBg.x - this.historyPanelBg.width / 2 + 14, this.historyPanelBg.y - this.historyPanelBg.height / 2 + 12)
      .setFontSize((isCompact ? 13 : 15) * this.textScale)
      .setWordWrapWidth(this.historyPanelBg.width - 24);

    this.settingsPanelBg.setPosition(width * 0.5, Math.max(140, height * 0.28));
    this.settingsPanelBg.setSize(Math.min(width * 0.84, 420), Math.min(height * 0.42, 280));
    this.settingsTitle
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y - this.settingsPanelBg.height * 0.32)
      .setFontSize((isCompact ? 18 : 22) * this.textScale);
    const btnFont = (isCompact ? 14 : 16) * this.textScale;
    this.settingNormalBtn
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y - this.settingsPanelBg.height * 0.08)
      .setFontSize(btnFont);
    this.settingLargeBtn.setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y + this.settingsPanelBg.height * 0.1).setFontSize(btnFont);
    this.settingXLargeBtn
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y + this.settingsPanelBg.height * 0.28)
      .setFontSize(btnFont);

    const confirmWidth = Math.min(width * 0.88, 620);
    const confirmHeight = Math.min(height * 0.34, 240);
    this.confirmBg.setPosition(width / 2, height * 0.47).setSize(confirmWidth, confirmHeight);
    this.confirmText
      .setPosition(width / 2, this.confirmBg.y - 30)
      .setFontSize((isCompact ? 20 : 24) * this.textScale)
      .setWordWrapWidth(confirmWidth - 36);
    this.confirmYes.setPosition(width / 2 - 120, this.confirmBg.y + 64).setFontSize((isCompact ? 18 : 20) * this.textScale);
    this.confirmNo.setPosition(width / 2 + 120, this.confirmBg.y + 64).setFontSize((isCompact ? 18 : 20) * this.textScale);
  }

  private toggleConfirm(visible: boolean): void {
    this.confirmVisible = visible;
    if (visible) {
      this.toggleSettings(false);
    }
    this.confirmBg.setVisible(visible);
    this.confirmText.setVisible(visible);
    this.confirmYes.setVisible(visible);
    this.confirmNo.setVisible(visible);
  }

  private toggleSettings(visible: boolean): void {
    this.settingsVisible = visible;
    this.settingsPanelBg.setVisible(visible);
    this.settingsTitle.setVisible(visible);
    this.settingNormalBtn.setVisible(visible);
    this.settingLargeBtn.setVisible(visible);
    this.settingXLargeBtn.setVisible(visible);
  }

  private setTextMode(mode: TypographyMode): void {
    this.textMode = mode;
    this.textScale = getTypographyScale(mode);
    saveTypographyMode(mode);
    this.layout();
    if (this.activeSkillClick) {
      this.renderSkills(this.activeSkills, this.activeSkillClick);
    }
    this.onTypographyChanged();
    this.toggleSettings(false);
  }
}
