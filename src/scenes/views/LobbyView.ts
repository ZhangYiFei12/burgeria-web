import Phaser from 'phaser';
import { C, hex } from '../../art/palette';
import { drawPatienceRing, CustomerSprite, type Expression } from '../../art/drawCustomer';
import type { GameState } from '../../core/GameState';
import type { Customer } from '../../types';

/** 大厅：顾客排队区 + 耐心环 + 接单交互（原版顾客在店门前等候） */
export class LobbyView {
  private readonly scene: Phaser.Scene;
  private readonly state: GameState;
  private readonly layer: Phaser.GameObjects.Container;
  private readonly sprites = new Map<string, { sprite: CustomerSprite; ring: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }>();
  private readonly queueXs: number[];

  constructor(scene: Phaser.Scene, state: GameState, layer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.state = state;
    this.layer = layer;
    this.queueXs = [170, 310, 450, 590, 730];

    state.events.on('customer:arrived', ({ customer }) => this.addCustomer(customer));
    state.events.on('customer:left', ({ customer }) => this.removeCustomer(customer.uid));
    state.events.on('customer:served', ({ customer }) => this.removeCustomer(customer.uid));
  }

  /** 每帧更新耐心环与位置 */
  update(): void {
    const waiting = this.state.customers.filter((c) => c.phase !== 'done');
    waiting.forEach((c, i) => {
      const entry = this.sprites.get(c.uid);
      if (!entry) return;
      const targetX = this.queueXs[Math.min(i, this.queueXs.length - 1)];
      const targetY = 250 + (i % 2) * 14;
      entry.sprite.x += (targetX - entry.sprite.x) * 0.08;
      entry.sprite.y += (targetY - entry.sprite.y) * 0.08;
      entry.sprite.setDepth(100 - i);
      entry.label.setPosition(entry.sprite.x, entry.sprite.y + 62);
      entry.ring.setPosition(entry.sprite.x, entry.sprite.y);

      const ratio = c.patienceLeft / c.patienceMax;
      const color = ratio > 0.55 ? C.uiGreen : ratio > 0.28 ? C.uiPrimary : C.uiRed;
      entry.ring.clear();
      if (c.phase === 'waiting' || c.phase === 'queued') {
        drawPatienceRing(entry.ring, 0, -52, 12, ratio, color);
      }

      const expr: Expression =
        c.phase === 'done'
          ? 'happy'
          : ratio > 0.55
            ? 'idle'
            : ratio > 0.28
              ? 'annoyed'
              : 'angry';
      entry.sprite.setExpression(expr);

      // 点单进度提示
      if (c.phase === 'ordering') {
        entry.label.setText('点单中…');
        entry.label.setColor(hex(C.uiPrimaryDark));
      } else if (c.phase === 'waiting') {
        entry.label.setText(c.def.name + ' 等餐中');
        entry.label.setColor('#f5e6c8');
      } else {
        entry.label.setText(`${c.def.name} · 点击接单`);
        entry.label.setColor('#f5e6c8');
      }
    });
  }

  private addCustomer(c: Customer): void {
    const sprite = new CustomerSprite(this.scene, 130 + Math.random() * 40, 340, c.def);
    sprite.setScale(0.92);
    const ring = this.scene.add.graphics();
    const label = this.scene.add
      .text(sprite.x, sprite.y + 62, c.def.name, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: '#f5e6c8',
        backgroundColor: '#00000055',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5);

    // 点击接单
    sprite.setSize(80, 140);
    sprite.setInteractive(new Phaser.Geom.Rectangle(-40, -70, 80, 140), Phaser.Geom.Rectangle.Contains);
    sprite.on('pointerdown', () => this.tryTakeOrder(c.uid));

    this.layer.add([sprite, ring, label]);
    this.sprites.set(c.uid, { sprite, ring, label });

    // 入场补间
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 320 });
  }

  private tryTakeOrder(uid: string): void {
    const c = this.state.customerByUid(uid);
    if (!c || c.phase !== 'queued') return;
    if (this.state.startOrder(uid)) {
      this.scene.tweens.add({ targets: this.sprites.get(uid)?.sprite, scale: 1.04, duration: 140, yoyo: true });
    }
  }

  private removeCustomer(uid: string): void {
    const entry = this.sprites.get(uid);
    if (!entry) return;
    this.sprites.delete(uid);
    this.scene.tweens.add({
      targets: [entry.sprite, entry.label, entry.ring],
      alpha: 0,
      duration: 280,
      onComplete: () => {
        entry.sprite.destroy();
        entry.label.destroy();
        entry.ring.destroy();
      },
    });
  }

  destroy(): void {
    for (const uid of [...this.sprites.keys()]) this.removeCustomer(uid);
  }
}
