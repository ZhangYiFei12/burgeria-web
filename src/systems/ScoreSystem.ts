import { BALANCE } from '../config/balance';
import type {
  Doneness,
  Patty,
  ScoreBreakdown,
  ServeResult,
  StackItem,
  Ticket,
  TicketItem,
} from '../types';
import { cookedLevel, isBurnt, isCold, targetLevel } from './GrillSim';

export interface GrillDetail {
  patties: number;
  avgError: number;
  burn: number;
}

export interface BuildDetail {
  missing: number;
  extra: number;
  wrongOrder: number;
  offsetAvg: number;
  sauceCoverage: number;
}

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/**
 * 烤肉评分：熟度误差 + 两面均匀度 + 焦糊 + 变凉
 */
export function scoreGrill(patties: Patty[], targetOverride?: Doneness): { score: number; detail: GrillDetail } {
  const detail: GrillDetail = { patties: patties.length, avgError: 0, burn: 0 };
  if (patties.length === 0) return { score: 0, detail };

  const cfg = BALANCE.score.grill;
  let total = 0;
  let errorSum = 0;

  for (const p of patties) {
    // 目标火候以小票为准（玩家从盒中取出生肉饼，不预先指定火候）
    const want = targetLevel(targetOverride ?? p.target);
    const error = Math.abs(cookedLevel(p) - want);
    const even = Math.abs(p.bottom - p.top);
    errorSum += error;

    let s = 100;
    s -= error * cfg.errorWeight;
    s -= even * cfg.evenWeight;

    if (isBurnt(p)) {
      s -= cfg.burnPenalty;
      detail.burn += 1;
    }
    if (isCold(p)) s -= cfg.coldPenalty;

    total += clamp(s);
  }

  detail.avgError = errorSum / patties.length;
  return { score: clamp(total / patties.length), detail };
}

/** 把堆叠项/小票项转成可比较的字符串键 */
function itemKey(item: TicketItem | StackItem): string {
  if (item.kind === 'topping') return `topping:${item.topping}`;
  if (item.kind === 'sauce') return `sauce:${item.sauce}`;
  return 'patty';
}

/** 最长公共子序列长度（顺序正确性判定） */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  let prev = new Array<number>(n + 1).fill(0);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
    cur.fill(0);
  }
  return prev[n];
}

/**
 * 组装评分：漏项 / 多项 / 顺序 / 摆放偏移 / 酱料覆盖
 * @param expected 小票要求（不含面包）
 * @param stack    玩家实际堆叠（不含上下包）
 */
