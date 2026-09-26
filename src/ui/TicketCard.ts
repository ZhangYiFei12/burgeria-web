import Phaser from 'phaser';
import { C, hex } from '../art/palette';
import { drawSauce, drawIngredientIcon } from '../art/drawFood';
import { TOPPINGS } from '../config/ingredients';
import type { Ticket, TicketItem } from '../types';

/** 火候文案 */
export const DONENESS_LABEL: Record<string, string> = {
  rare: '三分熟',
  medium: '五分熟',
  well: '全熟',
};

/**
 * 小票渲染：可拖拽的订单纸
 * 布局：标题 → 肉饼(火候) → 各配料/酱料（自下而上）→ 提示
 */
export class TicketCard extends Phaser.GameObjects.Container {
  readonly ticket: Ticket;
  private readonly cardW = 168;
  private readonly cardH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, ticket: Ticket, draggable = true) {
    super(scene, x, y);
    this.ticket = ticket;

    const rows = ticket.items.length;
    this.cardH = 92 + rows * 26;

    const g = scene.add.graphics();
    // 纸面
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 5, this.cardW, this.cardH, 8);
    g.fillStyle(C.ticket, 1);
    g.fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 8);
    g.lineStyle(2, C.ticketLine, 1);
    g.strokeRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, 8);
    // 顶部色带
    g.fillStyle(C.uiPrimary, 1);
    g.fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, 30, 8);
    g.fillRect(-this.cardW / 2, -this.cardH / 2 + 20, this.cardW, 10);
    this.add(g);

    const title = scene.add
      .text(0, -this.cardH / 2 + 15, `订单 · ${DONENESS_LABEL[ticket.doneness]}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: hex(C.uiText),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(title);

    // 逐行渲染（自下而上：先底包 → 小票项 → 顶包）
    let rowY = -this.cardH / 2 + 48;
    const lineG = scene.add.graphics();
    this.add(lineG);

    const addRow = (label: string, iconKind: string, sub?: string) => {
      const ig = scene.add.graphics();
      drawIngredientIcon(ig, iconKind, -this.cardW / 2 + 22, rowY);
      this.add(ig);
      const t = scene.add
        .text(-this.cardW / 2 + 42, rowY, label, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '14px',
          color: hex(C.uiText),
        })
        .setOrigin(0, 0.5);
      this.add(t);
      if (sub) {
        const s = scene.add
          .text(this.cardW / 2 - 10, rowY, sub, {
            fontFamily: '"Microsoft YaHei", sans-serif',
            fontSize: '11px',
            color: '#8a7a66',
          })
          .setOrigin(1, 0.5);
        this.add(s);
      }
      rowY += 26;
    };

    addRow('底层面包', 'bunBottom');
    for (const item of ticket.items) {
      addRow(...this.describe(item));
    }
    addRow('顶层面包', 'bunTop');

    if (draggable) {
      this.setSize(this.cardW, this.cardH);
      this.setInteractive(
        new Phaser.Geom.Rectangle(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH),
        Phaser.Geom.Rectangle.Contains,
      );
      scene.input.setDraggable(this);
    }
    scene.add.existing(this);
  }

  /** 小票行文案 */
  private describe(item: TicketItem): [string, string, string?] {
    if (item.kind === 'patty') return ['牛肉饼', 'patty', '双面煎烤'];
    if (item.kind === 'topping') {
      const def = TOPPINGS[item.topping];
      return [def.name, item.topping];
    }
    const names: Record<string, string> = { ketchup: '番茄酱', mustard: '黄芥末', mayo: '蛋黄酱' };
    return [names[item.sauce] ?? item.sauce, item.sauce, '挤匀'];
  }

  get cardHeight(): number {
    return this.cardH;
  }
}

/** 小票架上的一张纸（固定展示，不可拖） */
export function createTicketOnWire(scene: Phaser.Scene, x: number, y: number, ticket: Ticket): TicketCard {
  const card = new TicketCard(scene, x, y, ticket, false);
  card.setScale(0.82);
  return card;
}

/** 酱料瓶图标（组装台点击用） */
export function drawSauceBottle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  sauce: string,
  scale = 1,
): void {
  const colors: Record<string, number> = { ketchup: 0xd7352b, mustard: 0xe8c520, mayo: 0xf6f0dc };
  const color = colors[sauce] ?? 0xd7352b;
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, cy + 34 * scale, 40 * scale, 12 * scale);
  g.fillStyle(color, 1);
  g.fillRoundedRect(cx - 16 * scale, cy - 14 * scale, 32 * scale, 48 * scale, 8 * scale);
  g.fillStyle(0xf5f0e6, 1);
  g.fillRoundedRect(cx - 7 * scale, cy - 26 * scale, 14 * scale, 14 * scale, 4 * scale);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(cx - 12 * scale, cy - 8 * scale, 7 * scale, 34 * scale, 4 * scale);
}

/** 酱料涂抹采样：一串小点 */
export function sauceBlobs(seedX: number, count = 7): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    out.push({ x: seedX * (0.62 - t * 1.24), y: 0.5 + Math.sin(i * 1.7) * 0.22, r: 0.18 + (i % 3) * 0.05 });
  }
  return out;
}

export { drawSauce };
