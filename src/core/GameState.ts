import { BALANCE } from '../config/balance';
import { CUSTOMERS } from '../config/customers';
import { unlockedSauces, unlockedToppings } from '../config/ingredients';
import { RNG, uid } from '../core/RNG';
import { EventBus } from '../core/EventBus';
import { advancePatty, createPatty } from '../systems/GrillSim';
import { generateTicket, patienceFor, ticketMatchesCustomer } from '../systems/OrderSystem';
import { combineServe, coreItemsOf, pattiesOf } from '../systems/ScoreSystem';
import type {
  Customer,
  CustomerDef,
  Doneness,
  Patty,
  ServeResult,
  StackItem,
  StationId,
  Ticket,
} from '../types';

export interface GameEvents extends Record<string, unknown> {
  'customer:arrived': { customer: Customer };
  'customer:left': { customer: Customer; angry: boolean };
  'customer:served': { customer: Customer; result: ServeResult };
  'ticket:created': { ticket: Ticket };
  'order:started': { customer: Customer; durationMs: number };
  'order:finished': { customer: Customer; ticket: Ticket };
  'patty:cooked': { patty: Patty };
  'patty:burnt': { patty: Patty };
  'patty:taken': { patty: Patty; to: 'tray' | 'build' | 'trash' };
  'day:ended': { day: number };
  'money:changed': { money: number };
  'station:changed': { station: StationId };
  'toast': { text: string; color?: string };
}

/** 烤架格位上的肉饼（null = 空） */
export type GrillSlots = (Patty | null)[];

export class GameState {
  readonly events = new EventBus<GameEvents>();
  readonly rng: RNG;

  day = 1;
  rank = 1;
  money: number = BALANCE.pay.startMoney;
  points = 0;

  station: StationId = 'lobby';
  /** 接单锁定：>0 时禁止切换工作站 */
  orderLockMs = 0;
  orderingCustomerUid: string | null = null;

  customers: Customer[] = [];
  tickets: Ticket[] = [];
  /** 已放弃/离开的顾客在队列中留下的空位 */
  readonly queueSlots = 5;

  grill: GrillSlots = new Array(BALANCE.grill.slots).fill(null);
  tray: Patty[] = [];
  /** 肉饼盒剩余数量 */
  pattiesLeft = BALANCE.grill.boxPatties;

  /** 当前组装台的堆叠（含上下包） */
  stack: StackItem[] = [];
  /** 托盘上已封顶待交付的汉堡（Phase 1 单托盘） */
  trayBurger: { stack: StackItem[] } | null = null;
  /** 小票架上被拖下、等待交付的小票 */
  heldTicketId: string | null = null;

  private spawnTimer = 0;
  private spawnedToday = 0;
  private readonly totalToday: number;

  constructor(seed = 20260101, day = 1, rank = 1) {
    this.rng = new RNG(seed);
    this.day = day;
    this.rank = rank;
    this.totalToday = Math.min(
      BALANCE.day.maxCustomers,
      Math.floor(BALANCE.day.baseCustomers + (day - 1) * BALANCE.day.growthPerDay),
    );
    this.spawnTimer = BALANCE.day.firstSpawnDelayMs / 1000;
  }

  // ────────────────────────── 查询 ──────────────────────────

  get customersToday(): number {
    return this.totalToday;
  }

  get spawnedCustomersToday(): number {
    return this.spawnedToday;
  }

  get activeCustomers(): Customer[] {
    return this.customers.filter((c) => c.phase !== 'done');
  }

  get waitingCustomers(): Customer[] {
    return this.customers.filter((c) => c.phase === 'queued');
  }

  get hasOrderLock(): boolean {
    return this.orderLockMs > 0;
  }

  ticketById(id: string | null): Ticket | null {
    if (!id) return null;
    return this.tickets.find((t) => t.id === id) ?? null;
  }

  customerByUid(uidStr: string): Customer | null {
    return this.customers.find((c) => c.uid === uidStr) ?? null;
  }

  /** 无小票的小票（挂在架上待取） */
  get pendingTickets(): Ticket[] {
    return this.tickets.filter((t) => {
      const owner = this.customers.find((c) => c.ticketId === t.id);
      return owner ? owner.phase === 'waiting' && !owner.result : false;
    });
  }

  /** 是否所有顾客都已服务完毕 → 当日结束 */
  get dayFinished(): boolean {
    return this.spawnedToday >= this.totalToday && this.activeCustomers.length === 0;
  }

  // ────────────────────────── 主循环 ──────────────────────────

