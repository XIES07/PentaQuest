import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { SelectionScene } from "./scenes/SelectionScene";
import { SCENE_BATTLE, SCENE_GAME_OVER, SCENE_SELECTION } from "./scenes/SceneKeys";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 600,
  parent: "app",
  backgroundColor: "#111122",
  scene: [SelectionScene, BattleScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

window.addEventListener("load", () => {
  const game = new Phaser.Game(config);
  game.scene.start(SCENE_SELECTION);
});

export { SCENE_SELECTION, SCENE_BATTLE, SCENE_GAME_OVER };
