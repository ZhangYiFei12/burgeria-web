import Phaser from 'phaser';
import type { CustomerDef } from '../types';
import { shade } from './palette';

export type Expression = 'idle' | 'happy' | 'annoyed' | 'angry';

/**
 * 参数化顾客绘制：每位顾客由 look 参数组合出独立形象（大头 Q 版）
 * 返回 Container，可通过 setExpression 切换表情
 */
export class CustomerSprite extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly def: CustomerDef;
  private expression: Expression = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, def: CustomerDef) {
    super(scene, x, y);
    this.def = def;
    this.g = scene.add.graphics();
    this.add(this.g);
    this.redraw();
    scene.add.existing(this);
  }

  setExpression(e: Expression): this {
    if (this.expression === e) return this;
    this.expression = e;
    this.redraw();
    return this;
  }

  get customerDef(): CustomerDef {
    return this.def;
  }

  private redraw(): void {
    const g = this.g;
    g.clear();
    const { skin, hair, hairStyle, shirt, hat } = this.def.look;

    // ---- 身体 ----
    g.fillStyle(shade(shirt, -0.2), 1);
    g.fillRoundedRect(-27, 10, 54, 56, 16);
    g.fillStyle(shirt, 1);
    g.fillRoundedRect(-27, 8, 54, 50, 16);
    // 手臂
    g.fillStyle(skin, 1);
    g.fillCircle(-30, 38, 8);
    g.fillCircle(30, 38, 8);

    // ---- 头 ----
    g.fillStyle(skin, 1);
    g.fillEllipse(0, -18, 62, 60);
    // 耳朵
    g.fillCircle(-31, -16, 6);
    g.fillCircle(31, -16, 6);

    // ---- 发型 ----
    g.fillStyle(hair, 1);
    switch (hairStyle) {
      case 0: // 短发
        g.fillEllipse(0, -40, 64, 36);
        g.fillRect(-32, -40, 64, 12);
        break;
      case 1: // 长发
        g.fillEllipse(0, -40, 68, 40);
        g.fillRoundedRect(-36, -38, 12, 56, 6);
        g.fillRoundedRect(24, -38, 12, 56, 6);
        break;
      case 2: // 地中海 + 胡子
        g.fillEllipse(-26, -30, 24, 20);
        g.fillEllipse(26, -30, 24, 20);
        g.fillRect(-30, -12, 60, 10); // 胡须
        break;
      case 3: // 刺猬头
        g.fillEllipse(0, -40, 62, 32);
        for (let i = 0; i < 5; i++) {
          const x = -24 + i * 12;
          g.fillTriangle(x - 5, -48, x + 5, -48, x, -62);
        }
        break;
      default:
        break;
    }

    // ---- 帽子 ----
    if (hat) {
      g.fillStyle(shade(shirt, -0.15), 1);
      g.fillEllipse(0, -46, 70, 22);
      g.fillRoundedRect(-28, -66, 56, 24, 10);
      g.fillStyle(shade(shirt, 0.25), 1);
      g.fillRect(-28, -50, 56, 5);
    }

    // ---- 表情 ----
    const eyeY = -20;
    const mouthColor = 0x5a2b1e;
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-13, eyeY, 15, 16);
    g.fillEllipse(13, eyeY, 15, 16);
    g.fillStyle(0x26170f, 1);
    if (this.expression === 'angry') {
      g.fillCircle(-13, eyeY + 1, 4);
      g.fillCircle(13, eyeY + 1, 4);
      g.fillStyle(hair, 1); // 怒眉
      g.fillTriangle(-22, eyeY - 12, -4, eyeY - 4, -22, eyeY - 3);
      g.fillTriangle(22, eyeY - 12, 4, eyeY - 4, 22, eyeY - 3);
    } else if (this.expression === 'annoyed') {
      g.fillCircle(-13, eyeY + 1, 3.4);
      g.fillCircle(13, eyeY + 1, 3.4);
      g.fillStyle(hair, 1);
      g.fillRect(-22, eyeY - 10, 15, 4);
      g.fillRect(7, eyeY - 10, 15, 4);
    } else {
      g.fillCircle(-13, eyeY, 4.2);
      g.fillCircle(13, eyeY, 4.2);
    }

    // 嘴
    g.lineStyle(3, mouthColor, 1);
    if (this.expression === 'happy') {
      g.beginPath();
      g.arc(0, -2, 12, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokePath();
    } else if (this.expression === 'angry' || this.expression === 'annoyed') {
      g.beginPath();
      g.arc(0, 10, 11, 1.15 * Math.PI, 1.85 * Math.PI);
      g.strokePath();
    } else {
      g.beginPath();
      g.moveTo(-7, 3);
      g.lineTo(7, 3);
      g.strokePath();
    }

    // 腮红
    if (this.expression === 'happy') {
      g.fillStyle(0xf08a8a, 0.35);
      g.fillCircle(-20, -6, 6);
      g.fillCircle(20, -6, 6);
    }
  }
}

/** 头顶耐心环（hud 用，独立 Graphics 以便每帧重绘） */
export function drawPatienceRing(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radius: number,
  ratio: number,
  color: number,
): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  g.lineStyle(5, 0x000000, 0.18);
  g.strokeCircle(cx, cy, radius);
  g.lineStyle(5, color, 1);
  g.beginPath();
  g.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamped);
  g.strokePath();
}
