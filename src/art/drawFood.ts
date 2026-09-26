import Phaser from 'phaser';
import { C, lerpColor, shade } from './palette';

/**
 * 程序化食物绘制。
 * 汉堡部件用「即时重绘」而非预烘焙纹理 —— 因为肉饼颜色/顶部小票内容都随状态变化。
 */

/** 熟度 0..1.5 → 肉饼颜色（含焦化） */
export function pattyColor(level: number): number {
  if (level <= 0.35) return lerpColor(0xd98a86, 0xb06a4a, level / 0.35);
  if (level <= 0.7) return lerpColor(0xb06a4a, 0x7a4526, (level - 0.35) / 0.35);
  if (level <= 1.0) return lerpColor(0x7a4526, 0x4a2a17, (level - 0.7) / 0.3);
  return lerpColor(0x4a2a17, 0x241108, Math.min(1, (level - 1.0) / 0.3));
}

/** 熟度 → 肉饼边缘色 */
export function pattyEdgeColor(level: number): number {
  return shade(pattyColor(level), -0.18);
}

/**
 * 绘制一块肉饼（正面俯视 + 侧面厚度）
 * @param heat 保温值 0..1，越低越偏灰蓝（还原「凉了」的视觉）
 */
export function drawPatty(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius = 34,
  level = 0,
  heat = 1,
): void {
  const base = pattyColor(level);
  const edge = pattyEdgeColor(level);
  const coldTint = 1 - Math.max(0, Math.min(1, heat));
  const face = lerpColor(base, 0x8d8d9c, coldTint * 0.35);
  const side = lerpColor(edge, 0x6d6d7c, coldTint * 0.35);

  // 侧面厚度
  g.fillStyle(side, 1);
  g.fillEllipse(cx, cy + radius * 0.34, radius * 2, radius * 0.9);
  // 正面
  g.fillStyle(face, 1);
  g.fillEllipse(cx, cy, radius * 2, radius * 1.5);

  // 煎烤纹理：熟度越高纹路越多
  const marks = Math.floor(Math.min(1, level / 0.8) * 6);
  g.fillStyle(lerpColor(face, 0x2a1408, 0.35), 0.85);
  for (let i = 0; i < marks; i++) {
    const ang = (i / 6) * Math.PI * 2 + 0.4;
    const rx = Math.cos(ang) * radius * 0.45;
    const ry = Math.sin(ang) * radius * 0.32;
    g.fillEllipse(cx + rx, cy + ry, radius * 0.42, radius * 0.16);
  }
  // 焦糊黑斑
  if (level >= 1.15) {
    g.fillStyle(0x1a0d05, 0.75);
    g.fillEllipse(cx - radius * 0.3, cy - radius * 0.15, radius * 0.5, radius * 0.34);
    g.fillEllipse(cx + radius * 0.35, cy + radius * 0.2, radius * 0.42, radius * 0.3);
  }
}

/** 底层面包（含厚度） */
export function drawBunBottom(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 128, h = 26): void {
  g.fillStyle(C.bunDark, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 11);
  g.fillStyle(C.bun, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h - 8, 11);
}

/** 顶层面包（拱形 + 芝麻） */
export function drawBunTop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 128, h = 46): void {
  g.fillStyle(C.bunDark, 1);
  g.fillEllipse(cx, cy, w, h);
  g.fillStyle(C.bun, 1);
  g.fillEllipse(cx, cy - 3, w - 6, h - 8);
  g.fillStyle(C.bunLight, 1);
  const seeds = [-0.3, -0.12, 0.06, 0.24];
  seeds.forEach((f, i) => {
    g.fillEllipse(cx + f * w, cy - h * (0.22 + (i % 2) * 0.14), w * 0.075, h * 0.11);
  });
}

/** 生菜（波浪边） */
export function drawLettuce(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 124, h = 16): void {
  const color = 0x6cbf3e;
  g.fillStyle(color, 1);
  g.fillRect(cx - w / 2, cy - h / 2, w, h * 0.7);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * (w / n);
    g.fillCircle(x, cy + h * 0.2, h * 0.52);
  }
  g.fillStyle(0x8fd45c, 1);
  g.fillRect(cx - w / 2 + 6, cy - h / 2 + 2, w - 12, 4);
}

/** 番茄片 */
export function drawTomato(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 116, h = 20): void {
  g.fillStyle(0xb93b2e, 1);
  g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 9);
  g.fillStyle(0xe74c3c, 1);
  g.fillRoundedRect(cx - w / 2 + 2, cy - h / 2, w - 4, h - 6, 9);
  g.fillStyle(0xf5907f, 1);
  g.fillRoundedRect(cx - w / 2 + 12, cy - h / 2 + 3, w - 24, 5, 3);
}

