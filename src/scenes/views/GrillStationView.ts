import Phaser from 'phaser';
import { C, hex } from '../../art/palette';
import { drawPatty } from '../../art/drawFood';
import { BALANCE } from '../../config/balance';
import { cookedLevel, isBurnt, isCold, pattyStatus, shouldFlip, targetLevel } from '../../systems/GrillSim';
import { drawBar, drawPanel, toast } from '../../ui/widgets';
import type { GameState } from '../../core/GameState';
import type { Doneness, Patty } from '../../types';

interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 烤肉台：12 格烤架 + 保温托盘 + 肉饼盒 */
export class GrillStationView {
  private readonly scene: Phaser.Scene;
  private readonly state: GameState;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly dyn: Phaser.GameObjects.Graphics;
  private readonly labelLayer: Phaser.GameObjects.Container;
  private readonly slots: SlotRect[] = [];
  private readonly trayRects: SlotRect[] = [];
  private readonly slotLabels: (Phaser.GameObjects.Text | null)[] = [];
  private boxRect: SlotRect;
  private dragging: { patty: Patty; from: { type: 'grill'; index: number } | { type: 'tray'; index: number }; ghost: Phaser.GameObjects.Graphics } | null = null;
  private hoverSlot = -1;

  constructor(scene: Phaser.Scene, state: GameState, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.state = state;
    this.layer = layer;

    // 计算 4×3 烤架格位
    const startX = 100;
    const startY = 130;
    const cellW = 180;
    const cellH = 130;
    for (let i = 0; i < BALANCE.grill.slots; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      this.slots.push({ x: startX + col * cellW, y: startY + row * cellH, w: cellW - 16, h: cellH - 16 });
      this.slotLabels.push(null);
    }

    // 保温托盘格位（底部一排）
    const trayY = 596;
    for (let i = 0; i < BALANCE.grill.traySlots; i++) {
      this.trayRects.push({ x: 96 + i * 96, y: trayY, w: 84, h: 84 });
    }
    // 肉饼盒
    this.boxRect = { x: 780, y: 596, w: 150, h: 84 };

    this.bg = scene.add.graphics();
    this.dyn = scene.add.graphics();
    this.labelLayer = scene.add.container(0, 0);
    this.layer.add([this.bg, this.dyn, this.labelLayer]);

    this.drawStatic();
    this.bindInput();
  }

