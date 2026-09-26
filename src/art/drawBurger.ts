import Phaser from 'phaser';

/**
 * 程序化美术样张：用 Graphics 绘制一个汉堡并烘焙为纹理。
 * 这是 PLAN.md §3.3「程序化矢量高仿」路线的可行性验证——
 * 后续所有食材/场景资产都将走这条管线（Graphics → generateTexture）。
 */
export function drawStyleSampleBurger(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  scale = 1,
): void {
  const g = scene.add.graphics();

  // ---- 顶层面包（拱形 + 芝麻） ----
  g.fillStyle(0xe8a94e, 1);
  g.fillEllipse(cx, cy - 120 * scale, 260 * scale, 130 * scale);
  g.fillStyle(0xd99a3f, 1);
  g.fillEllipse(cx, cy - 105 * scale, 260 * scale, 100 * scale);
  g.fillStyle(0xf7d9a0, 1);
  [-70, -25, 30, 70].forEach((dx, i) => {
    g.fillEllipse(
      cx + dx * scale,
      cy - (155 - Math.abs(dx) * 0.25 + (i % 2 ? 6 : 0)) * scale,
      14 * scale,
      9 * scale,
    );
  });

  // ---- 生菜（波浪边） ----
  g.fillStyle(0x6cbf3e, 1);
  g.fillRect(cx - 130 * scale, cy - 75 * scale, 260 * scale, 18 * scale);
  for (let i = 0; i < 8; i++) {
    g.fillCircle(cx - 113 * scale + i * 32 * scale, cy - 57 * scale, 12 * scale);
  }

  // ---- 肉饼 ----
  g.fillStyle(0x7a4526, 1);
  g.fillRoundedRect(cx - 128 * scale, cy - 50 * scale, 256 * scale, 40 * scale, 18 * scale);
  g.fillStyle(0x5e341c, 1);
  g.fillRoundedRect(cx - 128 * scale, cy - 22 * scale, 256 * scale, 12 * scale, 6 * scale);

  // ---- 番茄片 ----
  g.fillStyle(0xe74c3c, 1);
  g.fillRoundedRect(cx - 110 * scale, cy - 8 * scale, 220 * scale, 22 * scale, 10 * scale);
  g.fillStyle(0xf17a6b, 1);
  g.fillRoundedRect(cx - 100 * scale, cy - 4 * scale, 200 * scale, 8 * scale, 4 * scale);

  // ---- 底层面包 ----
  g.fillStyle(0xe8a94e, 1);
  g.fillRoundedRect(cx - 125 * scale, cy + 16 * scale, 250 * scale, 55 * scale, 16 * scale);
  g.fillStyle(0xd99a3f, 1);
  g.fillRoundedRect(cx - 125 * scale, cy + 56 * scale, 250 * scale, 15 * scale, 8 * scale);

  g.generateTexture('style-sample-burger', 600, 600);
  g.destroy();
}
