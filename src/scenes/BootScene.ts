import Phaser from 'phaser';

/** 启动场景：生成程序化纹理后进入标题画面（?skip=1 可跳过标题直达游戏，便于调试） */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.scene.start(params.get('skip') === '1' ? 'Game' : 'Title');
  }
}
