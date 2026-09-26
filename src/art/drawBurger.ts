import Phaser from 'phaser';

/**
 * 程序化美术样张：用 Graphics 绘制汉堡 → 烘焙为纹理 → 以 Image 呈现。
 * 这是 PLAN.md §3.3「程序化矢量高仿」路线的可行性验证，
 * 后续所有食材/场景资产都走这条管线（离屏 Graphics → generateTexture）。
 */

/** 纹理逻辑尺寸（设计画布） */
const BOX = 300;
/** 纹理空间内的汉堡中心点（保证内容完整落在 BOX 内） */
const CX = 150;
const CY = 207;

export const STYLE_SAMPLE_KEY = 'style-sample-burger';

/** 生成（或复用）汉堡样张纹理，返回纹理 key */
export function createStyleSampleBurgerTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(STYLE_SAMPLE_KEY)) return STYLE_SAMPLE_KEY;

  // 第二个参数 false = 不加入显示列表，纯离屏绘制
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // ---- 顶层面包（拱形） ----
  g.fillStyle(0xe8a94e, 1);
  g.fillEllipse(CX, CY - 120, 260, 130);
  g.fillStyle(0xd99a3f, 1);
  g.fillEllipse(CX, CY - 105, 260, 100);
  // 芝麻
  g.fillStyle(0xf7d9a0, 1);
  [-70, -25, 30, 70].forEach((dx, i) => {
    g.fillEllipse(CX + dx, CY - (155 - Math.abs(dx) * 0.25 + (i % 2 ? 6 : 0)), 14, 9);
  });

  // ---- 生菜（波浪边） ----
  g.fillStyle(0x6cbf3e, 1);
  g.fillRect(CX - 130, CY - 75, 260, 18);
  for (let i = 0; i < 8; i++) {
    g.fillCircle(CX - 113 + i * 32, CY - 57, 12);
  }

  // ---- 肉饼 ----
  g.fillStyle(0x7a4526, 1);
  g.fillRoundedRect(CX - 128, CY - 50, 256, 40, 18);
  g.fillStyle(0x5e341c, 1);
  g.fillRoundedRect(CX - 128, CY - 22, 256, 12, 6);

  // ---- 番茄片 ----
  g.fillStyle(0xe74c3c, 1);
  g.fillRoundedRect(CX - 110, CY - 8, 220, 22, 10);
  g.fillStyle(0xf17a6b, 1);
  g.fillRoundedRect(CX - 100, CY - 4, 200, 8, 4);

  // ---- 底层面包 ----
  g.fillStyle(0xe8a94e, 1);
  g.fillRoundedRect(CX - 125, CY + 16, 250, 55, 16);
  g.fillStyle(0xd99a3f, 1);
  g.fillRoundedRect(CX - 125, CY + 56, 250, 15, 8);

  g.generateTexture(STYLE_SAMPLE_KEY, BOX, BOX);
  g.destroy();
  return STYLE_SAMPLE_KEY;
}

/** 在场景中放置汉堡样张（按内容重心对齐给定坐标） */
export function addStyleSampleBurger(
  scene: Phaser.Scene,
  x: number,
  y: number,
  scale = 1,
): Phaser.GameObjects.Image {
  const key = createStyleSampleBurgerTexture(scene);
  return scene.add
    .image(x, y, key)
    .setOrigin(0.5, CY / BOX)
    .setScale(scale);
}
