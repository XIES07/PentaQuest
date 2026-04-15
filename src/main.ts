import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { SelectionScene } from "./scenes/SelectionScene";
import { SCENE_BATTLE, SCENE_GAME_OVER, SCENE_SELECTION } from "./scenes/SceneKeys";

const initialWidth = Math.max(1, window.innerWidth);
const initialHeight = Math.max(1, window.innerHeight);
const renderResolution = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

const installHighQualityTextFactory = (): void => {
  type TextFactory = (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ) => Phaser.GameObjects.Text;
  const factoryProto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text?: TextFactory;
    __hqTextPatched?: boolean;
  };
  const original = factoryProto.text;
  if (!original || factoryProto.__hqTextPatched) {
    return;
  }
  const textResolution = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  factoryProto.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const created = original.call(this, x, y, text, style);
    created.setResolution(textResolution);
    return created;
  };
  factoryProto.__hqTextPatched = true;
};
installHighQualityTextFactory();

const config = {
  type: Phaser.AUTO,
  width: initialWidth,
  height: initialHeight,
  parent: "app",
  backgroundColor: "#111122",
  scene: [SelectionScene, BattleScene, GameOverScene],
  resolution: renderResolution,
  pixelArt: false,
  antialias: true,
  antialiasGL: true,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initialWidth,
    height: initialHeight,
    min: {
      width: 320,
      height: 240
    }
  },
  autoRound: false
} as Phaser.Types.Core.GameConfig;

window.addEventListener("load", () => {
  const game = new Phaser.Game(config);
  game.scene.start(SCENE_SELECTION);
});

export { SCENE_SELECTION, SCENE_BATTLE, SCENE_GAME_OVER };
