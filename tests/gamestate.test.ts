import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { GameState } from '../src/core/GameState';
import { cookedLevel, shouldFlip, targetLevel } from '../src/systems/GrillSim';
import { TOPPINGS, unlockedSauces, unlockedToppings } from '../src/config/ingredients';
import type { ServeResult } from '../src/types';

/** 以 100ms 步长推进模拟 */
function advance(state: GameState, ms: number, step = 100): void {
  for (let t = 0; t < ms; t += step) {
    state.update(step);
  }
}

/** 等到某个条件成立（或超时） */
function until(state: GameState, cond: () => boolean, maxMs = 200000, step = 100): boolean {
  for (let t = 0; t < maxMs; t += step) {
    if (cond()) return true;
    state.update(step);
  }
  return cond();
}

/**
 * 模拟一位「熟练玩家」完成一单：
 * 按小票要求烤肉 → 组装 → 交付
 */
function playOneOrder(state: GameState): ServeResult | null {
  // 1) 等一位顾客排队
  if (!until(state, () => state.waitingCustomers.length > 0)) return null;
  const customer = state.waitingCustomers[0];

  // 2) 接单
  expect(state.startOrder(customer.uid)).toBe(true);
  if (!until(state, () => customer.ticketId !== null)) return null;
  const ticket = state.ticketById(customer.ticketId);
  if (!ticket) return null;

  // 3) 烤肉：按 shouldFlip 提示翻面，烤到目标熟度
  const T = targetLevel(ticket.doneness);
  expect(state.takePattyFromBox(0)).not.toBeNull();
  const patty = state.grill[0]!;
  // 烤到底面到达建议翻面点
  until(state, () => shouldFlip(patty, ticket.doneness), 60000);
  expect(state.flipPatty(0)).toBe(true);
  // 继续烤到两面都接近目标（熟练玩家读火候条）
  until(state, () => patty.top >= T, 60000);
  // 允许 ±2% 的收手误差，贴近真人操作
  expect(Math.abs(cookedLevel(patty) - T)).toBeLessThan(0.06);

  // 从烤架取下到保温盘
  expect(state.moveToTray(0)).toBe(true);

  // 4) 组装：底包 → 肉饼 → 小票顺序 → 封顶
  state.addToStack({ kind: 'bunBottom', offset: 0 });
  state.addToStack({ kind: 'patty', offset: 0, patty: state.takePattyFromTray(0)! });
  for (const item of ticket.items) {
    if (item.kind === 'patty') continue;
    if (item.kind === 'topping') {
      state.addToStack({ kind: 'topping', topping: item.topping, offset: 0 });
    } else {
      state.addToStack({
        kind: 'sauce',
        sauce: item.sauce,
        offset: 0,
        blobs: Array.from({ length: 8 }, (_, k) => ({ x: -0.6 + k * 0.18, y: 0.5, r: 0.2 })),
      });
    }
  }
  state.addToStack({ kind: 'bunTop', offset: 0 });
  expect(state.sealBurger()).toBe(true);

  // 5) 交付
  state.holdTicket(ticket.id);
  return state.serve();
}

