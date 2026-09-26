import Phaser from 'phaser';
import { C } from '../../art/palette';
import { drawBurgerStack, drawIngredientIcon, drawPatty, stackLayout } from '../../art/drawFood';
import { BALANCE } from '../../config/balance';
import { SAUCES, SAUCE_ORDER, TOPPINGS, TOPPING_ORDER, unlockedSauces, unlockedToppings } from '../../config/ingredients';
import { cookedLevel } from '../../systems/GrillSim';
import { toast } from '../../ui/widgets';
import { drawSauceBottle, sauceBlobs } from '../../ui/TicketCard';
import type { GameState } from '../../core/GameState';
import type { SauceId, ToppingId } from '../../types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 组装台：左侧食材/酱料箱 · 中间堆叠区 · 右侧保温盘与托盘
 * 交互：点击食材箱取用 · 拖动已放食材微调位置 · 顶包封顶 · 酱料不可撤销
 */
export class BuildStationView {
  private readonly scene: Phaser.Scene;
  private readonly state: GameState;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly dyn: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Container;

  private readonly binRects = new Map<string, Rect>();
  private readonly trayRects: Rect[] = [];
  private sealRect: Rect;
  private plateRect: Rect;
  private trashRect: Rect;

  private dragOffsetItem: { index: number; startPointerX: number; startOffset: number } | null = null;

  constructor(scene: Phaser.Scene, state: GameState, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.state = state;
    this.layer = layer;

    this.bg = scene.add.graphics();
    this.dyn = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.layer.add([this.bg, this.dyn, this.labels]);

    // 食材箱（左列）+ 酱料瓶（左列下部）
    const bx = 28;
    let by = 118;
    const keys = [...TOPPING_ORDER, 'patty', 'bunBottom'];
    for (const k of keys) {
      this.binRects.set(k, { x: bx, y: by, w: 116, h: 74 });
      by += 82;
    }
    // 酱料瓶横排（重建时按解锁情况）
    this.sauceY = 636;
    this.sauceX0 = 190;

    // 保温盘
    for (let i = 0; i < 4; i++) {
      this.trayRects.push({ x: 620 + i * 84, y: 150, w: 76, h: 76 });
    }
    // 组装盘
    this.plateRect = { x: 300, y: 300, w: 320, h: 300 };
    // 封顶按钮
    this.sealRect = { x: 330, y: 640, w: 260, h: 56 };
    // 垃圾桶
    this.trashRect = { x: 900, y: 620, w: 50, h: 70 };

    this.drawStatic();
    this.bindInput();
    state.events.on('money:changed', () => this.drawStatic());
  }

  private sauceY: number;
  private sauceX0: number;

  private drawStatic(): void {
    const g = this.bg;
    g.clear();
    // 瓷砖后墙
    g.fillStyle(0xf7e6c9, 1);
    g.fillRect(0, 0, 960, 720);
    g.lineStyle(2, 0xe3d0ae, 1);
    for (let x = 0; x < 960; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 720);
      g.strokePath();
    }
    for (let y = 0; y < 720; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(960, y);
      g.strokePath();
    }
    // 操作台面
    g.fillStyle(C.counterTop, 1);
    g.fillRect(0, 96, 960, 624);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(0, 96, 960, 10);

    // 食材箱
    for (const [, r] of this.binRects) {
      g.fillStyle(C.uiPanel, 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.lineStyle(3, C.uiBorder, 1);
      g.strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 8);
    }

    // 组装盘
    const p = this.plateRect;
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(p.x + p.w / 2, p.y + p.h - 10, p.w, 90);
    g.fillStyle(C.plate, 1);
    g.fillEllipse(p.x + p.w / 2, p.y + p.h - 30, p.w, 110);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(p.x + p.w / 2, p.y + p.h - 36, p.w - 30, 90);

    // 保温盘外框
    for (const r of this.trayRects) {
      g.fillStyle(C.tray, 1);
      g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.lineStyle(3, C.steelDark, 1);
      g.strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
    }

