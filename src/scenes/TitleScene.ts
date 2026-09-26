import Phaser from 'phaser';
import { drawStyleSampleBurger } from '../art/drawBurger';

/** 标题画面：项目骨架的可见性验证 + 程序化美术风格样张 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    // 背景装饰：暖色渐变天空 + 店铺色带
    this.add
      .rectangle(0, 0, width, height, 0xf5e6c8)
      .setOrigin(0);
    this.add
      .rectangle(0, height - 90, width, 90, 0x8c5a3c)
      .setOrigin(0);

    // 程序化绘制的汉堡样张（风格基准，后续替换为完整部件系统）
    drawStyleSampleBurger(this, width / 2, height / 2 - 40, 2.2);

    this.add
      .text(width / 2, 120, '汉堡小店', {
        fontFamily: '"ZCOOL KuaiLe", "Microsoft YaHei", sans-serif',
        fontSize: '72px',
        color: '#5a3218',
        stroke: '#fff4dd',
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 200, 'v0.1.0 · 项目骨架已就绪', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#8c5a3c',
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(width / 2, height - 45, '脚手架运行正常 — 等待 Phase 1 核心循环', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#f5e6c8',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: hint,
      alpha: 0.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }
}