  private drawStatic(): void {
    const g = this.bg;
    g.clear();
    // 后墙
    g.fillStyle(0x4a3a2c, 1);
    g.fillRect(0, 0, 960, 720);
    g.fillStyle(0x5a4636, 1);
    g.fillRect(0, 0, 960, 76);
    // 抽油烟罩
    g.fillStyle(C.steel, 1);
    g.fillRoundedRect(60, 60, 840, 42, 10);
    g.fillStyle(C.steelDark, 1);
    g.fillRect(60, 92, 840, 10);

    // 烤架台面
    g.fillStyle(C.grillBody, 1);
    g.fillRoundedRect(70, 104, 820, 420, 18);
    g.fillStyle(C.grillPlate, 1);
    g.fillRoundedRect(80, 114, 800, 400, 14);

    // 每个格位
    for (const s of this.slots) {
      g.fillStyle(C.grillSlot, 1);
      g.fillRoundedRect(s.x, s.y, s.w, s.h, 12);
      g.lineStyle(3, 0x22262c, 1);
      g.strokeRoundedRect(s.x, s.y, s.w, s.h, 12);
      // 格栅纹
      g.lineStyle(3, 0x3c424a, 1);
      for (let k = 1; k < 4; k++) {
        const y = s.y + (s.h / 4) * k;
        g.beginPath();
        g.moveTo(s.x + 8, y);
        g.lineTo(s.x + s.w - 8, y);
        g.strokePath();
      }
    }

    // 保温托盘区
    g.fillStyle(0x2b2f36, 1);
    g.fillRoundedRect(70, 566, 820, 140, 16);
    g.fillStyle(C.uiPanelLight, 0.08);
    g.fillRoundedRect(78, 574, 804, 124, 14);
    // 保温灯
    g.fillStyle(0xffd97a, 0.5);
    for (let i = 0; i < 4; i++) {
      g.fillEllipse(180 + i * 200, 566, 120, 26);
    }
    for (const r of this.trayRects) {
      g.fillStyle(C.tray, 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.lineStyle(3, C.steelDark, 1);
      g.strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
    }

    // 肉饼盒
    const b = this.boxRect;
    g.fillStyle(C.uiPanel, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, 12);
    g.lineStyle(4, C.uiPrimary, 1);
    g.strokeRoundedRect(b.x, b.y, b.w, b.h, 12);
    g.fillStyle(0xe8dfd0, 1);
    g.fillRoundedRect(b.x + 12, b.y + 10, b.w - 24, 26, 8);
  }

  /** 每帧重绘动态内容 */
  update(): void {
    const g = this.dyn;
    g.clear();
    this.clearLabels();

    const hoveredPatty =
      this.hoverSlot >= 0 && this.hoverSlot < this.state.grill.length ? this.state.grill[this.hoverSlot] : null;
    /** 参考火候：取最早一张待处理小票（原版肉饼不带火候，玩家对照小票烤） */
    const ref = this.state.referenceDoneness;

    // ---- 烤架上的肉饼 ----
    this.state.grill.forEach((p, i) => {
      const s = this.slots[i];
      if (!p) return;
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      this.drawPattyWithState(g, cx, cy, p, 38);
      this.addPattyLabel(cx, cy + 54, p, ref);
      if (shouldFlip(p, ref)) {
        // 翻面提示箭头
        g.fillStyle(C.uiPrimary, 0.9);
        g.fillTriangle(cx - 12, cy - 46, cx + 12, cy - 46, cx, cy - 62);
      }
    });

    // ---- 保温托盘 ----
    this.state.tray.forEach((p, i) => {
      const r = this.trayRects[i];
      if (!r) return;
      this.drawPattyWithState(g, r.x + r.w / 2, r.y + r.h / 2, p, 27);
      if (isCold(p)) {
        const t = this.scene.add
          .text(r.x + r.w / 2, r.y + r.h - 6, '凉', {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: '13px',
            color: '#9fd0ff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        this.labelLayer.add(t);
      }
    });

    // ---- 肉饼盒 ----
    const b = this.boxRect;
    g.fillStyle(0xe8dfd0, 1);
    for (let i = 0; i < Math.min(6, this.state.pattiesLeft); i++) {
      drawPatty(g, b.x + 28 + i * 18, b.y + 52, 15, 0);
    }
    const boxText = this.scene.add
      .text(b.x + b.w / 2, b.y + 64, `×${this.state.pattiesLeft}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#fff4dd',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.labelLayer.add(boxText);
    const boxTitle = this.scene.add
      .text(b.x + b.w / 2, b.y + 22, '生肉饼', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: '#3b2b1e',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.labelLayer.add(boxTitle);

    // ---- 悬停火候详情面板 ----
    if (hoveredPatty) {
      const s = this.slots[this.hoverSlot];
      drawPanel(g, s.x + 8, s.y - 4, 150, 92, 0x241a12, 10, C.uiPrimary);
      const lv = cookedLevel(hoveredPatty);
      const tg = targetLevel(ref);
      drawBar(g, s.x + 18, s.y + 46, 130, 12, lv / 1.4, lv > 1.05 ? C.uiRed : C.uiGreen, 0x000000);
      drawBar(g, s.x + 18, s.y + 64, 130, 12, tg / 1.4, C.uiPrimary, 0x000000);
      const info = this.scene.add
        .text(s.x + 18, s.y + 16, `${pattyStatus(hoveredPatty, ref)}\n上${(hoveredPatty.bottom * 100) | 0}% 下${(hoveredPatty.top * 100) | 0}%`, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '13px',
          color: '#fff4dd',
        })
        .setOrigin(0, 0.5);
      this.labelLayer.add(info);
    }

    // ---- 拖拽虚影 ----
    if (this.dragging) {
      this.dragging.ghost.clear();
      this.dragging.ghost.setPosition(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
      drawPatty(this.dragging.ghost, 0, 0, 36, cookedLevel(this.dragging.patty), this.dragging.patty.heat);
    }

    // ---- 顶部提示 ----
    const hint = this.scene.add
      .text(480, 34, '点击空格放肉饼 · 点击肉饼翻面 · 拖到下方保温盘 · 右键丢弃', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '17px',
        color: hex(C.uiTextLight),
      })
      .setOrigin(0.5);
    this.labelLayer.add(hint);
  }

  private drawPattyWithState(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    p: Patty,
    radius: number,
  ): void {
    drawPatty(g, cx, cy, radius, cookedLevel(p), p.heat);
    if (!p.flipped) {
      // 未翻面：标记顶面为「生」
      g.fillStyle(0xd98a86, 0.5);
      g.fillCircle(cx + radius * 0.72, cy - radius * 0.68, 7);
    }
    if (isBurnt(p)) {
      g.lineStyle(4, 0x1a0d05, 0.9);
      g.strokeCircle(cx, cy, radius + 3);
    }
  }

  private addPattyLabel(x: number, y: number, p: Patty, doneness: Doneness): void {
    const col = isBurnt(p) ? '#ff9a8a' : isCold(p) ? '#9fd0ff' : '#fff4dd';
    const t = this.scene.add
      .text(x, y, pattyStatus(p, doneness), {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: col,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.labelLayer.add(t);
  }

  private clearLabels(): void {
    this.labelLayer.removeAll(true);
    this.slotLabels.fill(null);
  }

  // ────────────────────── 输入 ──────────────────────

  private bindInput(): void {
    const zone = this.scene.add
      .zone(0, 0, 960, 720)
      .setOrigin(0)
      .setInteractive();
    this.layer.add(zone);

    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragging) return;
      this.hoverSlot = this.slotAt(pointer.x, pointer.y);
    });
    zone.on('pointerout', () => {
      this.hoverSlot = -1;
    });

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const sIdx = this.slotAt(pointer.x, pointer.y);
      // 1) 空格 → 取生肉饼
      if (sIdx >= 0) {
        if (this.state.grill[sIdx]) {
          // 已有肉饼：第二次点击翻面
          if (this.state.flipPatty(sIdx)) {
            toastAt(this.scene, pointer.x, pointer.y - 20, '翻面！');
          }
          return;
        }
        const p = this.state.takePattyFromBox(sIdx);
        if (p) toastAt(this.scene, pointer.x, pointer.y - 20, '下锅');
        return;
      }

      // 2) 保温盘 → 拖起来
      const tIdx = this.trayIndexAt(pointer.x, pointer.y);
      if (tIdx >= 0) {
        const p = this.state.tray[tIdx];
        if (!p) return;
        const ghost = this.scene.add.graphics();
        this.dragging = { patty: p, from: { type: 'tray', index: tIdx }, ghost };
        return;
      }

      // 3) 肉饼盒 → 提示
      if (inRect(pointer.x, pointer.y, this.boxRect)) {
        toastAt(this.scene, pointer.x, pointer.y - 30, '点击烤架空格放肉饼');
      }
    });

    // 拖拽中：跟随，松开落到烤架空格
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.dragging.ghost.setPosition(pointer.x, pointer.y);
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const d = this.dragging;
      this.dragging = null;
      d.ghost.destroy();

      const sIdx = this.slotAt(pointer.x, pointer.y);
      if (d.from.type === 'tray' && sIdx >= 0 && !this.state.grill[sIdx]) {
        // 从保温盘放回烤架
        this.state.tray.splice(d.from.index, 1);
        d.patty.offGrill = false;
        this.state.grill[sIdx] = d.patty;
        return;
      }
      // 落空：还原（从烤架移出但未命中目标）
      if (d.from.type === 'tray') {
        // 保持在原托盘位置
        return;
      }
    });

    // 右键丢弃烤架肉饼
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const sIdx = this.slotAt(pointer.x, pointer.y);
        if (sIdx >= 0 && this.state.grill[sIdx]) {
          this.state.trashPatty(sIdx);
          toastAt(this.scene, pointer.x, pointer.y, '丢弃');
        }
      }
    });
  }

  private slotAt(x: number, y: number): number {
    for (let i = 0; i < this.slots.length; i++) {
      if (inRect(x, y, this.slots[i])) return i;
    }
    return -1;
  }

  private trayIndexAt(x: number, y: number): number {
    for (let i = 0; i < this.trayRects.length; i++) {
      if (inRect(x, y, this.trayRects[i])) return i;
    }
    return -1;
  }

  destroy(): void {
    this.clearLabels();
  }
}

function inRect(x: number, y: number, r: SlotRect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function toastAt(scene: Phaser.Scene, x: number, y: number, text: string): void {
  toast(scene, x, y, text);
}
