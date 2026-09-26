import type { SauceId, ToppingId } from '../types';

/**
 * 配料与酱料表
 * ⚠️ 解锁等级为草稿值 —— 待按 PLAN.md §2.3 对照 wiki 核对后固化
 */
export interface ToppingDef {
  id: ToppingId;
  name: string;
  /** 解锁等级（1 = 开局可用） */
  unlockRank: number;
  color: number;
  colorDark: number;
  /** 每层高度（像素，用于堆叠布局） */
  height: number;
}

export interface SauceDef {
  id: SauceId;
  name: string;
  unlockRank: number;
  color: number;
}

export const TOPPINGS: Record<ToppingId, ToppingDef> = {
  lettuce: { id: 'lettuce', name: '生菜', unlockRank: 1, color: 0x6cbf3e, colorDark: 0x4f9a2a, height: 16 },
  tomato: { id: 'tomato', name: '番茄', unlockRank: 1, color: 0xe74c3c, colorDark: 0xb93b2e, height: 18 },
  onion: { id: 'onion', name: '洋葱', unlockRank: 2, color: 0xf2e6f7, colorDark: 0xd6c2e0, height: 14 },
  pickle: { id: 'pickle', name: '酸黄瓜', unlockRank: 2, color: 0x8fbf3f, colorDark: 0x6c9427, height: 13 },
};

export const SAUCES: Record<SauceId, SauceDef> = {
  ketchup: { id: 'ketchup', name: '番茄酱', unlockRank: 1, color: 0xd7352b },
  mustard: { id: 'mustard', name: '黄芥末', unlockRank: 1, color: 0xe8c520 },
  mayo: { id: 'mayo', name: '蛋黄酱', unlockRank: 3, color: 0xf6f0dc },
};

export const TOPPING_ORDER: ToppingId[] = ['lettuce', 'tomato', 'onion', 'pickle'];
export const SAUCE_ORDER: SauceId[] = ['ketchup', 'mustard', 'mayo'];

/** 按等级取已解锁配料 */
export function unlockedToppings(rank: number): ToppingId[] {
  return TOPPING_ORDER.filter((id) => TOPPINGS[id].unlockRank <= rank);
}

export function unlockedSauces(rank: number): SauceId[] {
  return SAUCE_ORDER.filter((id) => SAUCES[id].unlockRank <= rank);
}
