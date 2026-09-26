import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { createPatty, cookedLevel, advancePatty, targetLevel } from '../src/systems/GrillSim';
import { combineServe, scoreBuild, scoreWaiting, scoreGrill } from '../src/systems/ScoreSystem';
import type { StackItem, TicketItem } from '../src/types';

const patty = (target: 'rare' | 'medium' | 'well', bottom: number, top: number, heat = 1) => {
  const p = createPatty(target);
  p.bottom = bottom;
  p.top = top;
  p.flipped = true;
  p.heat = heat;
  return p;
};

describe('GrillSim · 火候模拟', () => {
  it('未翻面时只有底面受热', () => {
    const p = createPatty('medium');
    advancePatty(p, 5, true);
    expect(p.bottom).toBeGreaterThan(0);
    expect(p.top).toBe(0);
  });

  it('翻面后顶面全速、底面残余速率继续熟', () => {
    const p = createPatty('medium');
    advancePatty(p, 5, true);
    const bottomAfterFirst = p.bottom;
    p.flipped = true;
    advancePatty(p, 5, true);
    expect(p.top).toBeGreaterThan(0);
    expect(p.bottom).toBeGreaterThan(bottomAfterFirst);
    expect(p.top).toBeGreaterThan(p.bottom - bottomAfterFirst); // 顶面快于底面残余
  });

  it('离开烤架后不再受热，只变凉', () => {
    const p = createPatty('well');
    p.bottom = 0.4;
    advancePatty(p, 10, false);
    expect(p.bottom).toBe(0.4);
    expect(p.heat).toBeLessThan(1);
  });

  it('单面熟度 0→1 耗时符合 sideSeconds 配置', () => {
    const p = createPatty('medium');
    advancePatty(p, BALANCE.grill.sideSeconds, true);
    expect(cookedLevel(p)).toBeCloseTo(0.5, 3); // 只烤了一面
  });
});

describe('ScoreSystem · 烤肉评分', () => {
  it('完美火候 + 两面均匀 → 满分', () => {
    const t = targetLevel('medium');
    const s = scoreGrill([patty('medium', t, t)]);
    expect(s.score).toBe(100);
  });

  it('生熟偏差越大分数越低', () => {
    const t = targetLevel('medium');
    const good = scoreGrill([patty('medium', t, t)]).score;
    const bad = scoreGrill([patty('medium', t - 0.3, t - 0.3)]).score;
    expect(bad).toBeLessThan(good);
  });

  it('两面不均扣分', () => {
    const t = targetLevel('medium');
    const even = scoreGrill([patty('medium', t, t)]).score;
    const uneven = scoreGrill([patty('medium', t, t * 0.5)]).score;
    expect(uneven).toBeLessThan(even);
  });

  it('烤焦重罚', () => {
    const s = scoreGrill([patty('well', BALANCE.grill.burntAt, BALANCE.grill.burntAt)]);
    expect(s.score).toBeLessThan(60);
    expect(s.detail.burn).toBe(1);
  });
});

describe('ScoreSystem · 组装评分', () => {
  const expected: TicketItem[] = [
    { kind: 'patty' },
    { kind: 'topping', topping: 'lettuce' },
    { kind: 'sauce', sauce: 'ketchup' },
  ];
  const mkStack = (keys: Array<[StackItem['kind'], string | undefined]>): StackItem[] =>
    keys.map(([kind, v], i) => ({
      uid: `s${i}`,
      kind,
      ...(kind === 'topping' ? { topping: v as never } : {}),
      ...(kind === 'sauce' ? { sauce: v as never, blobs: Array.from({ length: 8 }, (_, k) => ({ x: -0.6 + k * 0.17, y: 0.5, r: 0.2 })) } : {}),
      offset: 0,
    }));

  it('完全正确 → 接近满分', () => {
    const stack = mkStack([['patty', undefined], ['topping', 'lettuce'], ['sauce', 'ketchup']]);
    const r = scoreBuild(expected, stack);
    expect(r.score).toBeGreaterThanOrEqual(95);
  });

  it('漏一项扣分', () => {
    const stack = mkStack([['patty', undefined], ['sauce', 'ketchup']]);
    const r = scoreBuild(expected, stack);
    expect(r.detail.missing).toBe(1);
    expect(r.score).toBeLessThan(95);
  });

  it('顺序错位扣分', () => {
    const stack = mkStack([['topping', 'lettuce'], ['patty', undefined], ['sauce', 'ketchup']]);
    const r = scoreBuild(expected, stack);
    expect(r.detail.wrongOrder).toBeGreaterThan(0);
  });

  it('摆放偏移超容差扣分', () => {
    const ok = scoreBuild(expected, mkStack([['patty', undefined], ['topping', 'lettuce'], ['sauce', 'ketchup']]));
    const shifted = mkStack([['patty', undefined], ['topping', 'lettuce'], ['sauce', 'ketchup']]).map((s) => ({ ...s, offset: 60 }));
    const bad = scoreBuild(expected, shifted);
    expect(bad.score).toBeLessThan(ok.score);
  });

  it('酱料覆盖不足扣分', () => {
    const thin = mkStack([['patty', undefined], ['topping', 'lettuce'], ['sauce', 'ketchup']]).map((s) =>
      s.kind === 'sauce' ? { ...s, blobs: [{ x: 0, y: 0.5, r: 0.2 }] } : s,
    );
    const r = scoreBuild(expected, thin);
    expect(r.score).toBeLessThan(95);
  });
});

describe('ScoreSystem · 等待评分', () => {
  it('耐心充足 → 满分', () => {
    expect(scoreWaiting(100, 100)).toBe(100);
  });
  it('耐心耗尽 → 0 分', () => {
    expect(scoreWaiting(0, 100)).toBe(0);
  });
  it('单调递减', () => {
    const a = scoreWaiting(80, 100);
    const b = scoreWaiting(50, 100);
    const c = scoreWaiting(20, 100);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});

describe('ScoreSystem · 综合结算', () => {
  it('挂错小票 → 组装 0 分', () => {
    const t = targetLevel('medium');
    const r = combineServe({
      customerUid: 'c1',
      patienceLeft: 100,
      patienceMax: 100,
      patties: [patty('medium', t, t)],
      doneness: 'medium' as const,
      expected: [{ kind: 'patty' }, { kind: 'topping', topping: 'lettuce' }],
      stack: [],
      ticketMatched: false,
    });
    expect(r.scores.build).toBe(0);
    expect(r.scores.total).toBeLessThan(70);
  });

  it('总分 = 三项平均，且小费随分数平方增长', () => {
    const t = targetLevel('medium');
    const base = {
      customerUid: 'c1',
      patienceMax: 100,
      patties: [patty('medium', t, t)],
      doneness: 'medium' as const,
      expected: [{ kind: 'patty' }] as TicketItem[],
      stack: [{ uid: 'a', kind: 'patty', offset: 0 }] as StackItem[],
      ticketMatched: true,
    };
    const hi = combineServe({ ...base, patienceLeft: 100 });
    const lo = combineServe({ ...base, patienceLeft: 40 });
    expect(hi.scores.total).toBeGreaterThan(lo.scores.total);
    expect(hi.tip).toBeGreaterThan(lo.tip);
  });
});
