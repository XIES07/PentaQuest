import Phaser from "phaser";
import { BattleScene } from "./scenes/BattleScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { SelectionScene } from "./scenes/SelectionScene";
import { SCENE_BATTLE, SCENE_GAME_OVER, SCENE_SELECTION } from "./scenes/SceneKeys";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "app",
  backgroundColor: "#111122",
  scene: [SelectionScene, BattleScene, GameOverScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: "100%",
    height: "100%"
  },
  autoRound: true
};

window.addEventListener("load", () => {
  const game = new Phaser.Game(config);
  game.scene.start(SCENE_SELECTION);
});

export { SCENE_SELECTION, SCENE_BATTLE, SCENE_GAME_OVER };
