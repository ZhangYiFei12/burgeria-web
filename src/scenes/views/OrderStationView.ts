import Phaser from 'phaser';
import { C, hex } from '../../art/palette';
import { drawBunBottom, drawBunTop } from '../../art/drawFood';
import { drawPanel } from '../../ui/widgets';
import { TicketCard, DONENESS_LABEL } from '../../ui/TicketCard';
import type { GameState } from '../../core/GameState';
import type { Ticket } from '../../types';

/**
 * 点单台：柜台 + 正在点单的顾客 + 小票架
 * 小票架支持从架上拖到「交付区」（由 GameScene 统一处理拖拽落点）
 */
export class OrderStationView {
  private readonly scene: Phaser.Scene;
  private readonly state: GameState;
  private readonly layer: Phaser.GameObjects.Container;
  private cards: TicketCard[] = [];
  private lockBar: Phaser.GameObjects.Graphics;
  private lockText: Phaser.GameObjects.Text;
  private counterG: Phaser.GameObjects.Graphics;

  /** 小票架槽位坐标 */
  static readonly WIRE_SLOTS: { x: number; y: number }[] = [
    { x: 640, y: 170 },
    { x: 800, y: 170 },
    { x: 640, y: 400 },
    { x: 800, y: 400 },
    { x: 560, y: 585 },
    { x: 720, y: 585 },
    { x: 880, y: 585 },
  ];

  constructor(scene: Phaser.Scene, state: GameState, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.state = state;
    this.layer = layer;

    this.counterG = scene.add.graphics();
    this.layer.add(this.counterG);
    this.drawCounter();

    this.lockBar = scene.add.graphics();
    this.lockText = scene.add
      .text(480, 640, '', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#fff4dd',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.layer.add([this.lockBar, this.lockText]);

    state.events.on('ticket:created', ({ ticket }) => this.addTicket(ticket));
    state.events.on('customer:served', () => this.refresh());
    state.events.on('customer:left', () => this.refresh());
  }

  private drawCounter(): void {
    const g = this.counterG;
    g.clear();
    // 后墙 + 柜台
    g.fillStyle(C.wall, 1);
    g.fillRoundedRect(0, 60, 960, 300, 0);
    g.fillStyle(C.wallShade, 1);
    g.fillRoundedRect(0, 300, 960, 60, 0);
    // 菜单板
    g.fillStyle(C.uiPanel, 1);
    g.fillRoundedRect(60, 92, 300, 120, 12);
    g.lineStyle(4, C.wood, 1);
    g.strokeRoundedRect(60, 92, 300, 120, 12);
    // 柜台
    g.fillStyle(C.counterTop, 1);
    g.fillRect(0, 360, 960, 26);
    g.fillStyle(C.counter, 1);
    g.fillRect(0, 386, 960, 120);
    g.fillStyle(C.woodDark, 1);
    for (let i = 0; i < 8; i++) g.fillRect(20 + i * 120, 400, 6, 100);
    // 小票架（铁丝）
    g.lineStyle(6, 0x6b6f78, 1);
    g.beginPath();
    g.moveTo(560, 210);
    g.lineTo(900, 210);
    g.strokePath();

    // 标题
    this.scene.add
      .text(210, 120, '点 单 台', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '30px',
        color: hex(C.uiTextLight),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setName('stationTitle');
    const title = this.scene.children.getByName('stationTitle');
    if (title) this.layer.add(title);

    // 装饰：汉堡招牌
    const deco = this.scene.add.graphics();
    drawBunBottom(deco, 210, 178, 160, 26);
    drawBunTop(deco, 210, 150, 160, 46);
    this.layer.add(deco);
  }

  private addTicket(ticket: Ticket): void {
    // 音效/提示：小票打印动画
    const idx = this.cards.length;
    const slot = OrderStationView.WIRE_SLOTS[Math.min(idx, OrderStationView.WIRE_SLOTS.length - 1)];
    const card = new TicketCard(this.scene, slot.x, slot.y - 6, ticket, true);
    card.setScale(0.9);
    card.setData('slot', idx);
    this.layer.add(card);
    this.cards.push(card);

    // 从架子上滑下
    const startY = slot.y - 46;
    card.y = startY;
    this.scene.tweens.add({ targets: card, y: slot.y, duration: 260, ease: 'Back.easeOut' });

    // 拖拽事件：交给场景处理落点判定
    card.on('dragstart', () => card.setScale(0.98).setDepth(500));
    card.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      card.x = dx;
      card.y = dy;
    });
    card.on('dragend', () => {
      card.setDepth(1);
      card.setScale(0.9);
      this.scene.events.emit('ticket:dropped', card);
    });
  }

  /** 重新排布小票（顾客离开后回收空槽） */
  refresh(): void {
    const live = this.state.pendingTickets;
    this.cards = this.cards.filter((c) => {
      if (live.some((t) => t.id === c.ticket.id)) return true;
      c.destroy();
      return false;
    });
    this.cards.forEach((c, i) => {
      const slot = OrderStationView.WIRE_SLOTS[Math.min(i, OrderStationView.WIRE_SLOTS.length - 1)];
      this.scene.tweens.add({ targets: c, x: slot.x, y: slot.y, duration: 220 });
    });
  }

  /** 每帧更新接单锁定条 */
  update(): void {
    const g = this.lockBar;
    g.clear();
    if (this.state.hasOrderLock) {
      const ratio = 1 - this.state.orderLockMs / 5000;
      const c = this.state.orderingCustomerUid ? this.state.customerByUid(this.state.orderingCustomerUid) : null;
      this.lockText.setText(`正在为 ${c?.def.name ?? ''} 点单…  无法切换工作站`);
      drawPanel(g, 330, 612, 300, 26, 0x00000055, 13, 0x00000000);
      g.fillStyle(C.uiPrimary, 1);
      g.fillRoundedRect(332, 614, 296 * ratio, 22, 11);
      // 进度条外框
      g.lineStyle(3, C.uiPanelLight, 1);
      g.strokeRoundedRect(330, 612, 300, 26, 13);
      this.lockText.setVisible(true);
    } else {
      this.lockText.setVisible(false);
    }
  }

  destroy(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
  }

  /** 借用的火候文案（避免未使用告警，同时供 UI 复用） */
  static donenessLabel(d: string): string {
    return DONENESS_LABEL[d] ?? d;
  }
}
