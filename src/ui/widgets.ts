import Phaser from 'phaser';
import { C, hex } from '../art/palette';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  colorDark?: number;
  textColor?: number;
  fontSize?: number;
  icon?: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void;
  radius?: number;
}

/**
 * 立体卡通按钮：底板 + 高光 + 按下位移 + 悬停缩放
 * 返回 Container，点击回调 onClick
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly bw: number;
  private readonly bh: number;
  private readonly color: number;
  private readonly colorDark: number;
  private readonly radius: number;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ) {
    super(scene, x, y);
    this.bw = opts.width ?? 160;
    this.bh = opts.height ?? 56;
    this.color = opts.color ?? C.uiPrimary;
    this.colorDark = opts.colorDark ?? C.uiPrimaryDark;
    this.radius = opts.radius ?? 14;

    this.bg = scene.add.graphics();
    this.add(this.bg);

    if (opts.icon) {
      const ig = scene.add.graphics();
      opts.icon(ig, -this.bw / 2 + 30, 0);
      this.add(ig);
    }

    this.label = scene.add
      .text(opts.icon ? 12 : 0, 0, text, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: `${opts.fontSize ?? 22}px`,
        color: hex(opts.textColor ?? 0x3b2b1e),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(this.label);

    this.redraw(false);

    this.setSize(this.bw, this.bh);
    this.setInteractive(new Phaser.Geom.Rectangle(-this.bw / 2, -this.bh / 2, this.bw, this.bh), Phaser.Geom.Rectangle.Contains);

    this.on('pointerover', () => this.enabled && this.redraw(true));
    this.on('pointerout', () => this.enabled && this.redraw(false));
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.y += 3;
      this.redraw(false);
    });
    this.on('pointerup', () => {
      if (!this.enabled) return;
      this.y -= 3;
      this.redraw(true);
      onClick();
    });

    scene.add.existing(this);
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.45);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  private redraw(hover: boolean): void {
    const g = this.bg;
    g.clear();
    const { bw: w, bh: h, radius } = this;
    const base = hover ? Math.min(0xffffff, this.color + 0x101010) : this.color;

    // 阴影
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, radius);
    // 深色底
    g.fillStyle(this.colorDark, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // 主色面
    g.fillStyle(base, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h - 5, radius);
    // 高光
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(-w / 2 + 7, -h / 2 + 5, w - 14, (h - 5) * 0.36, radius * 0.7);
    // 描边
    g.lineStyle(3, C.uiBorder, 0.85);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  }
}

/** 圆角面板（带描边 + 阴影） */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = C.uiPanelLight,
  radius = 16,
  border: number = C.uiBorder,
): void {
  g.fillStyle(0x000000, 0.2);
  g.fillRoundedRect(x, y + 6, w, h, radius);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(4, border, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}

/** 进度条 */
export function drawBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: number,
  bg = 0x000000,
): void {
  const r = Math.max(0, Math.min(1, ratio));
  g.fillStyle(bg, 0.3);
  g.fillRoundedRect(x, y, w, h, h / 2);
  if (r > 0) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, Math.max(h, w * r), h, h / 2);
  }
}

/** 星系 */
export function drawStar(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  filled = true,
): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? radius : radius * 0.45;
    pts.push(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  g.fillStyle(color, filled ? 1 : 0.22);
  g.fillPoints(
    pts.reduce<Phaser.Geom.Point[]>((acc, _, i, arr) => {
      if (i % 2 === 0) acc.push(new Phaser.Geom.Point(arr[i], arr[i + 1]));
      return acc;
    }, []),
    true,
  );
  g.lineStyle(2, 0x7a5a10, filled ? 0.9 : 0.25);
  g.strokePoints(
    pts.reduce<Phaser.Geom.Point[]>((acc, _, i, arr) => {
      if (i % 2 === 0) acc.push(new Phaser.Geom.Point(arr[i], arr[i + 1]));
      return acc;
    }, []),
    true,
    true,
  );
}

/** 浮动提示（toast）：从原地升起并淡出 */
export function toast(scene: Phaser.Scene, x: number, y: number, text: string, color = '#fff4dd'): void {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: '"Microsoft YaHei", sans-serif',
      fontSize: '22px',
      color,
      backgroundColor: '#3b2b1ecc',
      padding: { x: 12, y: 6 },
    })
    .setOrigin(0.5)
    .setDepth(9000);
  scene.tweens.add({
    targets: t,
    y: y - 54,
    alpha: 0,
    duration: 1200,
    ease: 'Cubic.easeOut',
    onComplete: () => t.destroy(),
  });
}
