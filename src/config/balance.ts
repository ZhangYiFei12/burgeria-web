/**
 * 全局数值配置（PLAN.md §4.4 / §8「手感调参周」集中收口处）
 * 所有平衡参数只在这里改，系统层不得出现魔法数字。
 */
export const BALANCE = {
  design: { width: 960, height: 720 },

  /** 每日客流 */
  day: {
    baseCustomers: 5,
    growthPerDay: 0.5,
    maxCustomers: 12,
    firstSpawnDelayMs: 1200,
    spawnIntervalMs: 9000,
  },

  /** 点单台 */
  order: {
    /** 接单动作耗时（此期间锁定工作站切换） */
    takeTimeMs: 5000,
    /** 小票架容量 */
    ticketMax: 9,
  },

  /** 顾客耐心 */
  patience: {
    /** 基础耐心时长区间（毫秒） */
    baseMs: [110000, 150000] as [number, number],
    /** 耐心耗尽后顾客流失的宽限（毫秒，0 = 立即离开） */
    graceMs: 0,
    /** 剩余比例 ≥ 此值 → 等待分满分 */
    fullAtRemaining: 0.72,
    /** 等待分随剩余比例线性衰减的下限比例 */
    zeroAtRemaining: 0.12,
  },

  /** 烤肉台 */
  grill: {
    /** 单面熟度 0→1 所需秒数 */
    sideSeconds: 20,
    /** 各火候目标的每面熟度值 */
    target: { rare: 0.5, medium: 0.7, well: 0.9 } as Record<'rare' | 'medium' | 'well', number>,
    /** 超过此熟度开始焦化 */
    burnStart: 1.05,
    /** 达到此熟度判定为焦 */
    burntAt: 1.3,
    /** 保温值每秒衰减（1 → 0 约 50 秒） */
    heatDecayPerSec: 0.02,
    /** 保温低于此值判定为凉 */
    coldThreshold: 0.4,
    /** 烤架格数 */
    slots: 12,
    /**
     * 翻面后已熟一面继续受热的速率。
     * 原版攻略：「烤到指定时间的一半就翻面，这样两面颜色才会一样深」
     * → 原版模型下旧面基本停止变熟，故取 0（保留参数供手感调优）
     */
    residualCookRate: 0,
    /** 未接单的顾客在队列中的耐心衰减速率（相对值） */
    queuedPatienceRate: 0.6,
    /** 保温托盘格数 */
    traySlots: 6,
    /** 每盒肉饼数量（每日补货） */
    boxPatties: 30,
  },

  /** 评分权重 */
  score: {
    grill: {
      /** 每 1.0 熟度误差扣分 */
      errorWeight: 330,
      /** 两面不均每 1.0 差值扣分 */
      evenWeight: 170,
      /** 焦化额外扣分 */
      burnPenalty: 55,
      /** 变凉扣分 */
      coldPenalty: 35,
    },
    build: {
      /** 每漏一项扣分 */
      missingItemPenalty: 18,
      /** 每多一项扣分 */
      extraItemPenalty: 14,
      /** 顺序错位每项扣分 */
      wrongOrderPenalty: 10,
      /** 位置偏移容差（像素） */
      offsetTolerancePx: 16,
      /** 超出容差后每像素扣分 */
      offsetWeightPerPx: 1.4,
      /** 酱料覆盖率满分要求 */
      sauceFullCoverage: 0.55,
      /** 酱料权重 */
      sauceWeight: 26,
      /** 漏放小票或挂错小票 → 直接 0 分 */
      wrongTicket: 0,
    },
    waiting: {
      /** 顾客满意度对评分的权重（三项等权，此处仅注释说明） */
      weight: 1 / 3,
    },
  },

  /** 报酬 */
  pay: {
    /** 满分基础小费 */
    baseTip: 4,
    /** 每分转化的顾客积分 */
    pointsPerScore: 0.1,
    /** 起步资金 */
    startMoney: 20,
  },
} as const;

/** 单面熟度 → 颜色插值用的火候区间（美术侧引用） */
export const COOK_RAMP = {
  raw: 0xd98a86,
  light: 0xb06a4a,
  done: 0x7a4526,
  dark: 0x4a2a17,
  burnt: 0x241108,
};
