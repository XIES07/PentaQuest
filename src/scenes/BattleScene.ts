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
import { HUD } from "../ui/HUD";
import { SCENE_GAME_OVER, SCENE_SELECTION } from "./SceneKeys";

type TurnPhase = "idle" | "player_select_skill" | "player_select_target" | "enemy_action" | "resolving";

interface VisualNode {
  body: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Text;
  targetZone: Phaser.GameObjects.Rectangle;
}

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

  constructor() {
    super("battle");
  }

  init(data: { runState: RunState }): void {
    this.runState = data.runState;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#12172e");
    this.hud = new HUD(
      this,
      () => this.abandonRun(),
      () => this.renderCurrentWaveVisuals()
    );
    this.buildFloor();
    this.startBattle();
    this.scale.on("resize", () => {
      this.hud.layout();
      this.renderCurrentWaveVisuals();
    });
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
    });
    this.visuals.clear();

    const playerLayout = this.getPlayerLayout(this.players);
    this.players.forEach((player, index) => {
      const slot = playerLayout[index];
      if (!slot) {
        return;
      }
      this.createVisual(
        player,
        slot.x,
        slot.y,
        slot.color,
        this.getEmoji(player),
        slot.scale
      );
    });
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
        node.icon.y = node.body.y - 8;
        node.name.y = node.body.y + 66;
        node.hp.y = node.body.y - 84;
        node.targetZone.y = node.body.y;
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
    const bodyWidth = Math.round(92 * visualScale);
    const bodyHeight = Math.round(112 * visualScale);
    const iconSize = Math.max(24, Math.round(44 * visualScale * typographyScale));
    const nameSize = Math.max(10, Math.round(12 * visualScale * typographyScale));
    const hpSize = Math.max(10, Math.round(12 * visualScale * typographyScale));
    const targetWidth = Math.round(80 * visualScale);
    const targetHeight = Math.round(100 * visualScale);

    const body = this.add
      .rectangle(x, y, bodyWidth, bodyHeight, color, 0.95)
      .setStrokeStyle(2, 0x89b4ff)
      .setDepth(30);
    const icon = this.add
      .text(x, y - 8 * visualScale, emoji, { fontSize: `${iconSize}px` })
      .setOrigin(0.5)
      .setDepth(31);
    const name = this.add
      .text(x, y + 58 * visualScale, character.name, { fontSize: `${nameSize}px`, color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(32);
    const hp = this.add
      .text(x, y - 70 * visualScale, `${character.stats.hp}/${character.stats.maxHp}`, {
        fontSize: `${hpSize}px`,
        color: "#9df2b5"
      })
      .setOrigin(0.5)
      .setDepth(32);
    const targetZone = this.add
      .rectangle(x, y, targetWidth, targetHeight, 0xffffff, 0.01)
      .setInteractive({ useHandCursor: true })
      .setDepth(60);
    targetZone.on("pointerdown", () => this.onTargetClick(character));
    this.visuals.set(character.id, { body, icon, name, hp, targetZone });
    this.paintCharacterState(character);
  }

  private getEnemyLayout(count: number): Array<{ x: number; y: number; scale: number }> {
    if (count <= 0) {
      return [];
    }
    const { width, battleHeight, isCompact } = this.getViewport();
    const topCount = Math.ceil(count / 2);
    const bottomCount = count - topCount;
    const maxRowCount = Math.max(topCount, bottomCount, 1);

    // Encoge enemigos cuando la sala se llena para mantener clic y legibilidad.
    const scale = (count <= 3 ? 0.95 : count <= 5 ? 0.8 : count <= 7 ? 0.68 : 0.58) * (isCompact ? 0.86 : 1);
    const maxWidth = Math.max(260, width - 90);
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

    const topRowY = Math.max(74, Math.floor(battleHeight * 0.24));
    const bottomRowY = Math.max(topRowY + 64, Math.floor(battleHeight * 0.53));
    const topRow = buildRow(topCount, topRowY);
    const bottomRow = buildRow(bottomCount, bottomRowY);
    return [...topRow, ...bottomRow];
  }

  private getPlayerLayout(
    units: Character[]
  ): Array<{ x: number; y: number; scale: number; color: number }> {
    if (units.length === 0) {
      return [];
    }
    const { width, battleHeight, isCompact } = this.getViewport();
    const heroes = units.filter((unit) => unit instanceof Player);
    const summons = units.filter((unit) => unit instanceof SummonAlly);
    const heroSpacing =
      heroes.length <= 1
        ? 0
        : Math.max(72, Math.min(145, Math.floor((width - 120) / Math.max(1, heroes.length - 1))));
    const heroStartX = heroes.length <= 1 ? width * 0.5 : Math.max(60, width * 0.18);
    const heroSlots = heroes.map((hero, index) => ({
      id: hero.id,
      x: heroStartX + index * heroSpacing,
      y: Math.floor(battleHeight * 0.84),
      scale: isCompact ? 0.9 : 1,
      color: 0x1a2e4a
    }));

    const summonSpacing = summons.length <= 1 ? 0 : Math.max(68, Math.min(115, Math.floor((width - 180) / summons.length)));
    const summonStartX = width * 0.5 - ((summons.length - 1) * summonSpacing) / 2;
    const summonSlots = summons.map((summon, index) => ({
      id: summon.id,
      x: summonStartX + index * summonSpacing,
      y: Math.floor(battleHeight * 0.62),
      scale: isCompact ? 0.52 : 0.64,
      color: 0x1d3540
    }));

    const map = new Map<string, { x: number; y: number; scale: number; color: number }>();
    [...heroSlots, ...summonSlots].forEach((slot) => map.set(slot.id, slot));
    return units
      .map((unit) => map.get(unit.id))
      .filter((slot): slot is { x: number; y: number; scale: number; color: number } => slot !== undefined);
  }

  private paintCharacterState(character: Character): void {
    const node = this.visuals.get(character.id);
    if (!node) return;
    node.hp.setText(`${character.stats.hp}/${character.stats.maxHp}`);
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

  private resolvePlayerAction(targets: Character[]): void {
    if (!this.selectedSkill || !this.actorInTurn) return;
    this.phase = "resolving";
    const caster = this.actorInTurn;
    const enemyHpBefore = new Map<string, number>();
    this.enemies.forEach((enemy) => enemyHpBefore.set(enemy.id, enemy.stats.hp));
    const allies = caster.team === "player" ? this.players : this.enemies;
    const enemies = caster.team === "player" ? this.enemies : this.players;
    const result = this.selectedSkill.execute({ caster, allies, enemies, targets });
    const extraLogs = this.handleSlimeSplitAfterHit(enemyHpBefore);
    this.afterAction([...result.logs, ...extraLogs], 1400, caster, targets);
  }

  private resolveMageSummon(caster: Player): void {
    const summonType = this.pickSummonType();
    const summon = this.createMageSummon(caster, summonType);
    this.players.push(summon);
    this.summonCooldownByCasterId.set(caster.id, 3);
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
        this.afterAction([`${summon.name} provoca para proteger al equipo.`], 1200, summon, [summon]);
        return;
      }
      const dealt = enemyTarget.receiveDamage(Math.round(summon.stats.attack * 0.7));
      this.afterAction([`${summon.name} embiste a ${enemyTarget.name} por ${dealt}.`], 1200, summon, [enemyTarget]);
      return;
    }

    const strongHit = Math.random() < 0.45;
    const ratio = strongHit ? 1.05 : 0.85;
    const dealt = enemyTarget.receiveDamage(Math.round(summon.stats.attack * ratio));
    const moveName = strongHit ? "Colmillo Venenoso" : "Mordisco";
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
    this.hud.pushHistory(message);
    this.runState.logHistory.push(message);
    this.saveService.save(this.runState);

    this.time.delayedCall(delay, () => {
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
    const alivePlayerIds = new Set(this.players.filter((player) => player.isAlive).map((player) => player.id));
    let removedAny = false;
    this.visuals.forEach((node, id) => {
      const isEnemyVisual = this.enemies.some((enemy) => enemy.id === id);
      const isSummonVisual = this.players.some((player) => player.id === id && player instanceof SummonAlly);
      if ((isEnemyVisual && !aliveIds.has(id)) || (isSummonVisual && !alivePlayerIds.has(id))) {
        node.body.destroy();
        node.icon.destroy();
        node.name.destroy();
        node.hp.destroy();
        node.targetZone.destroy();
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
      this.time.delayedCall(1400, () => {
        this.startBattle();
      });
      return;
    }

    const msg = `Oleada de piso completada. Curacion del 10% aplicada. ${healedLines.join(" ")}`;
    this.hud.setLog(msg);
    this.hud.pushHistory(msg);
    this.runState.logHistory.push(msg);
    this.saveService.save(this.runState);
    this.time.delayedCall(1400, () => this.onFloorWin());
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
    const panelWidth = Math.min(width * 0.92, 920);
    const panelHeight = Math.min(height * 0.62, 390);
    const bg = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x02020a, 0.92).setDepth(2000);
    const title = this.add
      .text(centerX, centerY - panelHeight * 0.35, "Reclutamiento (cada 2 pisos)", {
        fontSize: isCompact ? "20px" : "30px",
        color: "#ffffff"
      })
      .setOrigin(0.5)
      .setDepth(2001);
    const subtitle = this.add
      .text(centerX, centerY - panelHeight * 0.22, "Elige un personaje para sumar al equipo", {
        fontSize: isCompact ? "14px" : "18px",
        color: "#ffd37a"
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.recruitmentOverlay = [bg, title, subtitle];

    options.forEach((role, index) => {
      const template = getTemplate(role);
      const total = options.length;
      const btnX = centerX + (index - (total - 1) / 2) * (isCompact ? 170 : 300);
      const btnY = centerY + panelHeight * 0.03;
      const btn = this.add
        .text(btnX, btnY, `[${index + 1}] ${template.nameEs}`, {
          fontSize: isCompact ? "18px" : "24px",
          color: "#0a0a0a",
          backgroundColor: "#87f5b0",
          padding: { x: isCompact ? 10 : 12, y: isCompact ? 6 : 8 }
        })
        .setDepth(2001)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
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
    this.time.delayedCall(900, () => {
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
      this.visuals.delete(id);
    });
  }

  private getHeroes(): Player[] {
    return this.players.filter((player): player is Player => player instanceof Player);
  }

  private playActionAnimation(actor?: Character, targets: Character[] = []): void {
    const primaryTarget = targets[0];
    if (actor) {
      const node = this.visuals.get(actor.id);
      if (node) {
        if (primaryTarget) {
          const targetNode = this.visuals.get(primaryTarget.id);
          if (targetNode) {
            const dx = targetNode.body.x - node.body.x;
            const dy = targetNode.body.y - node.body.y;
            const dist = Math.hypot(dx, dy) || 1;
            const step = Math.min(32, dist * 0.2);
            const moveX = (dx / dist) * step;
            const moveY = (dy / dist) * step;

            this.tweens.add({
              targets: [node.body, node.icon, node.name, node.hp, node.targetZone],
              x: `+=${moveX}`,
              y: `+=${moveY}`,
              duration: 140,
              yoyo: true,
              ease: "Quad.easeOut"
            });
          }
        } else {
          this.tweens.add({
            targets: [node.body, node.icon],
            scale: 1.08,
            duration: 120,
            yoyo: true
          });
        }
      }
    }
    targets.forEach((target, index) => {
      const node = this.visuals.get(target.id);
      if (!node) return;
      this.tweens.add({
        targets: [node.body, node.icon],
        x: `+=${index % 2 === 0 ? 8 : -8}`,
        duration: 70,
        yoyo: true,
        repeat: 2
      });
      this.tweens.add({
        targets: node.body,
        alpha: 0.55,
        duration: 90,
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
        duration: 420,
        onComplete: () => marker.destroy()
      });
    });
  }

  private drawArenaByCurrentWave(): void {
    const { width, battleHeight } = this.getViewport();
    this.arenaObjects.forEach((obj) => obj.destroy());
    this.arenaObjects = [];
    const mainEnemy = this.enemyWave[this.enemyWaveIndex];
    const kind = mainEnemy?.kind ?? "slime";
    const centerX = width / 2;
    const arenaMidY = Math.floor(battleHeight * 0.45);

    if (kind === "slime") {
      const grass = this.add.rectangle(centerX, arenaMidY - 40, width, battleHeight, 0x315a2b, 1).setDepth(-20);
      const dirt = this.add.rectangle(centerX, arenaMidY + 30, width, Math.floor(battleHeight * 0.6), 0x4d6b33, 0.9).setDepth(-19);
      const trees = [0.11, 0.27, 0.78, 0.92].map((xRatio) =>
        this.add.circle(Math.floor(width * xRatio), Math.floor(battleHeight * 0.22), 24, 0x1e3f1c, 1).setDepth(-18)
      );
      this.arenaObjects.push(grass, dirt, ...trees);
      return;
    }
    if (kind === "skeleton_mage") {
      const field = this.add.rectangle(centerX, arenaMidY - 40, width, battleHeight, 0x11213d, 1).setDepth(-20);
      const moonShade = this.add.rectangle(centerX, arenaMidY + 30, width, Math.floor(battleHeight * 0.6), 0x1b2f50, 0.92).setDepth(-19);
      const rocks = [0.16, 0.41, 0.73, 0.9].map((xRatio) =>
        this.add.rectangle(Math.floor(width * xRatio), Math.floor(battleHeight * 0.26), 46, 30, 0x30476e, 0.9).setDepth(-18)
      );
      this.arenaObjects.push(field, moonShade, ...rocks);
      return;
    }
    const dungeon = this.add.rectangle(centerX, arenaMidY - 40, width, battleHeight, 0x3a1010, 1).setDepth(-20);
    const tiles = this.add.rectangle(centerX, arenaMidY + 30, width, Math.floor(battleHeight * 0.6), 0x5b1a1a, 0.92).setDepth(-19);
    const torches = [0.12, 0.3, 0.69, 0.88].map((xRatio) =>
      this.add.circle(Math.floor(width * xRatio), Math.floor(battleHeight * 0.24), 14, 0xff6a00, 0.9).setDepth(-18)
    );
    this.arenaObjects.push(dungeon, tiles, ...torches);
  }

  private getViewport(): { width: number; height: number; battleHeight: number; isCompact: boolean } {
    const width = this.scale.width;
    const height = this.scale.height;
    const battleHeight = Math.max(250, Math.floor(height * 0.7));
    return { width, height, battleHeight, isCompact: width < 760 };
  }

  private getTypographyScale(): number {
    return getTypographyScale(loadTypographyMode());
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
