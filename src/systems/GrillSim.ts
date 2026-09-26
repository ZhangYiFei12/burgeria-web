import { BALANCE } from '../config/balance';
import type { Doneness, Patty } from '../types';
import { uid } from '../core/RNG';

/** 每秒单面熟度增量 */
export const COOK_RATE = 1 / BALANCE.grill.sideSeconds;

/** 新建一块生肉饼 */
export function createPatty(target: Doneness): Patty {
  return {
    id: uid('patty'),
    target,
    bottom: 0,
    top: 0,
    flipped: false,
    heat: 1,
    offGrill: false,
  };
}

/**
 * 推进一块肉饼的模拟（纯函数式修改，dt 单位秒）
 * - 未翻面：只有底面受热
 * - 已翻面：顶面全速受热，底面以 residualCookRate 残余速率继续熟（还原原版「翻面后另一面仍在烤」）
 * - 离开烤架后：heat 按 heatDecayPerSec 衰减
 */
export function advancePatty(p: Patty, dt: number, onGrill: boolean): void {
  if (onGrill && !p.offGrill) {
    if (!p.flipped) {
      p.bottom += COOK_RATE * dt;
    } else {
      p.top += COOK_RATE * dt;
      p.bottom += COOK_RATE * BALANCE.grill.residualCookRate * dt;
    }
  } else {
    p.heat = Math.max(0, p.heat - BALANCE.grill.heatDecayPerSec * dt);
  }
}

/** 当前熟度（判定用：两面中较生的一面决定整体成败感）——取两面均值更直观 */
export function cookedLevel(p: Patty): number {
  return (p.bottom + p.top) / 2;
}

/** 目标熟度值 */
export function targetLevel(target: Doneness): number {
  return BALANCE.grill.target[target];
}

/** 是否已焦 */
export function isBurnt(p: Patty): boolean {
  return p.bottom >= BALANCE.grill.burntAt || p.top >= BALANCE.grill.burntAt;
}

/** 是否变凉 */
export function isCold(p: Patty): boolean {
  return p.heat < BALANCE.grill.coldThreshold;
}

/** 肉饼是否可被接受（未焦） */
export function isUsable(p: Patty): boolean {
  return !isBurnt(p);
}

/**
 * 建议翻面时机：底面接近目标一半时提示
 */
export function shouldFlip(p: Patty): boolean {
  return !p.flipped && p.bottom >= targetLevel(p.target) * 0.5;
}

/** 肉饼状态文案（UI 用） */
export function pattyStatus(p: Patty): string {
  if (isBurnt(p)) return '烤焦了！';
  if (isCold(p)) return '凉了';
  const level = cookedLevel(p);
  const target = targetLevel(p.target);
  if (level < target * 0.6) return '还生';
  if (level < target * 0.9) return '快好了';
  if (level <= target * 1.12) return '正好';
  return '过火';
}
