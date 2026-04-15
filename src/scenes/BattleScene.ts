import Phaser from "phaser";
import {
  createInitialProgress,
  getEnemyStatsByFloor,
  getRandomItem,
  getTemplate,
  mergeBonus
} from "../core/GameData";
import { SaveService } from "../core/SaveService";
import type { Role, RunState } from "../core/types";
import { ALL_ROLES } from "../core/types";
import { getTypographyScale, loadTypographyMode } from "../core/AccessibilitySettings";
import { Enemy, type EnemyKind } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { SummonAlly, type SummonType } from "../entities/SummonAlly";
import type { Character } from "../entities/Character";
import { SKILLS } from "../skills/SkillImplementations";
import type { ISkill, SkillContext } from "../skills/ISkill";
import { installViewportPan } from "../core/ViewportPan";
import { HUD } from "../ui/HUD";
import { SCENE_GAME_OVER, SCENE_SELECTION } from "./SceneKeys";

type TurnPhase = "idle" | "player_select_skill" | "player_select_target" | "enemy_action" | "resolving";

interface VisualNode {
  body: Phaser.GameObjects.Shape;
  icon: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  targetZone: Phaser.GameObjects.Rectangle;
  iconMask?: Phaser.GameObjects.Graphics;
}

const SFX = {
  SUMMON_BELL: "sfx_summon_bell",
  HEAL: "sfx_heal",
  HIT: "sfx_hit",
  SWORD: "sfx_sword",
  FIREBALL: "sfx_fireball",
  ARROW: "sfx_arrow"
} as const;
const SFX_HIT_SKIP_SEC = 4;
const SFX_ARROW_SKIP_SEC = 4;
const SFX_SWORD_SKIP_END_SEC = 3;
const SFX_SWORD_SKIP_SEC = 1;
const SFX_SLIME_BALL_SKIP_SEC = 4;

export class BattleScene extends Phaser.Scene {
  private readonly saveService = new SaveService();
  private readonly maxEnemiesOnField = 8;
  private readonly maxSummonsPerMage = 2;
  private runState!: RunState;
  private players: Character[] = [];
  private enemies: Enemy[] = [];
  private enemyWave: Enemy[] = [];
  private enemyWaveIndex = 0;
  private enemyCounter = 1;
  private visuals = new Map<string, VisualNode>();
  private arenaObjects: Phaser.GameObjects.GameObject[] = [];
  private turnQueue: Character[] = [];
  private turnIndex = 0;
  private phase: TurnPhase = "idle";
  private hud!: HUD;
  private selectedSkill: ISkill | null = null;
  private actorInTurn: Character | null = null;
  private recruitmentOverlay: Phaser.GameObjects.GameObject[] = [];
  private summonCooldownByCasterId = new Map<string, number>();
  private skeletonSummonCooldownByEnemyId = new Map<string, number>();
  private pendingTurnGateMs = 0;
  private battleSpeed2x = false;

  private static readonly BGM_COMBAT_KEY = "bgm_combat";
  private static readonly BGM_COMBAT_MARKER = "combat_loop";
  private static readonly BGM_COMBAT_INTRO_SKIP_SEC = 15;
  private static readonly BGM_COMBAT_VOLUME = 0.1;

