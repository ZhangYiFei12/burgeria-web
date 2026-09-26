import Phaser from 'phaser';
import { C, hex } from '../art/palette';
import { GameState } from '../core/GameState';
import type { ServeResult, StationId } from '../types';
import { Button, drawPanel, drawStar, toast } from '../ui/widgets';
import { LobbyView } from './views/LobbyView';
import { OrderStationView } from './views/OrderStationView';
import { GrillStationView } from './views/GrillStationView';
import { BuildStationView } from './views/BuildStationView';
import { TicketCard } from '../ui/TicketCard';

/**
 * 主场景：持有 GameState，在四个视图（大厅/点单台/烤肉台/组装台）之间切换，
 * 底部导航栏 + 顶部 HUD，负责小票拖拽到托盘的全局判定与日结算。
 */
export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private views: {
    lobby: LobbyView;
    order: OrderStationView;
    grill: GrillStationView;
    build: BuildStationView;
  } | null = null;
  private stations: Record<StationId, Phaser.GameObjects.Container> | null = null;
  private navButtons = new Map<StationId, Button>();
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private dayResults: ServeResult[] = [];
  private serving = false;
  /** 评分弹窗中需随关闭一并销毁的对象 */
  private popupObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Game');
  }

  create(): void {
    // 调试参数：?fast=1 加快顾客生成 · ?n=3 当日顾客数 · ?station=grill 直达工作站
    const params = new URLSearchParams(window.location.search);
    const fast = params.get('fast') === '1';
    const nParam = Number(params.get('n'));
    const debugOpts = {
      ...(fast ? { spawnIntervalMs: 1500, firstDelayMs: 300 } : {}),
      ...(Number.isFinite(nParam) && nParam > 0 ? { customersPerDay: nParam } : {}),
    };

    this.state = new GameState(20260101, 1, 1, debugOpts);
    this.dayResults = [];

    // ── 四个工作站容器（先建容器，背景一律画进各自容器内，避免遮住动态对象）──
    this.stations = {
      lobby: this.add.container(0, 0),
      order: this.add.container(0, 0),
      grill: this.add.container(0, 0),
      build: this.add.container(0, 0),
    };

    // 大厅背景（必须加到 lobby 容器内且位于最底层，否则会盖住顾客）
    this.buildLobbyBackground();
    this.views = {
      lobby: new LobbyView(this, this.state, this.stations.lobby),
      order: new OrderStationView(this, this.state, this.stations.order),
      grill: new GrillStationView(this, this.state, this.stations.grill),
      build: new BuildStationView(this, this.state, this.stations.build),
    };

    this.createNav();
    this.createHud();
    this.bindGlobalEvents();

    this.switchStation('lobby', true);

    // 调试直达：?station=grill 等
    const wantStation = params.get('station');
    if (wantStation && ['lobby', 'order', 'grill', 'build'].includes(wantStation)) {
      this.switchStation(wantStation as StationId);
    }

    // 小票拖到托盘 → 交付
    this.events.on('ticket:dropped', (card: TicketCard) => this.handleTicketDrop(card));

    // 调试钩子：?debug=1 时暴露状态供自动化验证
    if (params.get('debug') === '1') {
      (window as unknown as { __dbg: () => unknown; __game: Phaser.Game }).__dbg = () => ({
        day: this.state.day,
        station: this.state.station,
        customers: this.state.customers.length,
        tickets: this.state.tickets.length,
        grill: this.state.grill.filter(Boolean).length,
      });
      (window as unknown as { __game: Phaser.Game }).__game = this.game;
    }
  }

  update(_time: number, delta: number): void {
    if (this.serving) return; // 结算中暂停模拟（还原原版结算停顿）
    this.state.update(delta);
    this.views?.lobby.update();
    if (this.state.station === 'order') this.views?.order.update();
    if (this.state.station === 'grill') this.views?.grill.update();
    if (this.state.station === 'build') this.views?.build.update();
    this.updateHud();

    if (this.state.dayFinished) {
      this.endDay();
    }
  }

  // ────────────────────── 背景与导航 ──────────────────────

  private buildLobbyBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(C.wall, 1);
    g.fillRect(0, 0, 960, 560);
    g.fillStyle(C.wallShade, 1);
    g.fillRect(0, 400, 960, 40);
    // 地板
    g.fillStyle(C.floor, 1);
    g.fillRect(0, 440, 960, 200);
    g.fillStyle(C.floorDark, 1);
    for (let i = 0; i < 24; i++) {
      g.fillRect((i % 2) * 40 + Math.floor(i / 2) * 80, 440, 80, 4);
    }
    for (let i = 0; i < 6; i++) {
      g.fillRect(0, 460 + i * 34, 960, 3);
    }
    // 店门
    g.fillStyle(0x8fd4e8, 0.55);
    g.fillRect(40, 120, 150, 290);
    g.lineStyle(6, C.wood, 1);
    g.strokeRect(40, 120, 150, 290);
    g.beginPath();
    g.moveTo(115, 120);
    g.lineTo(115, 410);
    g.strokePath();
    // 招牌
    g.fillStyle(C.uiPrimary, 1);
    g.fillRoundedRect(600, 60, 320, 90, 16);
    g.lineStyle(6, C.uiBorder, 1);
    g.strokeRoundedRect(600, 60, 320, 90, 16);
    const sign = this.add
      .text(760, 105, '汉 堡 小 店', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '36px',
        color: '#3b2b1e',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    // 海报装饰
    g.fillStyle(0xffffff, 0.9);
    g.fillRoundedRect(430, 120, 130, 160, 6);
    g.lineStyle(4, C.wood, 1);
    g.strokeRoundedRect(430, 120, 130, 160, 6);
    const poster = this.add
      .text(495, 200, '今日\n特惠', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#8c5a3c',
        align: 'center',
      })
      .setOrigin(0.5);
    // 排队线
    g.lineStyle(4, 0xffffff, 0.35);
    g.beginPath();
    g.moveTo(120, 470);
    g.lineTo(840, 470);
    g.strokePath();

    // 全部加入 lobby 容器，且背景在最底层（顾客随后 add，自然叠在上方）
    this.stations?.lobby.add([g, sign, poster]);
  }

  private createNav(): void {
    const navY = 672;
    const bg = this.add.graphics();
    bg.fillStyle(C.uiPanel, 1);
    bg.fillRect(0, 636, 960, 84);
    bg.fillStyle(0x000000, 0.25);
    bg.fillRect(0, 636, 960, 6);
    bg.setDepth(1000);

    const items: { id: StationId; label: string; color: number }[] = [
      { id: 'lobby', label: '大厅', color: 0x9b7bd4 },
      { id: 'order', label: '点单台', color: C.uiPrimary },
      { id: 'grill', label: '烤肉台', color: 0xd9803d },
      { id: 'build', label: '组装台', color: C.uiGreen },
    ];
    items.forEach((it, i) => {
      const btn = new Button(this, 130 + i * 232, navY, it.label, () => this.switchStation(it.id), {
        width: 200,
        height: 58,
        color: it.color,
        colorDark: Phaser.Display.Color.IntegerToColor(it.color).darken(28).color,
        fontSize: 22,
      });
      btn.setDepth(1001);
      this.navButtons.set(it.id, btn);
    });
  }

  private createHud(): void {
    this.hud = this.add.graphics().setDepth(1002);
    this.hudText = this.add
      .text(0, 0, '', {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '19px',
        color: hex(C.uiTextLight),
        fontStyle: 'bold',
      })
      .setDepth(1003);
  }

  private updateHud(): void {
    const g = this.hud;
    g.clear();
    drawPanel(g, 12, 8, 936, 52, C.uiPanel, 12);

    const served = this.dayResults.length;
    const total = this.state.customersToday;
    const waiting = this.state.waitingCustomers.length;
    const onWire = this.state.pendingTickets.length;

    this.hudText.setText(
      `第 ${this.state.day} 天   Rank ${this.state.rank}   $ ${this.state.money.toFixed(1)}   顾客 ${served}/${total}   等餐 ${waiting}   架上小票 ${onWire}   肉饼 ×${this.state.pattiesLeft}`,
    );
    this.hudText.setPosition(30, 22);

    // 等级进度条
    const need = this.state.rank * 100;
    const prev = (this.state.rank - 1) * 100;
    const ratio = Phaser.Math.Clamp((this.state.points - prev) / (need - prev), 0, 1);
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(700, 30, 230, 14, 7);
    g.fillStyle(C.star, 1);
    g.fillRoundedRect(700, 30, Math.max(6, 230 * ratio), 14, 7);
  }

  private switchStation(id: StationId, force = false): void {
    if (!force && !this.state.switchStation(id)) return;
    if (force) this.state.station = id;

    if (this.stations) {
      for (const key of Object.keys(this.stations) as StationId[]) {
        this.stations[key].setVisible(key === id);
      }
    }
    for (const [key, btn] of this.navButtons) {
      btn.setEnabled(key !== id);
    }

    // 切站时重绘一次目标视图
    if (id === 'order') this.views?.order.update();
    if (id === 'grill') this.views?.grill.update();
    if (id === 'build') this.views?.build.update();
  }

  // ────────────────────── 事件 ──────────────────────

  private bindGlobalEvents(): void {
    this.state.events.on('toast', ({ text, color }) => toast(this, 480, 470, text, color));
    this.state.events.on('patty:burnt', () => toast(this, 480, 400, '有肉饼烤焦了！', '#ff9a8a'));
    this.state.events.on('patty:cooked', () => undefined);
    this.state.events.on('customer:served', ({ result }) => {
      this.dayResults.push(result);
      this.showScorePopup(result);
    });
    this.state.events.on('customer:left', () => this.views?.order.refresh());
  }

  /** 小票拖到托盘 → 交付结算 */
  private handleTicketDrop(card: TicketCard): void {
    const tray = this.views?.build.trayDropRect ?? null;
    const inTray =
      tray !== null &&
      card.x >= tray.x - 40 &&
      card.x <= tray.x + tray.w + 40 &&
      card.y >= tray.y - 40 &&
      card.y <= tray.y + tray.h + 40;

    if (!inTray) {
      this.views?.order.refresh();
      return;
    }

    if (!this.state.trayBurger) {
      toast(this, 480, 420, '托盘上还没有汉堡', '#e05a5a');
      this.views?.order.refresh();
      return;
    }

    this.state.holdTicket(card.ticket.id);
    const result = this.state.serve();
    this.views?.order.refresh();
    if (!result) return;
    card.destroy();
  }

  /** 上菜评分弹窗 */
  private showScorePopup(result: ServeResult): void {
    this.serving = true;
    const depth = 6000;
    const overlay = this.add.rectangle(0, 0, 960, 720, 0x000000, 0.45).setOrigin(0).setDepth(depth).setInteractive();
    const g = this.add.graphics().setDepth(depth + 1);
    const w = 460;
    const h = 340;
    const x = (960 - w) / 2;
    const y = 180;
    drawPanel(g, x, y, w, h, C.uiPanelLight, 18);

    const title = this.add
      .text(480, y + 40, `总分 ${result.scores.total}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '42px',
        color: result.scores.total >= 90 ? '#3d8b3d' : result.scores.total >= 70 ? '#c4831f' : '#c0392b',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    const rows: [string, number, number][] = [
      ['等待', result.scores.waiting, C.uiBlue],
      ['烤肉', result.scores.grill, 0xd9803d],
      ['组装', result.scores.build, C.uiGreen],
    ];
    rows.forEach(([label, val, color], i) => {
      const ry = y + 96 + i * 40;
      const tg = this.add.graphics().setDepth(depth + 2);
      tg.fillStyle(0x000000, 0.12);
      tg.fillRoundedRect(x + 46, ry, 300, 20, 10);
      tg.fillStyle(color, 1);
      tg.fillRoundedRect(x + 46, ry, Math.max(8, 300 * (val / 100)), 20, 10);
      const labelT = this.add
        .text(x + 36, ry + 10, label, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '17px',
          color: '#4a2f18',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5)
        .setDepth(depth + 2);
      const valT = this.add
        .text(x + 360, ry + 10, `${val}`, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '17px',
          color: '#4a2f18',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
        .setDepth(depth + 2);
      this.popupObjects.push(tg, labelT, valT);
    });

    // 星星
    const starCount = result.scores.total >= 95 ? 3 : result.scores.total >= 80 ? 2 : result.scores.total >= 60 ? 1 : 0;
    const sg = this.add.graphics().setDepth(depth + 2);
    for (let i = 0; i < 3; i++) {
      drawStar(sg, 480 + (i - 1) * 60, y + 236, 24, C.star, i < starCount);
    }

    const tip = this.add
      .text(480, y + 292, `小费 $${result.tip.toFixed(1)}   ·   顾客积分 +${result.points}`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#4a2f18',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    const close = () => {
      [overlay, g, title, tip, sg].forEach((o) => o.destroy());
      this.popupObjects.forEach((o) => o.destroy());
      this.popupObjects = [];
      this.serving = false;
    };    overlay.on('pointerdown', close);
    this.time.delayedCall(2200, () => {
      if (this.serving) close();
    });
  }

  /** 日结算 */
  private endDay(): void {
    if (this.serving && this.dayResults.length > 0) return;
    this.serving = true;
    const summary = this.state.daySummary(this.dayResults);
    const depth = 7000;
    this.add.rectangle(0, 0, 960, 720, 0x000000, 0.65).setOrigin(0).setDepth(depth).setInteractive();
    const g = this.add.graphics().setDepth(depth + 1);
    drawPanel(g, 230, 170, 500, 380, C.uiPanelLight, 20);

    this.add
      .text(480, 222, `第 ${this.state.day} 天 · 结算`, {
        fontFamily: '"Microsoft YaHei", sans-serif',
        fontSize: '34px',
        color: '#4a2f18',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    const lines = [
      `接待顾客：${summary.customers} 位`,
      `平均得分：${summary.avgScore} 分`,
      `本日小费：$${summary.totalTip.toFixed(1)}`,
      `完美订单：${summary.goldens} 单`,
      `当前 Rank：${this.state.rank}（积分 ${this.state.points}）`,
      `资金：$${this.state.money.toFixed(1)}`,
    ];
    lines.forEach((line, i) => {
      this.add
        .text(480, 282 + i * 36, line, {
          fontFamily: '"Microsoft YaHei", sans-serif',
          fontSize: '21px',
          color: '#4a2f18',
        })
        .setOrigin(0.5)
        .setDepth(depth + 2);
    });

    const nextBtn = new Button(this, 480, 500, '开始第 2 天', () => {
      this.scene.restart();
    }, { width: 240, height: 60 });
    nextBtn.setDepth(depth + 2);
  }
}