  update(dtMs: number): void {
    const dt = dtMs / 1000;

    // 顾客生成
    if (this.spawnedToday < this.totalToday && this.activeCustomers.length < this.queueSlots) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnCustomer();
        this.spawnTimer = BALANCE.day.spawnIntervalMs / 1000;
      }
    }

    // 耐心衰减
    for (const c of this.customers) {
      if (c.phase === 'queued') {
        c.patienceLeft -= dtMs * BALANCE.grill.queuedPatienceRate;
        if (c.patienceLeft <= 0) this.customerLeaves(c);
      } else if (c.phase === 'waiting') {
        c.patienceLeft -= dtMs;
        if (c.patienceLeft <= 0) this.customerLeaves(c);
      }
    }

    // 接单锁
    if (this.orderLockMs > 0) {
      this.orderLockMs = Math.max(0, this.orderLockMs - dtMs);
      if (this.orderLockMs === 0 && this.orderingCustomerUid) {
        this.finishOrder(this.orderingCustomerUid);
      }
    }

    // 烤肉模拟
    let changed = false;
    for (let i = 0; i < this.grill.length; i++) {
      const p = this.grill[i];
      if (!p) continue;
      const before = p.bottom + p.top;
      advancePatty(p, dt, true);
      if (p.bottom + p.top !== before) changed = true;
      if (!p.burned && (p.bottom >= BALANCE.grill.burntAt || p.top >= BALANCE.grill.burntAt)) {
        p.burned = true;
        this.events.emit('patty:burnt', { patty: p });
      }
    }
    for (const p of this.tray) {
      const before = p.heat;
      advancePatty(p, dt, false);
      if (p.heat !== before) changed = true;
    }
    if (changed) {
      // 由场景侧按需重绘（此处不广播，避免每帧事件风暴）
    }
  }

  // ────────────────────────── 顾客 ──────────────────────────

  private spawnCustomer(): void {
    const def = this.pickCustomerDef();
    const patience = patienceFor(def, this.rng);
    const customer: Customer = {
      uid: uid('cust'),
      def,
      phase: 'queued',
      slotIndex: this.waitingCustomers.length,
      patienceLeft: patience,
      patienceMax: patience,
      ticketId: null,
    };
    this.customers.push(customer);
    this.spawnedToday += 1;
    this.events.emit('customer:arrived', { customer });
  }

  /** 按已服务次数轮转选择顾客（保证出场均匀，后续 Phase 4 换偏好权重） */
  private pickCustomerDef(): CustomerDef {
    const idx = (this.spawnedToday + this.day - 1) % CUSTOMERS.length;
    return CUSTOMERS[idx];
  }

  /** 点单：开始接单（锁定工作站） */
  startOrder(customerUid: string): boolean {
    const c = this.customerByUid(customerUid);
    if (!c || c.phase !== 'queued' || this.hasOrderLock || this.tickets.length >= BALANCE.order.ticketMax) {
      return false;
    }
    c.phase = 'ordering';
    this.orderingCustomerUid = c.uid;
    this.orderLockMs = BALANCE.order.takeTimeMs;
    this.events.emit('order:started', { customer: c, durationMs: BALANCE.order.takeTimeMs });
    return true;
  }

  private finishOrder(customerUid: string): void {
    const c = this.customerByUid(customerUid);
    this.orderingCustomerUid = null;
    if (!c || c.phase !== 'ordering') return;

    const ticket = generateTicket(
      this.rng,
      c.def,
      c.uid,
      this.rank,
      { toppings: unlockedToppings(this.rank), sauces: unlockedSauces(this.rank) },
      this.day,
    );
    this.tickets.push(ticket);
    c.ticketId = ticket.id;
    c.phase = 'waiting';
    this.events.emit('ticket:created', { ticket });
    this.events.emit('order:finished', { customer: c, ticket });
  }

  private customerLeaves(c: Customer, served = false): void {
    c.phase = 'done';
    c.slotIndex = -1;
    this.events.emit('customer:left', { customer: c, angry: !served });
    if (!served) {
      this.events.emit('toast', { text: `${c.def.name} 等不及走了…`, color: '#e05a5a' });
    }
  }

  // ────────────────────────── 烤肉台 ──────────────────────────

  /**
   * 当前参考火候：取最早一张待处理小票的要求。
   * 原版肉饼本身不携带火候，玩家对照小票烤制；此值仅供 UI 提示（翻面点/状态文案），
   * 实际评分始终以交付时匹配的小票为准。
   */
  get referenceDoneness(): Doneness {
    const pending = this.pendingTickets;
    return pending.length > 0 ? pending[0].doneness : 'medium';
  }

  /** 从肉饼盒取一块生肉饼放到烤架空位（肉饼不携带火候，火候只在小票上） */
  takePattyFromBox(slot: number): Patty | null {
    if (slot < 0 || slot >= this.grill.length) return null;
    if (this.grill[slot]) return null;
    if (this.pattiesLeft <= 0) {
      this.events.emit('toast', { text: '肉饼用完了！', color: '#e05a5a' });
      return null;
    }
    const p = createPatty();
    this.grill[slot] = p;
    this.pattiesLeft -= 1;
    return p;
  }

  /** 翻面 */
  flipPatty(slot: number): boolean {
    const p = this.grill[slot];
    if (!p || p.flipped) return false;
    p.flipped = true;
    return true;
  }

  /** 把烤架上的肉饼移到保温托盘 */
  moveToTray(slot: number): boolean {
    const p = this.grill[slot];
    if (!p) return false;
    if (this.tray.length >= BALANCE.grill.traySlots) {
      this.events.emit('toast', { text: '保温盘满了', color: '#e05a5a' });
      return false;
    }
    p.offGrill = true;
    this.tray.push(p);
    this.grill[slot] = null;
    this.events.emit('patty:taken', { patty: p, to: 'tray' });
    return true;
  }

  /** 丢弃肉饼 */
  trashPatty(slot: number): boolean {
    const p = this.grill[slot];
    if (!p) return false;
    this.grill[slot] = null;
    this.events.emit('patty:taken', { patty: p, to: 'trash' });
    return true;
  }

  // ────────────────────────── 组装台 ──────────────────────────

  /** 往堆叠上加一项 */
  addToStack(item: Omit<StackItem, 'uid'>): StackItem {
    const full: StackItem = { ...item, uid: uid('stack') };
    this.stack.push(full);
    return full;
  }

  /** 取回堆叠中最上面一项（酱料不可撤销，还原原版规则） */
  popFromStack(): StackItem | null {
    const top = this.stack[this.stack.length - 1];
    if (!top) return null;
    if (top.kind === 'sauce') {
      this.events.emit('toast', { text: '酱料挤上后不能撤销', color: '#e05a5a' });
      return null;
    }
    this.stack.pop();
    return top;
  }

  /** 从保温盘取肉饼放进堆叠 */
  takePattyFromTray(index: number): Patty | null {
    const p = this.tray[index];
    if (!p) return null;
    this.tray.splice(index, 1);
    return p;
  }

  /** 封顶：底包+顶包都在且已放至少一项 → 送往托盘 */
  sealBurger(): boolean {
    const hasBottom = this.stack.some((s) => s.kind === 'bunBottom');
    const hasTop = this.stack.some((s) => s.kind === 'bunTop');
    if (!hasBottom || !hasTop) return false;
    this.trayBurger = { stack: [...this.stack] };
    this.stack = [];
    return true;
  }

  /** 载入一张小票到手上（准备挂到托盘） */
  holdTicket(ticketId: string): void {
    this.heldTicketId = ticketId;
  }

  // ────────────────────────── 交付 ──────────────────────────

  /** 交付当前托盘上的汉堡给小票对应的顾客 */
  serve(): ServeResult | null {
    if (!this.trayBurger) {
      this.events.emit('toast', { text: '托盘上没有汉堡', color: '#e05a5a' });
      return null;
    }
    const ticket = this.ticketById(this.heldTicketId);
    if (!ticket) {
      this.events.emit('toast', { text: '先把小票拖到托盘上', color: '#e05a5a' });
      return null;
    }
    const customer = this.customerByUid(ticket.customerUid);
    if (!customer || customer.phase !== 'waiting') {
      this.events.emit('toast', { text: '这张小票的顾客已经走了', color: '#e05a5a' });
      return null;
    }

    const matched = ticketMatchesCustomer(ticket, customer.ticketId);
    const stackCore = coreItemsOf(this.trayBurger.stack);
    const result = combineServe({
      customerUid: customer.uid,
      patienceLeft: customer.patienceLeft,
      patienceMax: customer.patienceMax,
      patties: pattiesOf(this.trayBurger.stack),
      doneness: ticket.doneness,
      expected: ticket.items,
      stack: stackCore,
      ticketMatched: matched,
    });

    this.money = Math.round((this.money + result.tip) * 10) / 10;
    this.points += result.points;
    customer.result = result;
    customer.phase = 'done';
    customer.slotIndex = -1;

    // 清理
    this.trayBurger = null;
    this.heldTicketId = null;
    this.tickets = this.tickets.filter((t) => t.id !== ticket.id);
    this.checkRankUp();

    this.events.emit('customer:served', { customer, result });
    this.events.emit('money:changed', { money: this.money });
    return result;
  }

  private checkRankUp(): void {
    const need = this.rank * 100;
    if (this.points >= need && this.rank < 10) {
      this.rank += 1;
      this.events.emit('toast', { text: `等级提升！Rank ${this.rank}`, color: '#4a9d4a' });
    }
  }

  // ────────────────────────── 工作站 ──────────────────────────

  switchStation(to: StationId): boolean {
    if (this.hasOrderLock && to !== 'order') {
      this.events.emit('toast', { text: '正在接单，无法离开', color: '#e05a5a' });
      return false;
    }
    this.station = to;
    this.events.emit('station:changed', { station: to });
    return true;
  }

  /** 当日结算摘要 */
  daySummary(served: ServeResult[]): {
    customers: number;
    avgScore: number;
    totalTip: number;
    goldens: number;
  } {
    const customers = served.length;
    const avgScore = customers > 0 ? served.reduce((a, r) => a + r.scores.total, 0) / customers : 0;
    const totalTip = Math.round(served.reduce((a, r) => a + r.tip, 0) * 10) / 10;
    const goldens = served.filter((r) => r.scores.total >= 95).length;
    return { customers, avgScore: Math.round(avgScore), totalTip, goldens };
  }
}
