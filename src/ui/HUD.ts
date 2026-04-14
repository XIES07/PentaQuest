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
  private readonly partyPanel: Phaser.GameObjects.Rectangle;
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
  private readonly partyWidgets: Phaser.GameObjects.GameObject[] = [];
  private readonly partyCardById = new Map<string, Phaser.GameObjects.Rectangle>();
  private partySelectHandler: ((targetId: string) => void) | null = null;
  private activeSkills: ISkill[] = [];
  private activeParty: Character[] = [];
  private activeSkillClick: ((skill: ISkill) => void) | null = null;

  constructor(scene: Phaser.Scene, onAbandon: () => void, onTypographyChanged: () => void) {
    this.scene = scene;
    this.onAbandon = onAbandon;
    this.onTypographyChanged = onTypographyChanged;
    this.bottomPanel = scene.add.rectangle(0, 0, 10, 10, 0x1b1d22, 0.97).setDepth(995).setOrigin(0);
    this.partyPanel = scene.add.rectangle(0, 0, 10, 10, 0x24272d, 0.98).setDepth(996).setOrigin(0);
    this.actionPanel = scene.add.rectangle(0, 0, 10, 10, 0x30343b, 0.98).setDepth(997).setOrigin(0);
    this.turnLabel = scene.add
      .text(16, 470, "", { fontSize: "18px", color: "#ffffff", wordWrap: { width: 920 } })
      .setDepth(1000);
    this.logLabel = scene.add
      .text(16, 500, "Listo", { fontSize: "16px", color: "#d2d2d2", wordWrap: { width: 980 } })
      .setDepth(1000);
    this.queueLabel = scene.add
      .text(16, 16, "", { fontSize: "14px", color: "#d5d8df" })
      .setDepth(1000);

    this.historyButton = scene.add
      .text(890, 16, "Historial", {
        fontSize: "14px",
        color: "#111214",
        backgroundColor: "#c7ccd4",
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
        backgroundColor: "#6d3a3f",
        padding: { x: 10, y: 6 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.abandonButton.on("pointerdown", () => this.toggleConfirm(true));
    this.settingsButton = scene.add
      .text(640, 16, "⚙️", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#4a4f58",
        padding: { x: 10, y: 4 }
      })
      .setDepth(1100)
      .setInteractive({ useHandCursor: true });
    this.settingsButton.on("pointerdown", () => this.toggleSettings(!this.settingsVisible));

    this.historyPanelBg = scene.add.rectangle(775, 170, 480, 300, 0x15171b, 0.94).setDepth(1090);
    this.historyPanelText = scene.add
      .text(545, 30, "Ultimos movimientos", {
        fontSize: "12px",
        color: "#ffffff",
        wordWrap: { width: 450 }
      })
      .setDepth(1091);
    this.historyPanelBg.setVisible(false);
    this.historyPanelText.setVisible(false);
    this.settingsPanelBg = scene.add.rectangle(540, 170, 380, 250, 0x15171b, 0.96).setDepth(1140);
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
        color: "#17191d",
        backgroundColor: "#d4d8df",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingLargeBtn = scene.add
      .text(540, 185, "Tipografia: Grande", {
        fontSize: "16px",
        color: "#17191d",
        backgroundColor: "#d4d8df",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingXLargeBtn = scene.add
      .text(540, 230, "Tipografia: Extra", {
        fontSize: "16px",
        color: "#17191d",
        backgroundColor: "#d4d8df",
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(1141)
      .setInteractive({ useHandCursor: true });
    this.settingNormalBtn.on("pointerdown", () => this.setTextMode("normal"));
    this.settingLargeBtn.on("pointerdown", () => this.setTextMode("large"));
    this.settingXLargeBtn.on("pointerdown", () => this.setTextMode("xlarge"));
    this.toggleSettings(false);
    this.confirmBg = scene.add.rectangle(512, 300, 560, 220, 0x15171b, 0.97).setDepth(1200);
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
        backgroundColor: "#d8a4a4",
        padding: { x: 12, y: 8 }
      })
      .setDepth(1201)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.confirmNo = scene.add
      .text(585, 340, "No", {
        fontSize: "20px",
        color: "#171717",
        backgroundColor: "#b4d8c2",
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
    const maxChars = this.scene.scale.width < 760 ? 28 : 64;
    const clipped = value.length > maxChars ? `${value.slice(0, maxChars - 1)}...` : value;
    this.queueLabel.setText(clipped);
  }

  clearSkillButtons(): void {
    this.skillButtons.forEach((btn) => btn.destroy());
    this.skillButtons.length = 0;
  }

  private clearPartyWidgets(): void {
    this.partyWidgets.forEach((widget) => widget.destroy());
    this.partyWidgets.length = 0;
    this.partyCardById.clear();
  }

  setPartySelectHandler(handler: ((targetId: string) => void) | null): void {
    this.partySelectHandler = handler;
  }

  renderParty(characters: Character[]): void {
    this.activeParty = [...characters];
    this.clearPartyWidgets();
    const partyUnits = characters.filter((unit) => unit.team === "player");
    if (partyUnits.length === 0) {
      return;
    }
    const sortedUnits = [...partyUnits].sort((a, b) => {
      const aSummon = a.id.startsWith("summon-");
      const bSummon = b.id.startsWith("summon-");
      if (aSummon === bSummon) return 0;
      return aSummon ? 1 : -1;
    });
    const metrics = this.getLayoutMetrics();
    const contentWidth = metrics.width - 24;
    const cardWidth = Math.max(106, Math.min(172, Math.floor(contentWidth / sortedUnits.length) - 8));
    const cardHeight = metrics.partyRowHeight - 12;
    const totalWidth = sortedUnits.length * cardWidth + (sortedUnits.length - 1) * 8;
    const startX = (metrics.width - totalWidth) / 2 + cardWidth / 2;
    const centerY = metrics.panelTop + metrics.controlsHeight + metrics.partyRowHeight / 2;

    sortedUnits.forEach((hero, index) => {
      const x = startX + index * (cardWidth + 8);
      const card = this.scene.add
        .rectangle(x, centerY, cardWidth, cardHeight, 0x3a3e46, 0.98)
        .setStrokeStyle(2, 0xb6bbc4)
        .setDepth(1001);
      if (hero.isAlive) {
        card.setInteractive({ useHandCursor: true });
        card.on("pointerdown", () => this.partySelectHandler?.(hero.id));
      } else {
        card.setAlpha(0.52);
      }
      this.partyWidgets.push(card);
      this.partyCardById.set(hero.id, card);

      const textureKey = this.getPortraitTextureKey(hero);
      if (textureKey && this.scene.textures.exists(textureKey)) {
        const portraitRadius = Math.floor(cardHeight * 0.36);
        const iconX = x - cardWidth * 0.32;
        const iconY = centerY - 2;
        const ring = this.scene.add
          .circle(iconX, iconY, portraitRadius + 3, 0x17191d, 1)
          .setStrokeStyle(2, 0xc4c9d2)
          .setDepth(1002);
        this.partyWidgets.push(ring);
        const icon = this.scene.add
          .image(iconX, iconY, textureKey)
          .setDisplaySize(portraitRadius * 2, portraitRadius * 2)
          .setDepth(1003);
        const iconMask = this.scene.add.graphics({ x: 0, y: 0 }).setVisible(false);
        iconMask.fillStyle(0xffffff);
        iconMask.fillCircle(iconX, iconY, portraitRadius);
        icon.setMask(iconMask.createGeometryMask());
        this.partyWidgets.push(iconMask);
        if (!hero.isAlive) {
          icon.setAlpha(0.45);
        }
        this.partyWidgets.push(icon);
      }

      const name = this.scene.add
        .text(x - cardWidth * 0.08, centerY - cardHeight * 0.24, hero.name, {
          fontSize: `${Math.max(11, Math.round((metrics.isCompact ? 11 : 12) * this.textScale))}px`,
          color: "#ffffff"
        })
        .setDepth(1002);
      const hpColor = hero.stats.hp / hero.stats.maxHp > 0.35 ? "#9df2b5" : "#ff9a9a";
      const hp = this.scene.add
        .text(x - cardWidth * 0.08, centerY + cardHeight * 0.02, `HP ${hero.stats.hp}/${hero.stats.maxHp}`, {
          fontSize: `${Math.max(10, Math.round((metrics.isCompact ? 10 : 11) * this.textScale))}px`,
          color: hpColor
        })
        .setDepth(1002);
      if (!hero.isAlive) {
        name.setColor("#9aa3bf");
        hp.setColor("#7d869f");
      }
      this.partyWidgets.push(name, hp);
    });
  }

  pulsePartyMember(targetId: string): void {
    const card = this.partyCardById.get(targetId);
    if (!card) {
      return;
    }
    const flash = this.scene.add
      .rectangle(card.x, card.y, card.width, card.height, 0xf0b4b4, 0.28)
      .setDepth(1010);
    this.partyWidgets.push(flash);
    this.scene.tweens.add({
      targets: [card],
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 90,
      yoyo: true
    });
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        flash.destroy();
        const idx = this.partyWidgets.indexOf(flash);
        if (idx >= 0) this.partyWidgets.splice(idx, 1);
      }
    });
  }

  renderSkills(skills: ISkill[], onClick: (skill: ISkill) => void): void {
    this.activeSkills = skills;
    this.activeSkillClick = onClick;
    this.clearSkillButtons();
    const metrics = this.getLayoutMetrics();
    const { width, isCompact } = metrics;
    const buttonWidth = isCompact ? 176 * this.textScale : 220 * this.textScale;
    const buttonHeight = isCompact ? 40 * this.textScale : 46 * this.textScale;
    const marginX = isCompact ? 12 : 16;
    const gapX = isCompact ? 8 : 10;
    const gapY = isCompact ? 8 : 10;
    const buttonsPerRow = Math.max(2, Math.floor((width - marginX * 2 + gapX) / (buttonWidth + gapX)));
    skills.forEach((skill, index) => {
      const row = Math.floor(index / buttonsPerRow);
      const col = index % buttonsPerRow;
      const x = marginX + col * (buttonWidth + gapX);
      const y = metrics.actionTop + 10 + row * (buttonHeight + gapY);
      const rect = this.scene.add
        .rectangle(x + buttonWidth / 2, y + buttonHeight / 2, buttonWidth, buttonHeight, 0x474c55, 1)
        .setStrokeStyle(2, 0xc0c5ce)
        .setDepth(1000)
        .setInteractive({ useHandCursor: true });
      const text = this.scene.add
        .text(x + 8, y + 8, `[${index + 1}] ${skill.nameEs}`, {
          fontSize: `${(isCompact ? 16 : 19) * this.textScale}px`,
          color: "#f4f5f7",
          wordWrap: { width: buttonWidth - 16 }
        })
        .setDepth(1001);
      rect.on("pointerdown", () => onClick(skill));
      rect.on("pointerover", () => rect.setFillStyle(0x565c67, 1));
      rect.on("pointerout", () => rect.setFillStyle(0x474c55, 1));
      this.skillButtons.push(rect, text);
    });

    if (skills.length === 0) {
      const placeholder = this.scene.add
        .text(marginX, metrics.actionTop + 12, "Esperando turno...", {
          fontSize: `${(isCompact ? 16 : 19) * this.textScale}px`,
          color: "#e0e3e9",
          backgroundColor: "#434852",
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
    const metrics = this.getLayoutMetrics();
    this.bottomPanel.setPosition(0, metrics.panelTop).setSize(metrics.width, metrics.bottomPanelHeight);
    this.partyPanel
      .setPosition(0, metrics.panelTop + metrics.controlsHeight)
      .setSize(metrics.width, metrics.partyRowHeight);
    this.actionPanel
      .setPosition(0, metrics.actionTop)
      .setSize(metrics.width, Math.max(48, metrics.bottomPanelHeight - (metrics.actionTop - metrics.panelTop)));
    this.turnLabel
      .setPosition(12, metrics.panelTop + metrics.controlsHeight + metrics.partyRowHeight + 6)
      .setFontSize(metrics.turnSize)
      .setWordWrapWidth(metrics.width - 24);
    this.logLabel
      .setPosition(12, metrics.panelTop + metrics.controlsHeight + metrics.partyRowHeight + metrics.turnSize + 12)
      .setFontSize(metrics.logSize)
      .setWordWrapWidth(metrics.width - 24);
    this.queueLabel
      .setPosition(12, metrics.panelTop + 8)
      .setFontSize(metrics.queueSize)
      .setWordWrapWidth(Math.max(140, metrics.width - 720));

    const controlsY = metrics.panelTop + 8;
    this.historyButton.setPosition(metrics.width - 220, controlsY).setFontSize(metrics.queueSize);
    this.abandonButton.setPosition(metrics.width - 490, controlsY).setFontSize(metrics.queueSize);
    this.settingsButton.setPosition(metrics.width - 620, controlsY).setFontSize(metrics.queueSize);
    this.historyPanelBg.setPosition(metrics.width * 0.5, Math.max(140, metrics.height * 0.28));
    this.historyPanelBg.setSize(Math.min(metrics.width * 0.9, 500), Math.min(metrics.height * 0.42, 330));
    this.historyPanelText
      .setPosition(this.historyPanelBg.x - this.historyPanelBg.width / 2 + 14, this.historyPanelBg.y - this.historyPanelBg.height / 2 + 12)
      .setFontSize((metrics.isCompact ? 13 : 15) * this.textScale)
      .setWordWrapWidth(this.historyPanelBg.width - 24);

    this.settingsPanelBg.setPosition(metrics.width * 0.5, Math.max(140, metrics.height * 0.28));
    this.settingsPanelBg.setSize(Math.min(metrics.width * 0.84, 420), Math.min(metrics.height * 0.42, 280));
    this.settingsTitle
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y - this.settingsPanelBg.height * 0.32)
      .setFontSize((metrics.isCompact ? 18 : 22) * this.textScale);
    const btnFont = (metrics.isCompact ? 14 : 16) * this.textScale;
    this.settingNormalBtn
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y - this.settingsPanelBg.height * 0.08)
      .setFontSize(btnFont);
    this.settingLargeBtn.setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y + this.settingsPanelBg.height * 0.1).setFontSize(btnFont);
    this.settingXLargeBtn
      .setPosition(this.settingsPanelBg.x, this.settingsPanelBg.y + this.settingsPanelBg.height * 0.28)
      .setFontSize(btnFont);

    const confirmWidth = Math.min(metrics.width * 0.88, 620);
    const confirmHeight = Math.min(metrics.height * 0.34, 240);
    this.confirmBg.setPosition(metrics.width / 2, metrics.height * 0.47).setSize(confirmWidth, confirmHeight);
    this.confirmText
      .setPosition(metrics.width / 2, this.confirmBg.y - 30)
      .setFontSize((metrics.isCompact ? 20 : 24) * this.textScale)
      .setWordWrapWidth(confirmWidth - 36);
    this.confirmYes
      .setPosition(metrics.width / 2 - 120, this.confirmBg.y + 64)
      .setFontSize((metrics.isCompact ? 18 : 20) * this.textScale);
    this.confirmNo
      .setPosition(metrics.width / 2 + 120, this.confirmBg.y + 64)
      .setFontSize((metrics.isCompact ? 18 : 20) * this.textScale);

    if (this.activeParty.length > 0) {
      this.renderParty(this.activeParty);
    }
    if (this.activeSkillClick) {
      this.renderSkills(this.activeSkills, this.activeSkillClick);
    }
  }

  private getLayoutMetrics(): {
    width: number;
    height: number;
    isCompact: boolean;
    bottomPanelHeight: number;
    panelTop: number;
    controlsHeight: number;
    partyRowHeight: number;
    infoHeight: number;
    actionTop: number;
    queueSize: number;
    turnSize: number;
    logSize: number;
  } {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const isCompact = width < 760;
    const bottomPanelHeight = Math.max(
      Math.round(230 + 80 * this.textScale),
      Math.floor(height * (0.42 + 0.08 * (this.textScale - 1)))
    );
    const panelTop = height - bottomPanelHeight;
    const controlsHeight = Math.max(52, Math.round(34 + 12 * this.textScale));
    const partyRowHeight = Math.max(96, Math.round(76 + 20 * this.textScale));
    const infoHeight = Math.max(Math.round(76 + 26 * this.textScale), isCompact ? 104 : 120);
    const actionTop = panelTop + controlsHeight + partyRowHeight + infoHeight;
    const queueSize = Math.min((isCompact ? 12 : 14) * this.textScale, isCompact ? 16 : 20);
    const turnSize = Math.min((isCompact ? 15 : 18) * this.textScale, isCompact ? 24 : 32);
    const logSize = Math.min((isCompact ? 13 : 16) * this.textScale, isCompact ? 22 : 28);
    return {
      width,
      height,
      isCompact,
      bottomPanelHeight,
      panelTop,
      controlsHeight,
      partyRowHeight,
      infoHeight,
      actionTop,
      queueSize,
      turnSize,
      logSize
    };
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

  private getPortraitTextureKey(character: Character): string | null {
    if (character.id.startsWith("summon-")) {
      if (character.name.toLowerCase().includes("serpiente")) return "summon_snake";
      if (character.name.toLowerCase().includes("oso")) return "summon_bear";
      return "summon_deer";
    }
    if (character.id.includes("swordsman")) return "player_swordsman";
    if (character.id.includes("tank")) return "player_tank";
    if (character.id.includes("mage")) return "player_mage";
    if (character.id.includes("healer")) return "player_healer";
    if (character.id.includes("ranger")) return "player_ranger";
    return null;
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
    this.onTypographyChanged();
    this.toggleSettings(false);
  }
}
