import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';

/**
 * 汉堡小店 —— 入口
 * 设计分辨率 960×720（4:3，与原版舞台比例一致），Scale.FIT 自适应
 */
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 720,
  backgroundColor: '#f5e6c8',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, TitleScene, GameScene],
});
