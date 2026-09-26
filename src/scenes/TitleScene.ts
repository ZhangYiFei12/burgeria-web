import Phaser from 'phaser';
import { addStyleSampleBurger } from '../art/drawBurger';

/** 标题画面：项目骨架的可见性验证 + 程序化美术风格样张 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    // 背景：暖色地面 + 店铺色带
    this.add.rectangle(0, 0, width, height, 0xf5e6c8).setOrigin(0);
    this.add.rectangle(0, height - 90, width, 90, 0x8c5a3c).setOrigin(0);

    // 程序化绘制的汉堡样张（风格基准，后续替换为完整部件系统）
    addStyleSampleBurger(this, width / 2, 420, 1.3);

    this.add
      .text(width / 2, 92, '汉堡小店', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '76px',
        color: '#5a3218',
        stroke: '#fff4dd',
        strokeThickness: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 158, 'v0.2.0 · Phase 1 核心循环', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#8c5a3c',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height - 45, '点击任意处开始营业', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#f5e6c8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // 点击进入游戏
    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('Game');
      });
    });
    this.input.keyboard?.once('keydown', () => {
      this.scene.start('Game');
    });
  }
}