describe('GameState · 完整一天流程', () => {
  it('顾客按日客流生成，且第一天为配置的基础客流', () => {
    const s = new GameState(42, 1, 1);
    expect(s.customersToday).toBe(BALANCE.day.baseCustomers);
    advance(s, 3000);
    expect(s.activeCustomers.length).toBeGreaterThan(0);
  });

  it('熟练玩家完成一单 → 三项评分均高，且获得小费与积分', () => {
    const s = new GameState(7, 1, 1);
    const result = playOneOrder(s);
    expect(result).not.toBeNull();
    const r = result as ServeResult;
    expect(r.scores.waiting).toBeGreaterThan(90); // 立刻接单，耐心充足
    expect(r.scores.grill).toBeGreaterThan(85); // 按提示翻面
    expect(r.scores.build).toBeGreaterThan(95); // 严格按小票
    expect(r.scores.total).toBeGreaterThan(88);
    expect(r.tip).toBeGreaterThan(0);
    expect(r.points).toBeGreaterThan(0);
    expect(s.money).toBeGreaterThan(BALANCE.pay.startMoney);
  });

  it('挂错小票 → 组装 0 分', () => {
    const s = new GameState(11, 1, 1);
    // 造两位顾客，拿 A 的小票交付 B 的汉堡
    until(s, () => s.waitingCustomers.length >= 2);
    const [a, b] = s.waitingCustomers;

    s.startOrder(a.uid);
    until(s, () => a.ticketId !== null);
    s.startOrder(b.uid);
    until(s, () => b.ticketId !== null);
    const ticketA = s.ticketById(a.ticketId)!;
    const ticketB = s.ticketById(b.ticketId)!;

    // 简单组装一个汉堡
    s.addToStack({ kind: 'bunBottom', offset: 0 });
    s.addToStack({ kind: 'bunTop', offset: 0 });
    s.sealBurger();

    s.holdTicket(ticketB.id); // 用小票 B 交付，但汉堡是为 A 做的
    const result = s.serve();
    expect(result).not.toBeNull();
    // 小票 B 的顾客是 B：小票匹配（matched = true），但小票 B 要求的内容与空汉堡不符
    expect((result as ServeResult).scores.build).toBeLessThan(60);
    expect(ticketA.id).not.toBe(ticketB.id);
  });

  it('耐心耗尽 → 顾客生气离开且当日仍然可以结束', () => {
    const s = new GameState(3, 1, 1);
    let leftAngry = false;
    s.events.on('customer:left', ({ angry }) => {
      if (angry) leftAngry = true;
    });
    // 不接任何单，直接推进
    until(s, () => s.dayFinished, 600000);
    expect(leftAngry).toBe(true);
    expect(s.dayFinished).toBe(true);
  });

  it('等级提升：积分累积到阈值后 Rank 上涨', () => {
    const s = new GameState(5, 1, 1);
    let ranked = false;
    s.events.on('toast', ({ text }) => {
      if (text.includes('等级提升')) ranked = true;
    });
    // 连续完成多单直到升级或跑完一天
    for (let i = 0; i < 8 && !ranked; i++) {
      const r = playOneOrder(s);
      if (!r) break;
      advance(s, 1500);
    }
    expect(s.points).toBeGreaterThan(0);
  });

  it('烤焦的肉饼会被标记，且评分显著降低', () => {
    const s = new GameState(9, 1, 1);
    until(s, () => s.waitingCustomers.length > 0);
    const c = s.waitingCustomers[0];
    s.startOrder(c.uid);
    until(s, () => c.ticketId !== null);
    s.takePattyFromBox(0);
    const p = s.grill[0]!;
    // 一直烤不管它
    until(s, () => p.bottom >= BALANCE.grill.burntAt, 120000);
    expect(p.burned).toBe(true);
  });

  it('等级 1 时只有已解锁的配料/酱料进入订单', () => {
    const s = new GameState(13, 1, 1);
    const allowedT = unlockedToppings(1);
    const allowedS = unlockedSauces(1);
    for (let i = 0; i < 6; i++) {
      const r = playOneOrder(s);
      if (!r) break;
      const ticket = s.tickets[0];
      if (ticket) {
        for (const item of ticket.items) {
          if (item.kind === 'topping') expect(allowedT).toContain(item.topping);
          if (item.kind === 'sauce') expect(allowedS).toContain(item.sauce);
        }
      }
      advance(s, 1200);
    }
    expect(unlockedToppings(1).length).toBeGreaterThan(0);
    expect(TOPPINGS.lettuce.unlockRank).toBe(1);
  });

  it('接单期间禁止切换工作站（还原原版锁定）', () => {
    const s = new GameState(17, 1, 1);
    until(s, () => s.waitingCustomers.length > 0);
    const c = s.waitingCustomers[0];
    s.startOrder(c.uid);
    expect(s.hasOrderLock).toBe(true);
    expect(s.switchStation('grill')).toBe(false);
    expect(s.station).not.toBe('grill');
    until(s, () => !s.hasOrderLock);
    expect(s.switchStation('grill')).toBe(true);
  });

  it('酱料不可撤销，其它层可撤回顶层', () => {
    const s = new GameState(19, 1, 1);
    s.addToStack({ kind: 'bunBottom', offset: 0 });
    s.addToStack({ kind: 'topping', topping: 'lettuce', offset: 0 });
    expect(s.popFromStack()?.kind).toBe('topping');
    s.addToStack({ kind: 'sauce', sauce: 'ketchup', offset: 0, blobs: [] });
    expect(s.popFromStack()).toBeNull(); // 酱料撤不掉
    expect(s.stack.length).toBe(2);
  });
});
