import Phaser from "phaser";
import { installViewportPan } from "../core/ViewportPan";
import { createInitialProgress, getAllTemplates } from "../core/GameData";
import { SaveService } from "../core/SaveService";
import type { RunState, Role } from "../core/types";
import { SCENE_BATTLE } from "./SceneKeys";

export class SelectionScene extends Phaser.Scene {
  private readonly saveService = new SaveService();
  private static readonly MENU_BGM_KEY = "bgm_main_menu";

  constructor() {
    super("selection");
  }

  preload(): void {
    this.load.image("sel_player_swordsman", "/assets/units/players/swordman.png");
    this.load.image("sel_player_tank", "/assets/units/players/tank.png");
    this.load.image("sel_player_mage", "/assets/units/players/mage.png");
    this.load.image("sel_player_healer", "/assets/units/players/healer.png");
    this.load.image("sel_player_ranger", "/assets/units/players/ranger.png");
    this.load.audio(SelectionScene.MENU_BGM_KEY, "/assets/efects/main_menu_-_dark.mp3");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0b1025");
    this.playMenuMusic();
    this.renderResponsive();
    this.scale.on("resize", () => this.renderResponsive());
    installViewportPan(this);
  }

  private renderResponsive(): void {
    this.children.removeAll(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 760;
    const titleSize = compact ? "32px" : "46px";
    const subtitleSize = compact ? "15px" : "20px";
    const padX = Math.max(12, width * 0.04);

    let y = Math.max(18, height * 0.04);
    this.add
      .text(width / 2, y, "PentaQuest", { fontSize: titleSize, color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0.5, 0);
    y += compact ? 44 : 56;
    this.add
      .text(width / 2, y, "Selecciona tu heroe inicial", { fontSize: subtitleSize, color: "#ffd37a", wordWrap: { width: width - padX * 2 }, align: "center" })
      .setOrigin(0.5, 0);
    y += compact ? 30 : 36;

    const save = this.saveService.load();
    if (save) {
      const continueBtn = this.add
        .text(width / 2, y, "[ Continuar partida ]", {
          fontSize: compact ? "17px" : "22px",
          color: "#6cf797",
          backgroundColor: "#133820",
          padding: { x: compact ? 12 : 16, y: compact ? 8 : 9 }
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      continueBtn.on("pointerdown", () => {
        this.stopMenuMusic();
        this.scene.start(SCENE_BATTLE, { runState: save });
      });
      y += continueBtn.height + 20;
    } else {
      y += 12;
    }

    const templates = getAllTemplates();
    const columns = width >= 980 ? 5 : width >= 680 ? 3 : 2;
    const rows = Math.ceil(templates.length / columns);
    const cardWidth = Math.min(compact ? 142 : 150, Math.floor((width - padX * 2) / columns) - 10);
    const cardHeight = compact ? 196 : 208;
    const gapX = Math.max(10, Math.floor((width - columns * cardWidth) / (columns + 1)));
    const topY = y + 16;
    const bottomReserve = Math.min(100, height * 0.08);
    const rawGapY = Math.floor((height - bottomReserve - topY - rows * cardHeight) / Math.max(1, rows - 1));
    const gapY = Math.max(10, Math.min(26, rawGapY));

    const portraitPx = compact ? 70 : 88;

    templates.forEach((template, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = gapX + cardWidth / 2 + col * (cardWidth + gapX);
      const cy = topY + row * (cardHeight + gapY) + cardHeight / 2;
      this.add.rectangle(x, cy, cardWidth, cardHeight, 0x1a2238, 1).setStrokeStyle(2, 0x35508a).setDepth(0);
      this.add
        .text(x, cy - cardHeight * 0.42, template.nameEs, {
          fontSize: compact ? "13px" : "16px",
          color: "#ffffff",
          align: "center",
          wordWrap: { width: cardWidth - 10 }
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2);
      const textureKey = this.getSelectionTextureKey(template.role);
      if (this.textures.exists(textureKey)) {
        this.add
          .image(x, cy - cardHeight * 0.06, textureKey)
          .setDisplaySize(portraitPx, portraitPx)
          .setDepth(1);
      }

      this.add
        .text(x, cy + cardHeight * 0.28, `HP ${template.baseStats.maxHp}\nATK ${template.baseStats.attack}\nDEF ${template.baseStats.defense}`, {
          fontSize: compact ? "11px" : "12px",
          color: "#d2ddff",
          align: "center",
          lineSpacing: 2
        })
        .setOrigin(0.5, 0.5)
        .setDepth(2);

      const btn = this.add
        .text(x, cy + cardHeight * 0.4, "Elegir", {
          fontSize: compact ? "12px" : "14px",
          color: "#121212",
          backgroundColor: "#ffd37a",
          padding: { x: compact ? 10 : 12, y: compact ? 6 : 7 }
        })
        .setOrigin(0.5, 0.5)
        .setDepth(3)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => this.startNewRun(template.role));
    });
  }

  private getSelectionTextureKey(role: Role): string {
    if (role === "swordsman") return "sel_player_swordsman";
    if (role === "tank") return "sel_player_tank";
    if (role === "mage") return "sel_player_mage";
    if (role === "healer") return "sel_player_healer";
    return "sel_player_ranger";
  }

  private startNewRun(role: Role): void {
    const runState: RunState = {
      floor: 1,
      bestFloor: 1,
      roster: [createInitialProgress(role)],
      logHistory: ["Partida iniciada."]
    };
    this.saveService.save(runState);
    this.stopMenuMusic();
    this.scene.start(SCENE_BATTLE, { runState });
  }

  private playMenuMusic(): void {
    const existing = this.sound.get(SelectionScene.MENU_BGM_KEY);
    if (existing?.isPlaying) {
      return;
    }
    if (!this.sound.locked) {
      this.sound.play(SelectionScene.MENU_BGM_KEY, { loop: true, volume: 0.45 });
    }
  }

  private stopMenuMusic(): void {
    this.sound.stopByKey(SelectionScene.MENU_BGM_KEY);
  }
}
