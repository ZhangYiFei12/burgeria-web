import Phaser from 'phaser';

/** 启动场景：后续在此生成程序化纹理与加载资源，然后进入标题画面 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Title');
  }
}