    // 垃圾桶
    g.fillStyle(0x6b6f78, 1);
    g.fillRoundedRect(this.trashRect.x, this.trashRect.y, this.trashRect.w, this.trashRect.h, 8);
    g.lineStyle(3, 0x4a4e56, 1);
    g.strokeRoundedRect(this.trashRect.x, this.trashRect.y, this.trashRect.w, this.trashRect.h, 8);
  }

  update(): void {
    const g = this.dyn;
    g.clear();
    this.labels.removeAll(true);

    const rank = this.state.rank;
    const unlockedT = unlockedToppings(rank);
    const unlockedS = unlockedSauces(rank);

    // ---- 食材箱内容与名称 ----
    for (const [key, r] of this.binRects) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2 - 6;
      drawIngredientIcon(g, key, cx, cy);
      const names: Record<string, string> = {
        bunBottom: '底层面包',
        patty: '牛肉饼',
        ...Object.fromEntries(TOPPING_ORDER.map((t) => [t, TOPPINGS[t].name])),
      };
      const isLocked =
        (TOPPING_ORDER as string[]).includes(key) &&
        !unlockedT.includes(key as ToppingId);

      const t = this.scene.add
        .text(cx, r.y + r.h - 12, isLocked ? '未解锁' : names[key], {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '13px',
          color: isLocked ? '#9a8b78' : '#fff4dd',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.add(t);
      if (isLocked) {
        g.fillStyle(0x000000, 0.62);
        g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      }
    }

    // ---- 酱料瓶 ----
    SAUCE_ORDER.forEach((s, i) => {
      const x = this.sauceX0 + i * 96;
      const y = this.sauceY;
      const unlocked = unlockedS.includes(s);
      if (!unlocked) {
        g.fillStyle(0x000000, 0.5);
        g.fillEllipse(x, y + 16, 76, 76);
      } else {
        drawSauceBottle(g, x, y - 8, s, 1);
      }
      const t = this.scene.add
        .text(x, y + 44, unlocked ? SAUCES[s].name : '未解锁', {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '13px',
          color: unlocked ? '#3b2b1e' : '#9a8b78',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.add(t);
    });

    // ---- 保温盘上的肉饼 ----
    this.state.tray.slice(0, this.trayRects.length).forEach((p, i) => {
      const r = this.trayRects[i];
      drawPatty(g, r.x + r.w / 2, r.y + r.h / 2, 24, cookedLevel(p), p.heat);
      const t = this.scene.add
        .text(r.x + r.w / 2, r.y + r.h - 8, `${(cookedLevel(p) * 100) | 0}%`, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '12px',
          color: p.heat < BALANCE.grill.coldThreshold ? '#9fd0ff' : '#3b2b1e',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.add(t);
    });

    // ---- 组装盘上的堆叠 ----
    const baseY = this.plateRect.y + this.plateRect.h - 66;
    const cx = this.plateRect.x + this.plateRect.w / 2;
    const items = this.state.stack.map((s) => ({
      kind: s.kind === 'topping' ? (s.topping as string) : s.kind === 'sauce' ? 'sauce' : s.kind,
      topping: s.topping as string | undefined,
      sauce: s.sauce as string | undefined,
      blobs: s.blobs,
      pattyLevel: s.patty ? cookedLevel(s.patty) : 0.7,
      pattyHeat: s.patty?.heat ?? 1,
    }));

    // 堆叠时高度越高越小幅度左右摇摆（晃动感）
    const wobble = Math.min(1, this.state.stack.length / 9);
    const wobbleX = Math.sin(this.scene.time.now / 220) * 3.5 * wobble;
    drawBurgerStack(
      g,
      cx + wobbleX,
      baseY,
      items,
      (i) => this.state.stack[i]?.offset ?? 0,
    );

    // 堆叠高度提示
    if (this.state.stack.length > 0) {
      const heightT = this.scene.add
        .text(cx, baseY - (items.length + 2) * 22, `层数 ${this.state.stack.length}`, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '15px',
          color: '#7a6a56',
        })
        .setOrigin(0.5);
      this.labels.add(heightT);
    }

    // ---- 封顶按钮 ----
    const hasBottom = this.state.stack.some((s) => s.kind === 'bunBottom');
    const canSeal = hasBottom && this.state.stack.length >= 2 && !this.state.trayBurger;
    const s = this.sealRect;
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(s.x + 3, s.y + 5, s.w, s.h, 14);
    g.fillStyle(canSeal ? C.uiGreenDark : 0x8a8078, 1);
    g.fillRoundedRect(s.x, s.y, s.w, s.h, 14);
    g.fillStyle(canSeal ? C.uiGreen : 0xa8a099, 1);
    g.fillRoundedRect(s.x, s.y, s.w, s.h - 5, 14);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(s.x + 8, s.y + 6, s.w - 16, 18, 9);
    g.lineStyle(3, C.uiBorder, 0.9);
    g.strokeRoundedRect(s.x, s.y, s.w, s.h, 14);
    const sealT = this.scene.add
      .text(s.x + s.w / 2, s.y + s.h / 2 - 2, this.state.trayBurger ? '托盘已有汉堡' : '盖上顶层面包', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#fff4dd',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.labels.add(sealT);

    // ---- 托盘上已完成的汉堡 ----
    if (this.state.trayBurger) {
      const trayX = 800;
      const trayY = 560;
      g.fillStyle(C.tray, 1);
      g.fillRoundedRect(trayX - 100, trayY - 40, 200, 120, 14);
      g.lineStyle(4, C.uiPrimary, 1);
      g.strokeRoundedRect(trayX - 100, trayY - 40, 200, 120, 14);
      drawBurgerStack(
        g,
        trayX,
        trayY + 60,
        this.state.trayBurger.stack.map((it) => ({
          kind: it.kind === 'topping' ? (it.topping as string) : it.kind === 'sauce' ? 'sauce' : it.kind,
          sauce: it.sauce as string | undefined,
          blobs: it.blobs,
          pattyLevel: it.patty ? cookedLevel(it.patty) : 0.7,
          pattyHeat: it.patty?.heat ?? 1,
        })),
        (i) => this.state.trayBurger!.stack[i]?.offset ?? 0,
      );
      g.fillStyle(0xffffff, 0.6);
      g.fillRoundedRect(trayX - 100, trayY - 40, 200, 24, 14);
      const trayTitle = this.scene.add
        .text(trayX, trayY - 28, '待交付 · 把对应小票拖到这里', {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '13px',
          color: '#3b2b1e',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.labels.add(trayTitle);
      // 标记托盘热区（供 GameScene 判定小票落点）
      this.trayDropRect = { x: trayX - 100, y: trayY - 40, w: 200, h: 120 };
    } else {
      this.trayDropRect = null;
    }

    // ---- 顶部提示 ----
    const hint = this.scene.add
      .text(480, 40, '点击左侧食材/酱料添加 · 拖动堆叠微调位置 · 点垃圾桶取回顶层', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '17px',
        color: '#5a4636',
      })
      .setOrigin(0.5);
    this.labels.add(hint);
  }

  /** 托盘热区（小票落点判定用） */
  trayDropRect: Rect | null = null;

  // ────────────────────── 输入 ──────────────────────

  private bindInput(): void {
    const zone = this.scene.add.zone(0, 0, 960, 720).setOrigin(0).setInteractive();
    this.layer.add(zone);

    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.x;
      const y = pointer.y;

      // 封顶
      if (inRect(x, y, this.sealRect)) {
        this.trySeal();
        return;
      }

      // 垃圾桶 → 取回顶层
      if (inRect(x, y, this.trashRect)) {
        const removed = this.state.popFromStack();
        if (removed) toastAt(this.scene, x, y - 20, '已取回');
        return;
      }

      // 保温盘肉饼 → 加入堆叠
      const tIdx = this.trayRects.findIndex((r) => inRect(x, y, r));
      if (tIdx >= 0) {
        this.addPattyToStack(tIdx);
        return;
      }

      // 酱料瓶
      if (y > 600) {
        const i = Math.round((x - this.sauceX0) / 96);
        if (Math.abs(x - (this.sauceX0 + i * 96)) < 44 && i >= 0 && i < SAUCE_ORDER.length) {
          this.addSauce(SAUCE_ORDER[i]);
          return;
        }
      }

      // 食材箱
      for (const [key, r] of this.binRects) {
        if (!inRect(x, y, r)) continue;
        this.addBinItem(key);
        return;
      }

      // 拖动堆叠项微调
      this.dragOffsetItem = null;
    });

    // 拖动堆叠项调整水平位置
    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || this.dragOffsetItem === null) return;
      const it = this.state.stack[this.dragOffsetItem.index];
      if (!it) return;
      it.offset = Phaser.Math.Clamp(this.dragOffsetItem.startOffset + (pointer.x - this.dragOffsetItem.startPointerX), -70, 70);
    });

    // 在堆叠区域按下 → 开始拖动最上面一项
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const p = this.plateRect;
      if (!inRect(pointer.x, pointer.y, p)) return;
      if (this.state.stack.length === 0) return;
      const topIndex = this.state.stack.length - 1;
      // 只允许拖动顶三项（符合直观）
      for (let i = this.state.stack.length - 1; i >= Math.max(0, this.state.stack.length - 3); i--) {
        const y = this.stackItemY(i);
        if (Math.abs(pointer.y - y) < 26) {
          this.dragOffsetItem = { index: i, startPointerX: pointer.x, startOffset: this.state.stack[i].offset };
          return;
        }
      }
      this.dragOffsetItem = { index: topIndex, startPointerX: pointer.x, startOffset: this.state.stack[topIndex].offset };
    });

    this.scene.input.on('pointerup', () => {
      this.dragOffsetItem = null;
    });
  }

  /** 第 i 层在屏幕上的 y（用于命中判定） */
  private stackItemY(index: number): number {
    const baseY = this.plateRect.y + this.plateRect.h - 66;
    let layer = 0;
    for (let i = 0; i <= index; i++) {
      const kind = this.state.stack[i]?.kind;
      layer += kind === 'patty' ? 1.3 : kind === 'bunBottom' ? 0.9 : kind === 'sauce' ? 0.35 : kind === 'bunTop' ? 1.1 : 0.75;
    }
    return baseY + stackLayout(layer - 0.6);
  }

  private addBinItem(key: string): void {
    if (this.state.trayBurger) {
      toastAt(this.scene, 480, 400, '托盘上已有汉堡，先交付或丢弃');
      return;
    }
    // 必须先放底包
    const hasBottom = this.state.stack.some((s) => s.kind === 'bunBottom');
    if (!hasBottom && key !== 'bunBottom') {
      toastAt(this.scene, 480, 400, '先放底层面包');
      return;
    }
    if (key === 'bunBottom') {
      if (hasBottom) {
        toastAt(this.scene, 480, 400, '底层面包已放过');
        return;
      }
      this.state.addToStack({ kind: 'bunBottom', offset: 0 });
      return;
    }
    if (key === 'patty') {
      toastAt(this.scene, 300, 300, '肉饼要从烤肉台的保温盘取');
      return;
    }
    // 配料解锁校验
    if ((TOPPING_ORDER as string[]).includes(key) && !unlockedToppings(this.state.rank).includes(key as ToppingId)) {
      toastAt(this.scene, 480, 400, '该食材尚未解锁');
      return;
    }
    const def = TOPPINGS[key as ToppingId];
    this.state.addToStack({ kind: 'topping', topping: def.id, offset: 0 });
  }

  private addPattyToStack(trayIndex: number): void {
    if (this.state.trayBurger) {
      toastAt(this.scene, 480, 400, '托盘上已有汉堡');
      return;
    }
    if (!this.state.stack.some((s) => s.kind === 'bunBottom')) {
      toastAt(this.scene, 480, 400, '先放底层面包');
      return;
    }
    const p = this.state.takePattyFromTray(trayIndex);
    if (!p) return;
    this.state.addToStack({ kind: 'patty', offset: 0, patty: p });
  }

  private addSauce(sauce: SauceId): void {
    if (this.state.trayBurger) {
      toastAt(this.scene, 480, 400, '托盘上已有汉堡');
      return;
    }
    if (!unlockedSauces(this.state.rank).includes(sauce)) {
      toastAt(this.scene, 480, 400, '该酱料尚未解锁');
      return;
    }
    if (!this.state.stack.some((s) => s.kind === 'bunBottom')) {
      toastAt(this.scene, 480, 400, '先放底层面包');
      return;
    }
    this.state.addToStack({ kind: 'sauce', sauce, offset: 0, blobs: sauceBlobs(0, 7) });
    toastAt(this.scene, 200, this.sauceY - 40, '挤上酱料（不可撤销）');
  }

  private trySeal(): void {
    if (this.state.trayBurger) {
      toastAt(this.scene, 480, 400, '托盘上已有汉堡');
      return;
    }
    if (!this.state.stack.some((s) => s.kind === 'bunBottom')) {
      toastAt(this.scene, 480, 400, '还没有底层面包');
      return;
    }
    this.state.addToStack({ kind: 'bunTop', offset: 0 });
    const ok = this.state.sealBurger();
    if (ok) {
      toastAt(this.scene, 480, 500, '汉堡做好了！拖小票到托盘交付');
    }
  }

  destroy(): void {
    this.labels.removeAll(true);
  }
}

function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function toastAt(scene: Phaser.Scene, x: number, y: number, text: string): void {
  toast(scene, x, y, text);
}