  constructor() {
    super("battle");
  }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
  }

  preload(): void {
    this.load.image("player_swordsman", "/assets/units/players/swordman.png");
    this.load.image("player_tank", "/assets/units/players/tank.png");
    this.load.image("player_mage", "/assets/units/players/mage.png");
    this.load.image("player_healer", "/assets/units/players/healer.png");
    this.load.image("player_ranger", "/assets/units/players/ranger.png");

    this.load.image("enemy_slime", "/assets/units/enemies/slime.png");
    this.load.image("enemy_slime_blob", "/assets/units/enemies/slime_blob.png");
    this.load.image("enemy_skeleton_mage", "/assets/units/enemies/skeleton-mague.png");
    this.load.image("enemy_skeleton_minion", "/assets/units/enemies/skeleton_minion.png");
    this.load.image("enemy_demon", "/assets/units/enemies/demon.png");

    this.load.image("summon_snake", "/assets/units/summons/snake-summon.png");
    this.load.image("summon_bear", "/assets/units/summons/bear-summon.png");
    this.load.image("summon_deer", "/assets/units/summons/deer-summon.png");

    this.load.audio(SFX.SUMMON_BELL, "/assets/efects/Campana de invocacion.mp3");
    this.load.audio(SFX.HEAL, "/assets/efects/curación.mp3");
    this.load.audio(SFX.HIT, "/assets/efects/Sonido de golpe   efecto de sonido.mp3");
    this.load.audio(SFX.SWORD, "/assets/efects/Sonido De espada Sonido Edit.mp3");
    this.load.audio(SFX.FIREBALL, "/assets/efects/sound effect  de gran bola de fuego.mp3");
    this.load.audio(SFX.ARROW, "/assets/efects/ARCO Y FLECHA efecto de sonido.mp3");
    this.load.audio(BattleScene.BGM_COMBAT_KEY, "/assets/songs/combat/combate_music.mp3");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#23262c");
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.stopCombatMusic, this);
    this.startCombatMusic();
    this.hud = new HUD(
      this,
      () => this.abandonRun(),
      () => this.renderCurrentWaveVisuals(),
      () => this.getBattlePace(),
      (enabled) => this.setBattleSpeed2x(enabled)
    );
    this.hud.setPartySelectHandler((targetId) => this.onPartyTargetClick(targetId));
    this.buildFloor();
    this.startBattle();
    this.scale.on("resize", () => {
      this.hud.layout();
      this.renderCurrentWaveVisuals();
    });
    installViewportPan(this);
  }

  private readonly onCombatBgmComplete = (): void => {
    if (!this.scene.isActive()) {
      return;
    }
    const music = this.sound.get(BattleScene.BGM_COMBAT_KEY);
    const marker = BattleScene.BGM_COMBAT_MARKER;
    if (!music?.markers[marker]) {
      return;
    }
    music.play(marker);
    this.applyBattleMusicPlaybackRate();
  };

  private startCombatMusic(): void {
    const key = BattleScene.BGM_COMBAT_KEY;
    const marker = BattleScene.BGM_COMBAT_MARKER;
    let music = this.sound.get(key);
    if (!music) {
      music = this.sound.add(key);
    }
    const markerDef = {
      name: marker,
      start: BattleScene.BGM_COMBAT_INTRO_SKIP_SEC,
      /** Sin `loop` nativo: en HTML5 `<audio loop>` ignora el marcador y vuelve al 0. */
      config: { loop: false, volume: BattleScene.BGM_COMBAT_VOLUME }
    };
    if (music.markers[marker]) {
      music.removeMarker(marker);
    }
    music.addMarker(markerDef);
    music.off(Phaser.Sound.Events.COMPLETE, this.onCombatBgmComplete);
    music.on(Phaser.Sound.Events.COMPLETE, this.onCombatBgmComplete);
    const start = (): void => {
      if (music.isPlaying) {
        return;
      }
      music.play(marker);
      this.applyBattleMusicPlaybackRate();
    };
    if (!this.sound.locked) {
      start();
    } else {
      this.sound.once(Phaser.Sound.Events.UNLOCKED, start);
    }
  }

  private stopCombatMusic(): void {
    const key = BattleScene.BGM_COMBAT_KEY;
    const music = this.sound.get(key);
    music?.off(Phaser.Sound.Events.COMPLETE, this.onCombatBgmComplete);
    this.sound.stopByKey(key);
  }

  private getBattlePace(): number {
    return this.battleSpeed2x ? 2 : 1;
  }

  private setBattleSpeed2x(enabled: boolean): void {
    this.battleSpeed2x = enabled;
    this.applyBattleMusicPlaybackRate();
  }

  private scaleBattleMs(ms: number): number {
    if (!this.battleSpeed2x) {
      return ms;
    }
    return Math.max(80, Math.round(ms / 2));
  }

  private applyBattleMusicPlaybackRate(): void {
    const m = this.sound.get(BattleScene.BGM_COMBAT_KEY) as
      | (Phaser.Sound.BaseSound & { setRate?: (r: number) => void })
      | undefined;
    if (!m?.isPlaying || typeof m.setRate !== "function") {
      return;
    }
    m.setRate(this.battleSpeed2x ? 2 : 1);
  }

  private buildFloor(): void {
    this.normalizeRosterSkillLoadout();
    this.players = this.runState.roster.map((progress) => new Player(progress));
    this.summonCooldownByCasterId.clear();
    this.skeletonSummonCooldownByEnemyId.clear();
    this.enemyCounter = 1;

    this.enemyWave = [
      this.createMainWaveEnemy("slime", "Slime", 1),
      this.createMainWaveEnemy("skeleton_mage", "Mago Esqueleto", 1.35),
      this.createMainWaveEnemy("demon", "Demonio", 1.75)
    ];
    this.enemyWaveIndex = 0;
    this.enemies = [this.enemyWave[this.enemyWaveIndex]!];
    this.renderCurrentWaveVisuals();
  }

  private normalizeRosterSkillLoadout(): void {
    this.runState.roster.forEach((progress) => {
      if (progress.role !== "swordsman") {
        return;
      }
      const hasSlash = progress.unlockedSkillIds.includes("slash");
      const hasExecute = progress.unlockedSkillIds.includes("execute");
      const hasWhirlwind = progress.unlockedSkillIds.includes("whirlwind");
      if (hasSlash && hasExecute && hasWhirlwind) {
        progress.unlockedSkillIds = ["slash", "whirlwind", "execute"];
        return;
      }
      if (hasSlash && hasExecute && !hasWhirlwind) {
        progress.unlockedSkillIds = ["slash", "execute"];
        return;
      }
      if (hasSlash && !hasExecute && hasWhirlwind) {
        progress.unlockedSkillIds = ["slash", "whirlwind"];
      }
    });
  }

  private createMainWaveEnemy(kind: EnemyKind, name: string, ratio: number): Enemy {
    const base = getEnemyStatsByFloor(this.runState.floor);
    const difficultyMultiplier = this.getRosterDifficultyMultiplier();
    const unitNerf = kind === "demon" ? 0.5 : 1;
    return new Enemy(
      `enemy-main-${this.enemyCounter++}`,
      name,
      {
        ...base,
        maxHp: Math.max(1, Math.round(base.maxHp * ratio * difficultyMultiplier * unitNerf)),
        hp: Math.max(1, Math.round(base.maxHp * ratio * difficultyMultiplier * unitNerf)),
        attack: Math.max(1, Math.round(base.attack * ratio * difficultyMultiplier * unitNerf)),
        defense: Math.max(
          1,
          Math.round(base.defense * (1 + (ratio - 1) * 0.45) * difficultyMultiplier * unitNerf)
        ),
        magic: Math.max(0, Math.round(base.magic * ratio * difficultyMultiplier * unitNerf)),
        speed: Math.max(1, Math.round(base.speed * (1 + (difficultyMultiplier - 1) * 0.18) * unitNerf))
      },
      kind,
      true
    );
  }

  private renderCurrentWaveVisuals(): void {
    const { width, battleHeight } = this.getViewport();
    this.drawArenaByCurrentWave();
    this.visuals.forEach((node) => {
      node.body.destroy();
      node.icon.destroy();
      node.name.destroy();
      node.hp.destroy();
      node.targetZone.destroy();
      node.iconMask?.destroy();
    });
    this.visuals.clear();

    const enemyLayout = this.getEnemyLayout(this.enemies.length);
    this.enemies.forEach((enemy, index) => {
      const color = enemy.isMainWaveEnemy ? 0x4a1f2f : 0x352544;
      const slot = enemyLayout[index];
      if (!slot) {
        return;
      }
      this.createVisual(enemy, slot.x, slot.y, color, this.getEmoji(enemy), slot.scale);
    });

    // Evita que unidades se dibujen sobre el panel inferior.
    this.visuals.forEach((node) => {
      if (node.body.y > battleHeight - 25) {
        node.body.y = battleHeight - 25;
        node.icon.y = node.body.y;
        node.name.y = node.body.y + 78;
        node.targetZone.y = node.body.y;
        node.hp.setPosition(node.icon.x, node.icon.y + 12);
        node.iconMask?.destroy();
        if (node.icon instanceof Phaser.GameObjects.Image) {
          const iconMask = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
          const radius = Math.max(20, Math.floor(Math.min(node.icon.displayWidth, node.icon.displayHeight) / 2) - 3);
          iconMask.fillStyle(0xffffff);
          iconMask.fillCircle(node.icon.x, node.icon.y, radius);
          node.icon.setMask(iconMask.createGeometryMask());
          node.iconMask = iconMask;
        }
      }
      if (node.body.x < 40) {
        const delta = 40 - node.body.x;
        node.body.x += delta;
        node.icon.x += delta;
        node.name.x += delta;
        node.hp.x += delta;
        node.targetZone.x += delta;
      } else if (node.body.x > width - 40) {
        const delta = node.body.x - (width - 40);
        node.body.x -= delta;
        node.icon.x -= delta;
        node.name.x -= delta;
        node.hp.x -= delta;
        node.targetZone.x -= delta;
      }
    });
  }

  private createVisual(
    character: Character,
    x: number,
    y: number,
    color: number,
    emoji: string,
    visualScale = 1
  ): void {
    const typographyScale = this.getTypographyScale();
    const bodySize = Math.round(124 * visualScale);
    const bodyRadiusPx = Math.floor(bodySize * 0.5);
    const nameSize = Math.max(11, Math.round(13 * visualScale * typographyScale));
    const hpSize = Math.max(12, Math.round(14 * visualScale * typographyScale));
    const targetWidth = Math.round(124 * visualScale);
    const targetHeight = Math.round(124 * visualScale);

    const maxImgSide = Math.max(44, Math.floor(bodyRadiusPx * Math.SQRT2) - 10);
    const rawIcon = this.getIconDisplaySize(character, visualScale);
    const fittedSide = Math.min(rawIcon, maxImgSide);
    const maskR = Math.max(22, bodyRadiusPx - 6);

    const body = this.add
      .circle(x, y, bodyRadiusPx, 0x2f333a, 0.58)
      .setStrokeStyle(2, 0xbec4cf)
      .setDepth(30);
    const textureKey = this.getTextureKey(character);
    const { icon, iconMask } = this.createIconVisual(textureKey, emoji, x, y, fittedSide, maskR);
    const name = this.add
      .text(x, y + 84 * visualScale, character.name, { fontSize: `${nameSize}px`, color: "#eceef2" })
      .setOrigin(0.5)
      .setDepth(32);
    const hpLift = Math.round(10 * visualScale);
    const hp = this.add
      .text(icon.x, icon.y + hpLift, `${character.stats.hp}/${character.stats.maxHp}`, {
        fontSize: `${hpSize}px`,
        color: "#d4ffe6",
        fontStyle: "bold",
        stroke: "#05070c",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(36);
    const targetZone = this.add
      .rectangle(x, y, targetWidth, targetHeight, 0xffffff, 0.01)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    targetZone.on("pointerdown", () => this.onTargetClick(character));
    this.visuals.set(character.id, { body, icon, name, hp, targetZone, iconMask });
    this.paintCharacterState(character);
  }

  private getIconDisplaySize(character: Character, visualScale: number): number {
    if (character instanceof SummonAlly) {
      return Math.max(82, Math.round(112 * visualScale));
    }
    if (character.team === "enemy" && character instanceof Enemy) {
      if (character.isMainWaveEnemy) {
        return Math.max(92, Math.round(126 * visualScale));
      }
      return Math.max(78, Math.round(104 * visualScale));
    }
    return Math.max(92, Math.round(122 * visualScale));
  }

  private createIconVisual(
    textureKey: string | null,
    fallbackEmoji: string,
    x: number,
    y: number,
    iconSize: number,
    maskRadius?: number
  ): { icon: Phaser.GameObjects.Text | Phaser.GameObjects.Image; iconMask?: Phaser.GameObjects.Graphics } {
    if (textureKey && this.textures.exists(textureKey)) {
      const icon = this.add.image(x, y, textureKey).setDisplaySize(iconSize, iconSize).setDepth(31);
      const iconMask = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
      iconMask.fillStyle(0xffffff);
      const r = maskRadius ?? Math.max(18, Math.floor(iconSize * 0.48));
      iconMask.fillCircle(x, y, r);
      icon.setMask(iconMask.createGeometryMask());
      return { icon, iconMask };
    }
    const icon = this.add
      .text(x, y, fallbackEmoji, { fontSize: `${iconSize}px` })
      .setOrigin(0.5)
      .setDepth(31);
    return { icon };
  }

  private getEnemyLayout(count: number): Array<{ x: number; y: number; scale: number }> {
    if (count <= 0) {
      return [];
    }
    const { width, battleHeight, isCompact } = this.getViewport();
    const topCount = Math.ceil(count / 2);
    const bottomCount = count - topCount;
    const maxRowCount = Math.max(topCount, bottomCount, 1);

    // Ocupa todo el campo: enemigos grandes al inicio, luego se reducen por densidad.
    const scale = (count <= 2 ? 1.14 : count <= 4 ? 0.98 : count <= 6 ? 0.84 : 0.68) * (isCompact ? 0.84 : 1);
    const maxWidth = Math.max(320, width - 60);
    const spacing =
      maxRowCount <= 1
        ? 0
        : Math.max(66, Math.min(145, Math.floor(maxWidth / (maxRowCount - 1))));

    const buildRow = (rowCount: number, y: number): Array<{ x: number; y: number; scale: number }> => {
      if (rowCount <= 0) {
        return [];
      }
      const startX = width / 2 - ((rowCount - 1) * spacing) / 2;
      return Array.from({ length: rowCount }, (_, i) => ({
        x: startX + i * spacing,
        y,
        scale
      }));
    };

    const topRowY = Math.max(isCompact ? 118 : 96, Math.floor(battleHeight * 0.26));
    const bottomRowY = Math.max(topRowY + 88, Math.floor(battleHeight * 0.6));
    const topRow = buildRow(topCount, topRowY);
    const bottomRow = buildRow(bottomCount, bottomRowY);
    return [...topRow, ...bottomRow];
  }

  private paintCharacterState(character: Character): void {
    const node = this.visuals.get(character.id);
    if (!node) return;
    node.hp.setText(`${character.stats.hp}/${character.stats.maxHp}`);
    node.hp.setPosition(node.icon.x, node.icon.y + 12);
    if (!character.isAlive) {
      node.body.setAlpha(0.35);
      node.icon.setAlpha(0.45);
      node.name.setColor("#888888");
      node.hp.setColor("#666666");
      return;
    }
    node.body.setAlpha(1);
    node.icon.setAlpha(1);
    node.name.setColor("#ffffff");
    const ratio = character.stats.hp / character.stats.maxHp;
    if (ratio > 0.5) node.hp.setColor("#8df6a0");
    else if (ratio > 0.2) node.hp.setColor("#ffd37a");
    else node.hp.setColor("#ff8181");
  }

  private startBattle(): void {
    this.turnQueue = [...this.players, ...this.enemies].sort((a, b) => b.stats.speed - a.stats.speed);
    this.turnIndex = 0;
    this.processTurn();
  }

  private processTurn(): void {
    this.cleanupInput();
    this.selectedSkill = null;
    this.hud.renderSkills([], () => undefined);
    if (this.players.every((p) => !p.isAlive)) {
      this.finishRun();
      return;
    }
    if (this.enemies.every((e) => !e.isAlive)) {
      this.onEnemyDefeated();
      return;
    }

    const aliveQueue = this.turnQueue.filter((unit) => unit.isAlive);
    if (aliveQueue.length === 0) {
      this.finishRun();
      return;
    }
    if (this.turnIndex >= aliveQueue.length) {
      this.turnQueue = [...this.players, ...this.enemies].sort((a, b) => b.stats.speed - a.stats.speed);
      this.turnIndex = 0;
    } else {
      this.turnQueue = aliveQueue;
    }

    this.actorInTurn = this.turnQueue[this.turnIndex] ?? null;
    if (!this.actorInTurn) {
      return;
    }
    this.hud.setQueue(`Siguiente: ${this.turnQueue.map((u) => u.name).join(" > ")}`);
    this.hud.renderTeamInfo(this.actorInTurn);
    this.hud.renderParty(this.players);

    if (this.actorInTurn.team === "enemy") {
      this.phase = "enemy_action";
      this.runEnemyAction(this.actorInTurn as Enemy);
      return;
    }

    if (this.actorInTurn instanceof SummonAlly) {
      this.phase = "resolving";
      this.runSummonAction(this.actorInTurn);
      return;
    }

    this.phase = "player_select_skill";
    const actor = this.actorInTurn as Player;
    this.tickSummonCooldownForMageTurn(actor);
    const skills = actor.progress.unlockedSkillIds
      .map((id) => SKILLS[id])
      .filter((skill): skill is ISkill => skill !== undefined);
    this.hud.setLog(`Turno de ${actor.name}. Elige habilidad (mouse o teclas 1-9).`);
    this.hud.renderSkills(skills, (skill) => this.onSkillSelected(skill));

    this.input.keyboard?.once("keydown", (event: KeyboardEvent) => {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= skills.length) {
        const picked = skills[n - 1];
        if (picked) this.onSkillSelected(picked);
      }
    });
  }

  private onSkillSelected(skill: ISkill): void {
    if (
      (this.phase !== "player_select_skill" && this.phase !== "player_select_target") ||
      !this.actorInTurn ||
      !(this.actorInTurn instanceof Player)
    ) {
      return;
    }

    const wasTargetSelection = this.phase === "player_select_target";
    const wasSameSkill = this.selectedSkill?.id === skill.id;
    this.selectedSkill = skill;
    const actor = this.actorInTurn as Player;
    const allies = this.players;
    const enemies = this.enemies.filter((enemy) => enemy.isAlive);
    const context: SkillContext = { caster: actor, allies, enemies, targets: [] };

    if (!skill.canUse(context)) {
      this.hud.setLog("No puedes usar esta habilidad en este momento.");
      return;
    }

    if (skill.targetType === "single_enemy") {
      this.phase = "player_select_target";
      this.hud.setLog(
        `${skill.nameEs}: ${skill.descriptionEs} Apunta a un enemigo o elige otra habilidad.`
      );
      return;
    }

    if (skill.targetType === "single_ally") {
      this.phase = "player_select_target";
      this.hud.setLog(
        `${skill.nameEs}: ${skill.descriptionEs} Apunta a un aliado o elige otra habilidad.`
      );
      return;
    }

    this.phase = "player_select_target";
    if (!wasTargetSelection || !wasSameSkill) {
      this.hud.setLog(
        `${skill.nameEs}: ${skill.descriptionEs} Haz click otra vez en la misma habilidad para confirmar o elige otra.`
      );
      return;
    }

    if (skill.id === "summon_storm" && actor.progress.role === "mage") {
      const cooldown = this.summonCooldownByCasterId.get(actor.id) ?? 0;
      if (cooldown > 0) {
        this.hud.setLog(`Invocacion en enfriamiento: ${cooldown} turno(s) restantes.`);
        return;
      }
      const activeSummons = this.players.filter(
        (player) => player instanceof SummonAlly && player.ownerId === actor.id && player.isAlive
      ).length;
      if (activeSummons >= this.maxSummonsPerMage) {
        this.hud.setLog(`Ya tienes ${this.maxSummonsPerMage} invocaciones activas.`);
        return;
      }
      this.resolveMageSummon(actor);
      return;
    }

    if (skill.targetType === "self") {
      this.resolvePlayerAction([actor]);
      return;
    }
    if (skill.targetType === "all_enemies") {
      this.resolvePlayerAction(enemies.filter((e) => e.isAlive));
      return;
    }
    if (skill.targetType === "all_allies") {
      this.resolvePlayerAction(allies);
      return;
    }

    this.hud.setLog("Selecciona un objetivo valido o elige otra habilidad.");
  }

  private onTargetClick(target: Character): void {
    if (this.phase !== "player_select_target" || !this.selectedSkill || !this.actorInTurn) {
      return;
    }
    if (!target.isAlive) {
      return;
    }
    if (this.selectedSkill.targetType === "single_enemy" && target.team !== "enemy") {
      return;
    }
    if (this.selectedSkill.targetType === "single_ally" && target.team !== "player") {
      return;
    }
    this.resolvePlayerAction([target]);
  }

  private onPartyTargetClick(targetId: string): void {
    if (this.phase !== "player_select_target" || !this.selectedSkill || !this.actorInTurn) {
      return;
    }
    if (this.selectedSkill.targetType !== "single_ally") {
      return;
    }
    const target = this.players.find((unit) => unit.id === targetId);
    if (!target || !target.isAlive) {
      return;
    }
    this.resolvePlayerAction([target]);
  }

  private resolvePlayerAction(targets: Character[]): void {
    if (!this.selectedSkill || !this.actorInTurn) return;
    this.phase = "resolving";
    const caster = this.actorInTurn;
    const enemyHpBefore = new Map<string, number>();
    this.enemies.forEach((enemy) => enemyHpBefore.set(enemy.id, enemy.stats.hp));
    const allies = caster.team === "player" ? this.players : this.enemies;
    const enemies = caster.team === "player" ? this.enemies : this.players;
    const result = this.selectedSkill.execute({ caster, allies, enemies, targets });
    this.playSkillSound(caster, this.selectedSkill.id);
    const extraLogs = this.handleSlimeSplitAfterHit(enemyHpBefore);
    this.afterAction([...result.logs, ...extraLogs], 1400, caster, targets);
  }

  private resolveMageSummon(caster: Player): void {
    const summonType = this.pickSummonType();
    const summon = this.createMageSummon(caster, summonType);
    this.players.push(summon);
    this.summonCooldownByCasterId.set(caster.id, 3);
    if (summonType === "healer") {
      this.queueTurnSound(SFX.HEAL, 0.65);
    } else {
      this.queueTurnSound(SFX.SUMMON_BELL, 0.65);
    }
    this.renderCurrentWaveVisuals();
    this.afterAction([`${caster.name} invoca ${summon.name}.`], 1450, caster, [summon]);
  }

  private pickSummonType(): SummonType {
    const roll = Math.random();
    if (roll < 0.6) {
      return "snake";
    }
    if (roll < 0.9) {
      return "bear";
    }
    return "healer";
  }

  private createMageSummon(caster: Player, summonType: SummonType): SummonAlly {
    const floorScale = 1 + this.runState.floor * 0.03;
    if (summonType === "snake") {
      const snakeNerf = 0.8;
      return new SummonAlly(
        `summon-${this.enemyCounter++}`,
        "Serpiente",
        {
          maxHp: Math.round(150 * floorScale * snakeNerf),
          hp: Math.round(150 * floorScale * snakeNerf),
          attack: Math.round(44 * floorScale * snakeNerf),
          magic: 0,
          defense: Math.round(14 * floorScale * snakeNerf),
          speed: Math.round(18 * floorScale * snakeNerf),
          healPower: 0
        },
        caster.id,
        summonType
      );
    }
    if (summonType === "bear") {
      return new SummonAlly(
        `summon-${this.enemyCounter++}`,
        "Oso Guardian",
        {
          maxHp: Math.round(230 * floorScale),
          hp: Math.round(230 * floorScale),
          attack: Math.round(26 * floorScale),
          magic: 0,
          defense: Math.round(24 * floorScale),
          speed: Math.round(10 * floorScale),
          healPower: 0
        },
        caster.id,
        summonType
      );
    }
    return new SummonAlly(
      `summon-${this.enemyCounter++}`,
      "Ciervo Espiritual",
      {
        maxHp: Math.round(130 * floorScale),
        hp: Math.round(130 * floorScale),
        attack: Math.round(10 * floorScale),
        magic: Math.round(22 * floorScale),
        defense: Math.round(12 * floorScale),
        speed: Math.round(14 * floorScale),
        healPower: Math.round(32 * floorScale)
      },
      caster.id,
      summonType
    );
  }

  private runSummonAction(summon: SummonAlly): void {
    if (!summon.isAlive) {
      this.afterAction([`${summon.name} no puede actuar.`], 700, summon, []);
      return;
    }

    if (summon.summonType === "healer") {
      const allyTarget =
        this.players
          .filter((ally) => ally.isAlive && ally.stats.hp < ally.stats.maxHp)
          .sort((a, b) => a.stats.hp / a.stats.maxHp - b.stats.hp / b.stats.maxHp)[0] ?? summon;
      const healed = allyTarget.heal(Math.round(summon.stats.healPower * 0.9));
      this.queueTurnSound(SFX.HEAL, 0.62);
      this.afterAction(
        [`${summon.name} cura a ${allyTarget.name} por ${healed}.`],
        1200,
        summon,
        [allyTarget]
      );
      return;
    }

    const enemyTarget = this.enemies.filter((enemy) => enemy.isAlive)[0];
    if (!enemyTarget) {
      this.afterAction([`${summon.name} no encuentra objetivo.`], 700, summon, []);
      return;
    }

    if (summon.summonType === "bear") {
      if (Math.random() < 0.5) {
        summon.tauntTurns = 1;
        this.queueTurnSound(SFX.SWORD, 0.62, SFX_SWORD_SKIP_SEC, SFX_SWORD_SKIP_END_SEC);
        this.afterAction([`${summon.name} provoca para proteger al equipo.`], 1200, summon, [summon]);
        return;
      }
      const dealt = enemyTarget.receiveDamage(Math.round(summon.stats.attack * 0.7));
      this.queueTurnSound(SFX.HIT, 0.62, SFX_HIT_SKIP_SEC);
      this.afterAction([`${summon.name} embiste a ${enemyTarget.name} por ${dealt}.`], 1200, summon, [enemyTarget]);
      return;
    }

    const strongHit = Math.random() < 0.45;
    const ratio = strongHit ? 1.05 : 0.85;
    const dealt = enemyTarget.receiveDamage(Math.round(summon.stats.attack * ratio));
    const moveName = strongHit ? "Colmillo Venenoso" : "Mordisco";
    this.queueTurnSound(SFX.HIT, 0.62, SFX_HIT_SKIP_SEC);
    this.afterAction(
      [`${summon.name} usa ${moveName} sobre ${enemyTarget.name} (${dealt}).`],
      1200,
      summon,
      [enemyTarget]
    );
  }

  private runEnemyAction(enemy: Enemy): void {
    if (enemy.kind === "skeleton_mage") {
      const currentCooldown = this.skeletonSummonCooldownByEnemyId.get(enemy.id) ?? 0;
      if (currentCooldown > 0) {
        this.skeletonSummonCooldownByEnemyId.set(enemy.id, currentCooldown - 1);
      }
    }

    if (enemy.kind === "skeleton_mage" && this.shouldSkeletonMageSummon(enemy)) {
      const logs = this.summonSkeletonMinions();
      this.skeletonSummonCooldownByEnemyId.set(enemy.id, 3);
      this.queueTurnSound(SFX.SUMMON_BELL, 0.66);
      this.afterAction(logs, 1400, enemy, []);
      return;
    }
    if (
      enemy.kind === "demon" &&
      enemy.shouldTriggerDemonSummon() &&
      this.enemies.length < this.maxEnemiesOnField
    ) {
      const helper = this.createDemonRoomSupportEnemy();
      this.enemies.push(helper);
      this.renderCurrentWaveVisuals();
      this.afterAction([`${enemy.name} invoca apoyo: ${helper.name}.`], 1450, enemy, []);
      return;
    }

    const alivePlayers = this.players.filter((p) => p.isAlive);
    if (alivePlayers.length === 0) {
      this.finishRun();
      return;
    }
    const taunted = alivePlayers.filter((p) => p.tauntTurns > 0);
    const targetPool = taunted.length > 0 ? taunted : alivePlayers;
    const target = targetPool[Math.floor(Math.random() * targetPool.length)] ?? targetPool[0];
    if (!target) {
      this.finishRun();
      return;
    }
    if (target.evadeTurns > 0) {
      target.evadeTurns -= 1;
      const dodged = Math.random() < target.evadeChance;
      target.evadeChance = 0;
      if (dodged) {
        if (target.tauntTurns > 0) target.tauntTurns -= 1;
        this.afterAction([`${target.name} evade el ataque de ${enemy.name}.`], 1400, enemy, [target]);
        return;
      }
    }

    const dealt = target.receiveDamage(Math.round(enemy.stats.attack * (0.9 + Math.random() * 0.3)));
    this.playEnemyAttackSound(enemy);
    const logs = [`${enemy.name} ataca a ${target.name} por ${dealt}.`];
    if (target.tauntTurns > 0) target.tauntTurns -= 1;
    if (target.thornsTurns > 0 && target.thornsReflectRatio > 0 && enemy.isAlive) {
      const reflected = enemy.receiveDamage(Math.max(1, Math.round(dealt * target.thornsReflectRatio)));
      target.thornsTurns -= 1;
      target.thornsReflectRatio = 0;
      logs.push(`Espinas de ${target.name} devuelve ${reflected} a ${enemy.name}.`);
    }
    this.afterAction(logs, 1400, enemy, [target]);
  }

  private afterAction(logs: string[], delay = 1400, actor?: Character, targets: Character[] = []): void {
    this.playActionAnimation(actor, targets);
    const pruned = this.pruneDefeatedUnitsFromField();
    if (pruned) {
      this.renderCurrentWaveVisuals();
    }
    [...this.players, ...this.enemies].forEach((unit) => this.paintCharacterState(unit));
    const message = logs.length > 0 ? logs.join(" ") : "Accion completada.";
    this.hud.setLog(message);
    this.hud.renderParty(this.players);
    targets
      .filter((target) => target.team === "player")
      .forEach((target) => this.hud.pulsePartyMember(target.id));
    this.hud.pushHistory(message);
    this.runState.logHistory.push(message);
    this.saveService.save(this.runState);

    const rawGate = this.pendingTurnGateMs > 0 ? this.pendingTurnGateMs : delay;
    const gateDelay = this.scaleBattleMs(rawGate);
    this.pendingTurnGateMs = 0;
    this.time.delayedCall(gateDelay, () => {
      this.turnIndex += 1;
      this.processTurn();
    });
  }

  private tickSummonCooldownForMageTurn(actor: Player): void {
    if (actor.progress.role !== "mage") {
      return;
    }
    const current = this.summonCooldownByCasterId.get(actor.id) ?? 0;
    if (current > 0) {
      this.summonCooldownByCasterId.set(actor.id, current - 1);
    }
  }

  private pruneDefeatedUnitsFromField(): boolean {
    const aliveIds = new Set(this.enemies.filter((enemy) => enemy.isAlive).map((enemy) => enemy.id));
    let removedAny = false;
    this.visuals.forEach((node, id) => {
      const isEnemyVisual = this.enemies.some((enemy) => enemy.id === id);
      if (isEnemyVisual && !aliveIds.has(id)) {
        node.body.destroy();
        node.icon.destroy();
        node.name.destroy();
        node.hp.destroy();
        node.targetZone.destroy();
        node.iconMask?.destroy();
        this.visuals.delete(id);
        removedAny = true;
      }
    });
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((enemy) => enemy.isAlive);
    Array.from(this.skeletonSummonCooldownByEnemyId.keys()).forEach((enemyId) => {
      if (!aliveIds.has(enemyId)) {
        this.skeletonSummonCooldownByEnemyId.delete(enemyId);
      }
    });
    const beforePlayers = this.players.length;
    this.players = this.players.filter((player) => !(player instanceof SummonAlly && !player.isAlive));
    return removedAny || before !== this.enemies.length || beforePlayers !== this.players.length;
  }

  private handleSlimeSplitAfterHit(previousHp: Map<string, number>): string[] {
    const spawnedLogs: string[] = [];
    const newEnemies: Enemy[] = [];
    this.enemies.forEach((enemy) => {
      if (enemy.kind !== "slime" || !enemy.isAlive) {
        return;
      }
      const before = previousHp.get(enemy.id) ?? enemy.stats.hp;
      if (enemy.stats.hp < before && this.enemies.length + newEnemies.length < this.maxEnemiesOnField) {
        const blob = this.createSummonEnemy("slime_blob", enemy);
        newEnemies.push(blob);
        spawnedLogs.push(`${enemy.name} se divide y crea ${blob.name}.`);
      }
    });
    if (newEnemies.length === 0 && this.enemies.length >= this.maxEnemiesOnField) {
      spawnedLogs.push("El campo enemigo esta lleno; el slime no puede dividirse mas.");
    }
    if (newEnemies.length > 0) {
      this.enemies.push(...newEnemies);
      this.renderCurrentWaveVisuals();
    }
    return spawnedLogs;
  }

  private shouldSkeletonMageSummon(enemy: Enemy): boolean {
    if (this.enemies.length >= this.maxEnemiesOnField) {
      return false;
    }
    const cooldown = this.skeletonSummonCooldownByEnemyId.get(enemy.id) ?? 0;
    if (cooldown > 0) {
      return false;
    }
    return Math.random() < 0.7;
  }

  private summonSkeletonMinions(): string[] {
    const availableSlots = Math.max(0, this.maxEnemiesOnField - this.enemies.length);
    const amount = Math.min(availableSlots, 1 + Math.floor(Math.random() * 3));
    if (amount <= 0) {
      return ["El Mago Esqueleto intenta invocar, pero no hay espacio."];
    }
    const summons: Enemy[] = [];
    for (let i = 0; i < amount; i += 1) {
      summons.push(this.createSummonEnemy("skeleton_minion"));
    }
    this.enemies.push(...summons);
    this.renderCurrentWaveVisuals();
    return [`Mago Esqueleto invoca ${amount} esqueleto(s) de apoyo.`];
  }

  private createSummonEnemy(kind: EnemyKind, source?: Enemy): Enemy {
    const base = getEnemyStatsByFloor(this.runState.floor);
    const difficultyMultiplier = this.getRosterDifficultyMultiplier();
    if (kind === "slime_blob") {
      const hpBase = source
        ? Math.max(1, Math.round(source.stats.hp * 0.15))
        : Math.round(base.maxHp * 0.2 * difficultyMultiplier);
      const attack = source?.stats.attack ?? Math.round(base.attack * 0.7 * difficultyMultiplier);
      return new Enemy(
        `enemy-summon-${this.enemyCounter++}`,
        "Bola de Slime",
        {
          maxHp: hpBase,
          hp: hpBase,
          attack,
          magic: 0,
          defense: Math.max(2, Math.round(base.defense * 0.35 * difficultyMultiplier)),
          speed: Math.round(base.speed * (1.05 + (difficultyMultiplier - 1) * 0.12)),
          healPower: 0
        },
        "slime_blob",
        false
      );
    }
    return new Enemy(
      `enemy-summon-${this.enemyCounter++}`,
      "Esqueleto",
      {
        maxHp: Math.round(base.maxHp * 0.4 * difficultyMultiplier),
        hp: Math.round(base.maxHp * 0.4 * difficultyMultiplier),
        attack: Math.round(base.attack * 0.65 * difficultyMultiplier),
        magic: 0,
        defense: Math.round(base.defense * 0.45 * difficultyMultiplier),
        speed: Math.round(base.speed * (1.1 + (difficultyMultiplier - 1) * 0.12)),
        healPower: 0
      },
      "skeleton_minion",
      false
    );
  }

  private createDemonRoomSupportEnemy(): Enemy {
    const base = getEnemyStatsByFloor(this.runState.floor);
    const difficultyMultiplier = this.getRosterDifficultyMultiplier();
    const supportPower = 1.35;
    const demonSupportNerf = 0.5;
    const roll = Math.random();

    if (roll < 0.5) {
      return new Enemy(
        `enemy-summon-${this.enemyCounter++}`,
        "Slime Alfa",
        {
          maxHp: Math.max(1, Math.round(base.maxHp * 0.95 * difficultyMultiplier * supportPower * demonSupportNerf)),
          hp: Math.max(1, Math.round(base.maxHp * 0.95 * difficultyMultiplier * supportPower * demonSupportNerf)),
          attack: Math.max(1, Math.round(base.attack * 0.9 * difficultyMultiplier * supportPower * demonSupportNerf)),
          magic: 0,
          defense: Math.max(1, Math.round(base.defense * 0.85 * difficultyMultiplier * supportPower * demonSupportNerf)),
          speed: Math.max(1, Math.round(base.speed * 1.05 * demonSupportNerf)),
          healPower: 0
        },
        "slime",
        false
      );
    }

    return new Enemy(
      `enemy-summon-${this.enemyCounter++}`,
      "Mago Esqueleto Elite",
      {
        maxHp: Math.max(1, Math.round(base.maxHp * 1.05 * difficultyMultiplier * supportPower * demonSupportNerf)),
        hp: Math.max(1, Math.round(base.maxHp * 1.05 * difficultyMultiplier * supportPower * demonSupportNerf)),
        attack: Math.max(1, Math.round(base.attack * 0.95 * difficultyMultiplier * supportPower * demonSupportNerf)),
        magic: Math.max(0, Math.round(base.magic * 1.1 * difficultyMultiplier * supportPower * demonSupportNerf)),
        defense: Math.max(1, Math.round(base.defense * 0.9 * difficultyMultiplier * supportPower * demonSupportNerf)),
        speed: Math.max(1, Math.round(base.speed * 1.02 * demonSupportNerf)),
        healPower: 0
      },
      "skeleton_mage",
      false
    );
  }

  private getRosterDifficultyMultiplier(): number {
    const rosterSize = Math.max(1, this.runState.roster.length);
    // Escala agresiva por cantidad de heroes: 1 heroe => x1, 4+ heroes => x2.
    const growthPerHero = 0.35;
    return Math.min(2, 1 + (rosterSize - 1) * growthPerHero);
  }

  private onEnemyDefeated(): void {
    this.clearTemporarySummons();
    const alivePlayers = this.getHeroes().filter((player) => player.isAlive);
    const healedLines: string[] = [];
    alivePlayers.forEach((player) => {
      const recovered = player.heal(Math.round(player.stats.maxHp * 0.1));
      healedLines.push(`${player.name} recupera ${recovered} HP.`);
    });

    const hasNextEnemy = this.enemyWaveIndex < this.enemyWave.length - 1;
    if (hasNextEnemy) {
      this.enemyWaveIndex += 1;
      this.enemies = [this.enemyWave[this.enemyWaveIndex]!];
      this.renderCurrentWaveVisuals();
      const nextEnemyName = this.enemies[0]?.name ?? "el siguiente enemigo";
      const msg = `Enemigo derrotado. Curacion del 10% aplicada. Aparece ${nextEnemyName}. ${healedLines.join(" ")}`;
      this.hud.setLog(msg);
      this.hud.pushHistory(msg);
      this.runState.logHistory.push(msg);
      this.saveService.save(this.runState);
      this.time.delayedCall(this.scaleBattleMs(1400), () => {
        this.startBattle();
      });
      return;
    }

    const msg = `Oleada de piso completada. Curacion del 10% aplicada. ${healedLines.join(" ")}`;
    this.hud.setLog(msg);
    this.hud.pushHistory(msg);
    this.runState.logHistory.push(msg);
    this.saveService.save(this.runState);
    this.time.delayedCall(this.scaleBattleMs(1400), () => this.onFloorWin());
  }

  private onFloorWin(): void {
    this.phase = "resolving";
    this.clearTemporarySummons();
    const survivors = this.getHeroes().filter((p) => p.isAlive);
    this.syncSurvivorsProgress(survivors);
    const item = getRandomItem();
    const beneficiary = this.runState.roster[Math.floor(Math.random() * this.runState.roster.length)];
    if (beneficiary) {
      beneficiary.bonus = mergeBonus(beneficiary.bonus, item.bonus);
    }
    this.runState.floor += 1;
    this.runState.bestFloor = Math.max(this.runState.bestFloor, this.runState.floor);

    const unlocked = this.tryUnlockSkills();
    const recruitable = this.getRecruitableRoles();
    const shouldRecruit = this.runState.floor % 2 === 0 && recruitable.length > 0;

    const rewardLogs = [
      `Piso completado. Recompensa: ${item.name}.`,
      ...unlocked.map((line) => `Desbloqueo: ${line}`)
    ];
    const rewardMessage = rewardLogs.join(" ");
    this.hud.setLog(rewardMessage);
    this.hud.pushHistory(rewardMessage);
    this.runState.logHistory.push(rewardMessage);
    this.saveService.save(this.runState);

    if (shouldRecruit) {
      this.openRecruitmentModal(recruitable.slice(0, 2));
      return;
    }
    this.restartFloorAfterReward();
  }

  private syncSurvivorsProgress(survivors: Character[]): void {
    const survivorIds = new Set(survivors.map((s) => s.id));
    this.runState.roster.forEach((progress) => {
      if (survivorIds.has(progress.id)) {
        progress.floorsSinceUnlock += 1;
        progress.totalFloorsSurvived += 1;
      }
    });
  }

  private tryUnlockSkills(): string[] {
    const unlockedLogs: string[] = [];
    this.runState.roster.forEach((progress) => {
      if (progress.floorsSinceUnlock < 2) return;
      const template = getTemplate(progress.role);
      const next = template.unlockableSkillIds.find((id) => !progress.unlockedSkillIds.includes(id));
      if (!next) return;
      progress.unlockedSkillIds.push(next);
      progress.floorsSinceUnlock = 0;
      unlockedLogs.push(`${progress.name} aprende ${next}.`);
    });
    return unlockedLogs;
  }

  private getRecruitableRoles(): Role[] {
    const current = new Set(this.runState.roster.map((r) => r.role));
    return ALL_ROLES.filter((role) => !current.has(role)).sort(() => Math.random() - 0.5);
  }

  private openRecruitmentModal(options: Role[]): void {
    const { width, height, isCompact } = this.getViewport();
    const centerX = width / 2;
    const centerY = height / 2;
    const margin = isCompact ? 12 : 20;
    const panelWidth = Math.min(width - margin * 2, 920);
    const panelHeight = Math.min(
      isCompact ? Math.max(300, Math.floor(height * 0.58)) : Math.min(height * 0.62, 400),
      height - margin * 2
    );
    const useVerticalButtons = width < 560 || isCompact;
    const depthDim = 8000;
    const depthPanel = 8001;
    const depthText = 8002;

    const dim = this.add
      .rectangle(centerX, centerY, width, height, 0x050810, 0.72)
      .setDepth(depthDim)
      .setScrollFactor(0);

    const bg = this.add
      .rectangle(centerX, centerY, panelWidth, panelHeight, 0x263043, 0.98)
      .setStrokeStyle(3, 0xa8c8ff, 0.95)
      .setDepth(depthPanel)
      .setScrollFactor(0);

    const titleSize = isCompact ? "22px" : "30px";
    const subtitleSize = isCompact ? "16px" : "18px";
    const title = this.add
      .text(centerX, centerY - panelHeight * 0.36, "Reclutamiento (cada 2 pisos)", {
        fontSize: titleSize,
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: Math.max(120, panelWidth - 28) }
      })
      .setOrigin(0.5)
      .setDepth(depthText)
      .setScrollFactor(0);

    const subtitle = this.add
      .text(centerX, centerY - panelHeight * 0.2, "Elige un personaje para sumar al equipo", {
        fontSize: subtitleSize,
        color: "#ffe8b0",
        align: "center",
        wordWrap: { width: Math.max(120, panelWidth - 28) }
      })
      .setOrigin(0.5)
      .setDepth(depthText)
      .setScrollFactor(0);

    this.recruitmentOverlay = [dim, bg, title, subtitle];

    const btnFont = isCompact ? "19px" : "24px";
    const padX = isCompact ? 18 : 14;
    const padY = isCompact ? 14 : 10;
    const total = options.length;

    options.forEach((role, index) => {
      const template = getTemplate(role);
      let btnX = centerX;
      let btnY: number;
      if (useVerticalButtons) {
        const rowGap = Math.min(58, Math.max(48, Math.floor(panelHeight * 0.14)));
        btnY = centerY - panelHeight * 0.02 + index * rowGap;
      } else {
        const colGap = Math.min(280, Math.max(200, Math.floor((panelWidth - 40) / Math.max(1, total - 0.4))));
        btnX = centerX + (index - (total - 1) / 2) * colGap;
        btnY = centerY + panelHeight * 0.14;
      }

      const btn = this.add
        .text(btnX, btnY, `${index + 1}. ${template.nameEs}`, {
          fontSize: btnFont,
          color: "#0d1118",
          backgroundColor: "#7df0b2",
          padding: { x: padX, y: padY },
          align: "center",
          wordWrap: { width: Math.max(100, panelWidth - 36) }
        })
        .setDepth(depthText)
        .setOrigin(0.5)
        .setScrollFactor(0);
      const hitW = Math.max(btn.width + 32, Math.min(panelWidth - 20, width - 28));
      const hitH = Math.max(btn.height + 22, isCompact ? 52 : 46);
      btn.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-hitW / 2, -hitH / 2, hitW, hitH),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      });

      btn.on("pointerdown", () => {
        const progress = createInitialProgress(role);
        progress.id = `${role}-${this.runState.roster.length + 1}`;
        this.runState.roster.push(progress);
        this.saveService.save(this.runState);
        this.recruitmentOverlay.forEach((obj) => obj.destroy());
        this.recruitmentOverlay = [];
        this.restartFloorAfterReward();
      });
      this.recruitmentOverlay.push(btn);
    });
  }

  private restartFloorAfterReward(): void {
    this.time.delayedCall(this.scaleBattleMs(900), () => {
      this.buildFloor();
      this.startBattle();
    });
  }

  private clearTemporarySummons(): void {
    const summonIds = new Set(
      this.players.filter((player) => player instanceof SummonAlly).map((player) => player.id)
    );
    if (summonIds.size === 0) {
      return;
    }
    this.players = this.players.filter((player) => !summonIds.has(player.id));
    summonIds.forEach((id) => {
      const node = this.visuals.get(id);
      if (!node) {
        return;
      }
      node.body.destroy();
      node.icon.destroy();
      node.name.destroy();
      node.hp.destroy();
      node.targetZone.destroy();
      node.iconMask?.destroy();
      this.visuals.delete(id);
    });
  }

  private getHeroes(): Player[] {
    return this.players.filter((player): player is Player => player instanceof Player);
  }

  private playActionAnimation(actor?: Character, targets: Character[] = []): void {
    const pace = Math.max(1, this.getBattlePace());
    const primaryTarget = targets[0];
    let destination: { x: number; y: number } | null = null;
    if (primaryTarget) {
      const targetNode = this.visuals.get(primaryTarget.id);
      if (targetNode) {
        destination = { x: targetNode.body.x, y: targetNode.body.y };
      } else if (primaryTarget.team === "player") {
        destination = this.hud.getPartyCardCenter(primaryTarget.id);
      }
    }
    if (actor) {
      const node = this.visuals.get(actor.id);
      if (node) {
        if (destination) {
          const dx = destination.x - node.body.x;
          const dy = destination.y - node.body.y;
          const dist = Math.hypot(dx, dy) || 1;
          const step = Math.min(58, dist * 0.22);
          const moveX = (dx / dist) * step;
          const moveY = (dy / dist) * step;
          const actorTargets: Phaser.GameObjects.GameObject[] = [
            node.body,
            node.icon,
            node.name,
            node.hp,
            node.targetZone
          ];
          if (node.iconMask) {
            actorTargets.push(node.iconMask);
          }
          this.tweens.add({
            targets: actorTargets,
            x: `+=${moveX}`,
            y: `+=${moveY}`,
            duration: Math.max(50, Math.round(160 / pace)),
            yoyo: true,
            ease: "Quad.easeOut"
          });
        } else {
          this.tweens.add({
            targets: [node.body, node.icon],
            scale: 1.08,
            duration: Math.max(40, Math.round(120 / pace)),
            yoyo: true
          });
        }
      } else if (actor.team === "player" && destination) {
        this.hud.animatePartyMemberTowards(actor.id, destination);
      }
    }
    targets.forEach((target, index) => {
      const node = this.visuals.get(target.id);
      if (!node) return;
      this.tweens.add({
        targets: [node.body, node.icon, node.hp],
        x: `+=${index % 2 === 0 ? 8 : -8}`,
        duration: Math.max(30, Math.round(70 / pace)),
        yoyo: true,
        repeat: 2
      });
      this.tweens.add({
        targets: node.body,
        alpha: 0.55,
        duration: Math.max(35, Math.round(90 / pace)),
        yoyo: true,
        repeat: 1
      });
      const marker = this.add
        .text(node.body.x, node.body.y - 84, target.team === "enemy" ? "⚔️" : "✨", {
          fontSize: `${Math.round(24 * this.getTypographyScale())}px`
        })
        .setOrigin(0.5)
        .setDepth(80);
      this.tweens.add({
        targets: marker,
        y: marker.y - 24,
        alpha: 0,
        duration: Math.max(120, Math.round(420 / pace)),
        onComplete: () => marker.destroy()
      });
    });
  }

  private drawArenaByCurrentWave(): void {
    this.arenaObjects.forEach((obj) => obj.destroy());
    this.arenaObjects = [];
    // Escenario decorativo desactivado: se prioriza espacio y limpieza visual.
  }

  private getViewport(): { width: number; height: number; battleHeight: number; isCompact: boolean } {
    const width = this.scale.width;
    const height = this.scale.height;
    const uiPanelHeight = this.getUiPanelHeightEstimate(height);
    const battleHeight = Math.max(250, height - uiPanelHeight - 14);
    return { width, height, battleHeight, isCompact: width < 760 };
  }

  private getUiPanelHeightEstimate(screenHeight: number): number {
    const textScale = this.getTypographyScale();
    return Math.max(
      Math.round(230 + 80 * textScale),
      Math.floor(screenHeight * (0.42 + 0.08 * (textScale - 1)))
    );
  }

  private getTypographyScale(): number {
    return getTypographyScale(loadTypographyMode());
  }

  private playSfx(key: string, volume = 0.6, skipSec?: number, skipEndSec?: number): number {
    if (this.sound.locked) {
      return 0;
    }
    const instance = this.sound.add(key);
    const skip = skipSec ?? 0;
    const skipEnd = skipEndSec ?? 0;
    const rawDurationSec = Math.max(0, instance.duration || 0);
    const seekSec = rawDurationSec > skip ? skip : 0;
    const seekEndSec = rawDurationSec > skipEnd ? skipEnd : 0;
    const remainingDurationSec = Math.max(0, rawDurationSec - seekSec - seekEndSec);
    if (remainingDurationSec <= 0) {
      instance.destroy();
      return 0;
    }
    const pace = this.getBattlePace();
    const durationMs = Math.max(0, Math.round((remainingDurationSec * 1000) / pace));
    instance.play({ volume, seek: seekSec, rate: pace });
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      instance.stop();
      instance.destroy();
    };
    instance.once("complete", cleanup);
    this.time.delayedCall(durationMs, cleanup);
    return durationMs;
  }

  private queueTurnSound(key: string, volume = 0.6, skipSec?: number, skipEndSec?: number): void {
    const durationMs = this.playSfx(key, volume, skipSec, skipEndSec);
    this.pendingTurnGateMs = Math.max(this.pendingTurnGateMs, durationMs);
  }

  private playSkillSound(caster: Character, skillId: string): void {
    if (caster.id.includes("ranger")) {
      this.queueTurnSound(SFX.ARROW, 0.64, SFX_ARROW_SKIP_SEC);
      return;
    }
    if (caster.id.includes("tank") && skillId === "taunt") {
      this.queueTurnSound(SFX.SWORD, 0.62, SFX_SWORD_SKIP_SEC, SFX_SWORD_SKIP_END_SEC);
      return;
    }
    if (caster.id.includes("tank")) {
      this.queueTurnSound(SFX.HIT, 0.62, SFX_HIT_SKIP_SEC);
      return;
    }
    if (caster.id.includes("swordsman")) {
      this.queueTurnSound(SFX.SWORD, 0.62, SFX_SWORD_SKIP_SEC, SFX_SWORD_SKIP_END_SEC);
      return;
    }
    if (caster.id.includes("healer")) {
      this.queueTurnSound(SFX.HEAL, 0.6);
      return;
    }
    if (caster.id.includes("mage")) {
      if (skillId === "summon_storm") {
        this.queueTurnSound(SFX.SUMMON_BELL, 0.66);
      } else {
        this.queueTurnSound(SFX.FIREBALL, 0.62);
      }
      return;
    }
    this.queueTurnSound(SFX.HIT, 0.6, SFX_HIT_SKIP_SEC);
  }

  private playEnemyAttackSound(enemy: Enemy): void {
    if (enemy.kind === "slime_blob") {
      this.queueTurnSound(SFX.HIT, 0.66, SFX_SLIME_BALL_SKIP_SEC);
      return;
    }
    if (enemy.kind === "skeleton_mage") {
      this.queueTurnSound(SFX.FIREBALL, 0.64);
      return;
    }
    if (enemy.kind === "skeleton_minion" || enemy.kind === "demon") {
      this.queueTurnSound(SFX.SWORD, 0.66, SFX_SWORD_SKIP_SEC, SFX_SWORD_SKIP_END_SEC);
      return;
    }
    if (enemy.kind === "slime") {
      this.queueTurnSound(SFX.HIT, 0.62, SFX_HIT_SKIP_SEC);
      return;
    }
    this.queueTurnSound(SFX.HIT, 0.6, SFX_HIT_SKIP_SEC);
  }

  private getTextureKey(character: Character): string | null {
    if (character instanceof SummonAlly) {
      if (character.summonType === "snake") return "summon_snake";
      if (character.summonType === "bear") return "summon_bear";
      if (character.summonType === "healer") return "summon_deer";
      return null;
    }
    if (character.team === "enemy" && character instanceof Enemy) {
      if (character.kind === "slime") return "enemy_slime";
      if (character.kind === "slime_blob") return "enemy_slime_blob";
      if (character.kind === "skeleton_mage") return "enemy_skeleton_mage";
      if (character.kind === "skeleton_minion") return "enemy_skeleton_minion";
      if (character.kind === "demon") return "enemy_demon";
      return null;
    }
    if (character.id.includes("swordsman")) return "player_swordsman";
    if (character.id.includes("tank")) return "player_tank";
    if (character.id.includes("mage")) return "player_mage";
    if (character.id.includes("healer")) return "player_healer";
    if (character.id.includes("ranger")) return "player_ranger";
    return null;
  }

  private getEmoji(character: Character): string {
    if (character.team === "enemy" && character instanceof Enemy) {
      if (character.kind === "slime") return "🟢";
      if (character.kind === "slime_blob") return "🟩";
      if (character.kind === "skeleton_mage") return "💀";
      if (character.kind === "skeleton_minion") return "🦴";
      if (character.kind === "demon") return "😈";
      return "👾";
    }
    if (character.id.includes("swordsman")) return "🗡️";
    if (character.id.includes("tank")) return "🛡️";
    if (character.id.includes("mage")) return "🧙";
    if (character.id.includes("healer")) return "🪽";
    if (character.id.includes("ranger")) return "🏹";
    if (character instanceof SummonAlly) {
      if (character.summonType === "snake") return "🐍";
      if (character.summonType === "bear") return "🐻";
      return "🦌";
    }
    return "🙂";
  }

  private finishRun(): void {
    this.saveService.clear();
    this.scene.start(SCENE_GAME_OVER, { reachedFloor: this.runState.floor, bestFloor: this.runState.bestFloor });
  }

  private abandonRun(): void {
    this.saveService.clear();
    this.scene.start(SCENE_SELECTION);
  }

  private cleanupInput(): void {
    this.hud.clearSkillButtons();
    this.input.keyboard?.removeAllListeners("keydown");
  }
}