/** 洋葱圈（多个细环） */
export function drawOnion(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 124, h = 14): void {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * (w / n);
    g.fillStyle(0xd6c2e0, 1);
    g.fillEllipse(x, cy, w / n - 3, h);
    g.fillStyle(0xf8f0fb, 1);
    g.fillEllipse(x, cy, w / n - 9, h * 0.45);
  }
}

/** 酸黄瓜片 */
export function drawPickle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w = 124, h = 15): void {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = cx - w / 2 + (i + 0.5) * (w / n);
    g.fillStyle(0x6c9427, 1);
    g.fillEllipse(x, cy, w / n - 2, h);
    g.fillStyle(0x8fbf3f, 1);
    g.fillEllipse(x, cy, w / n - 7, h * 0.55);
  }
}

/** 酱料层（按采样点画不规则涂痕） */
export function drawSauce(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  color: number,
  blobs: { x: number; y: number; r: number }[],
  width = 128,
): void {
  g.fillStyle(color, 0.95);
  for (const b of blobs) {
    g.fillEllipse(cx + b.x * (width / 2), cy + (b.y - 0.5) * 8, b.r * width * 0.55, b.r * 34);
  }
}

/** 堆叠高度 → y 偏移（自下而上） */
export function stackLayout(layerIndex: number): number {
  return -layerIndex * 15;
}

/** 按堆叠层级绘制完整汉堡（从底到顶） */
export function drawBurgerStack(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  items: { kind: string; topping?: string; sauce?: string; blobs?: { x: number; y: number; r: number }[]; pattyLevel?: number; pattyHeat?: number }[],
  offsetOf?: (i: number) => number,
): void {
  let layer = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const dx = offsetOf ? offsetOf(i) : 0;
    const y = baseY + stackLayout(layer);
    switch (it.kind) {
      case 'bunBottom':
        drawBunBottom(g, cx + dx, y);
        layer += 0.9;
        break;
      case 'patty':
        drawPatty(g, cx + dx, y - 10, 34, it.pattyLevel ?? 0.7, it.pattyHeat ?? 1);
        layer += 1.3;
        break;
      case 'lettuce':
        drawLettuce(g, cx + dx, y - 8);
        layer += 0.75;
        break;
      case 'tomato':
        drawTomato(g, cx + dx, y - 10);
        layer += 0.85;
        break;
      case 'onion':
        drawOnion(g, cx + dx, y - 8);
        layer += 0.7;
        break;
      case 'pickle':
        drawPickle(g, cx + dx, y - 8);
        layer += 0.7;
        break;
      case 'sauce': {
        const colors: Record<string, number> = {
          ketchup: 0xd7352b,
          mustard: 0xe8c520,
          mayo: 0xf6f0dc,
        };
        drawSauce(g, cx + dx, y - 6, colors[it.sauce ?? 'ketchup'] ?? 0xd7352b, it.blobs ?? []);
        layer += 0.35;
        break;
      }
      case 'bunTop':
        drawBunTop(g, cx + dx, y - 26);
        layer += 1.1;
        break;
      default:
        break;
    }
  }
}

/** 单个食材图标（用于配料盒/酱料瓶 UI） */
export function drawIngredientIcon(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  cx: number,
  cy: number,
): void {
  switch (kind) {
    case 'bunBottom':
      drawBunBottom(g, cx, cy, 64, 20);
      break;
    case 'bunTop':
      drawBunTop(g, cx, cy, 64, 32);
      break;
    case 'patty':
      drawPatty(g, cx, cy, 22, 0.35, 1);
      break;
    case 'lettuce':
      drawLettuce(g, cx, cy, 62, 12);
      break;
    case 'tomato':
      drawTomato(g, cx, cy, 58, 16);
      break;
    case 'onion':
      drawOnion(g, cx, cy, 62, 11);
      break;
    case 'pickle':
      drawPickle(g, cx, cy, 62, 12);
      break;
    case 'ketchup':
      g.fillStyle(0xd7352b, 1);
      g.fillRoundedRect(cx - 12, cy - 16, 24, 34, 6);
      g.fillStyle(0xf5f0e6, 1);
      g.fillRoundedRect(cx - 5, cy - 22, 10, 8, 3);
      break;
    case 'mustard':
      g.fillStyle(0xe8c520, 1);
      g.fillRoundedRect(cx - 12, cy - 16, 24, 34, 6);
      g.fillStyle(0xf5f0e6, 1);
      g.fillRoundedRect(cx - 5, cy - 22, 10, 8, 3);
      break;
    case 'mayo':
      g.fillStyle(0xf6f0dc, 1);
      g.fillRoundedRect(cx - 12, cy - 16, 24, 34, 6);
      g.fillStyle(0xdcd6c4, 1);
      g.fillRoundedRect(cx - 5, cy - 22, 10, 8, 3);
      break;
    default:
      break;
  }
}
