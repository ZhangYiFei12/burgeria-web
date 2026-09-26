/**
 * 可复现随机数（mulberry32）——保证同一种子下订单/顾客序列一致，便于测试与调试
 */
export class RNG {
  private state: number;

  constructor(seed = 20260101) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 浮点 */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** [min, max] 整数 */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** 从数组随机取一项 */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick() 空数组');
    return arr[this.int(0, arr.length - 1)];
  }

  /** 加权随机（权重与 items 等长） */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /** 是否命中概率 p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** 洗牌（返回新数组） */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

let uidCounter = 0;
/** 全局唯一 id 生成 */
export function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter.toString(36)}`;
}

/** 生成一个随机 seed（用于每局随机但可记录） */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
