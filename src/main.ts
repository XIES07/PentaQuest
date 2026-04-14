import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { SelectionScene } from "./scenes/SelectionScene";
import { SCENE_BATTLE, SCENE_GAME_OVER, SCENE_SELECTION } from "./scenes/SceneKeys";

const initialWidth = Math.max(1, window.innerWidth);
const initialHeight = Math.max(1, window.innerHeight);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: initialWidth,
  height: initialHeight,
  parent: "app",
  backgroundColor: "#111122",
  scene: [SelectionScene, BattleScene, GameOverScene],
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
  autoRound: true
};

window.addEventListener("load", () => {
  const game = new Phaser.Game(config);
  game.scene.start(SCENE_SELECTION);
});

export { SCENE_SELECTION, SCENE_BATTLE, SCENE_GAME_OVER };