export function scoreBuild(
  expected: TicketItem[],
  stack: StackItem[],
): { score: number; detail: BuildDetail } {
  const cfg = BALANCE.score.build;
  const detail: BuildDetail = { missing: 0, extra: 0, wrongOrder: 0, offsetAvg: 0, sauceCoverage: 0 };

  const expKeys = expected.map(itemKey);
  const actKeys = stack.map(itemKey);

  // ---- 1. 多重集差异 → 漏项/多项 ----
  const countKeys = (keys: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const expCount = countKeys(expKeys);
  const actCount = countKeys(actKeys);
  for (const [k, c] of expCount) detail.missing += Math.max(0, c - (actCount.get(k) ?? 0));
  for (const [k, c] of actCount) detail.extra += Math.max(0, c - (expCount.get(k) ?? 0));

  // ---- 2. 顺序：在「公共多重集」范围内做 LCS ----
  const commonLimit = new Map<string, number>();
  for (const [k, c] of expCount) commonLimit.set(k, Math.min(c, actCount.get(k) ?? 0));

  const takeCommon = (keys: string[]): string[] => {
    const remain = new Map(commonLimit);
    const out: string[] = [];
    for (const k of keys) {
      const left = remain.get(k) ?? 0;
      if (left > 0) {
        out.push(k);
        remain.set(k, left - 1);
      }
    }
    return out;
  };
  const expCommon = takeCommon(expKeys);
  const actCommon = takeCommon(actKeys);
  detail.wrongOrder = expCommon.length - lcsLength(expCommon, actCommon);

  // ---- 3. 摆放偏移 ----
  let offsetSum = 0;
  let offsetCount = 0;
  for (const it of stack) {
    offsetSum += Math.abs(it.offset);
    offsetCount += 1;
  }
  detail.offsetAvg = offsetCount > 0 ? offsetSum / offsetCount : 0;
  const offsetOver = Math.max(0, detail.offsetAvg - cfg.offsetTolerancePx);

  // ---- 4. 酱料覆盖 ----
  const sauceItems = stack.filter((s) => s.kind === 'sauce');
  if (sauceItems.length > 0) {
    const covers = sauceItems.map((s) => sauceCoverageOf(s));
    detail.sauceCoverage = covers.reduce((a, b) => a + b, 0) / covers.length;
  } else if (expected.some((e) => e.kind === 'sauce')) {
    detail.sauceCoverage = 0;
  } else {
    detail.sauceCoverage = 1; // 没要求也没挤 → 不扣
  }

  let score = 100;
  score -= detail.missing * cfg.missingItemPenalty;
  score -= detail.extra * cfg.extraItemPenalty;
  score -= detail.wrongOrder * cfg.wrongOrderPenalty;
  score -= offsetOver * cfg.offsetWeightPerPx;
  const expectedSauceCount = expected.filter((e) => e.kind === 'sauce').length;
  if (expectedSauceCount > 0) {
    const shortfall = Math.max(0, 1 - detail.sauceCoverage / cfg.sauceFullCoverage);
    score -= shortfall * cfg.sauceWeight;
  }

  return { score: clamp(score), detail };
}

/** 单个酱料项覆盖率（0..1）：采样点数量 + 水平铺展程度 */
export function sauceCoverageOf(item: StackItem): number {
  const blobs = item.blobs ?? [];
  if (blobs.length === 0) return 0;
  const countFactor = Math.min(1, blobs.length / 7);
  const xs = blobs.map((b) => b.x);
  const spread = Math.max(...xs) - Math.min(...xs); // 归一化 -1..1 空间
  const spreadFactor = Math.min(1, spread / 1.2);
  return Math.max(0, Math.min(1, countFactor * 0.6 + spreadFactor * 0.4));
}

/**
 * 等待评分：按剩余耐心比例
 */
export function scoreWaiting(patienceLeft: number, patienceMax: number): number {
  if (patienceMax <= 0) return 0;
  const cfg = BALANCE.patience;
  const ratio = patienceLeft / patienceMax;
  if (ratio >= cfg.fullAtRemaining) return 100;
  if (ratio <= cfg.zeroAtRemaining) return 0;
  const span = cfg.fullAtRemaining - cfg.zeroAtRemaining;
  return clamp(((ratio - cfg.zeroAtRemaining) / span) * 100);
}

/**
 * 合成一次上菜结算
 * @param ticketMatched 小票是否挂对（挂错 → 组装 0 分，还原原版规则）
 * @param loyaltyMultiplier 忠诚度小费倍率（金卡 1.5，Phase 4 启用）
 */
export function combineServe(params: {
  customerUid: string;
  patienceLeft: number;
  patienceMax: number;
  patties: Patty[];
  doneness: Doneness;
  expected: TicketItem[];
  stack: StackItem[];
  ticketMatched: boolean;
  loyaltyMultiplier?: number;
}): ServeResult {
  const waiting = scoreWaiting(params.patienceLeft, params.patienceMax);
  const grill = scoreGrill(params.patties, params.doneness);
  const build = params.ticketMatched
    ? scoreBuild(params.expected, params.stack)
    : { score: BALANCE.score.build.wrongTicket, detail: { missing: 0, extra: 0, wrongOrder: 0, offsetAvg: 0, sauceCoverage: 0 } };

  const total = clamp((waiting + grill.score + build.score) / 3);
  const loyalty = params.loyaltyMultiplier ?? 1;
  const tip = Math.round(BALANCE.pay.baseTip * (total / 100) ** 2 * loyalty * 10) / 10;
  const points = Math.round(total * BALANCE.pay.pointsPerScore);

  const scores: ScoreBreakdown = {
    waiting: Math.round(waiting),
    grill: Math.round(grill.score),
    build: Math.round(build.score),
    total: Math.round(total),
  };

  return {
    customerUid: params.customerUid,
    scores,
    tip,
    points,
    grillDetail: grill.detail,
    buildDetail: build.detail,
  };
}

/** 从堆叠中取出所有肉饼实体 */
export function pattiesOf(stack: StackItem[]): Patty[] {
  return stack.filter((s) => s.kind === 'patty' && s.patty).map((s) => s.patty as Patty);
}

/** 从堆叠中取出玩家摆放的核心项（排除上下包） */
export function coreItemsOf(stack: StackItem[]): StackItem[] {
  return stack.filter((s) => s.kind !== 'bunBottom' && s.kind !== 'bunTop');
}

/** 小票要求项（排除面包）→ 便于与 coreItemsOf 对比 */
export function expectedItemsOf(ticket: Ticket): TicketItem[] {
  return ticket.items;
}
