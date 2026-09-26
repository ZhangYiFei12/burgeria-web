/**
 * 核心数据模型（纯数据，不依赖 Phaser，便于单测）
 */

export type StationId = 'lobby' | 'order' | 'grill' | 'build';

/** 火候目标：三分 / 五分 / 全熟 */
export type Doneness = 'rare' | 'medium' | 'well';

export type ToppingId = 'lettuce' | 'tomato' | 'onion' | 'pickle';
export type SauceId = 'ketchup' | 'mustard' | 'mayo';

/** 组装台上的堆叠物件 */
export type StackKind = 'bunBottom' | 'patty' | 'topping' | 'sauce' | 'bunTop';

export interface SauceBlob {
  /** 相对汉堡中心的水平偏移（-1..1 归一化） */
  x: number;
  /** 垂直位置（层内 0..1） */
  y: number;
  r: number;
}

/** 堆叠中的一项 */
export interface StackItem {
  uid: string;
  kind: StackKind;
  topping?: ToppingId;
  sauce?: SauceId;
  /** 水平偏移像素（0 = 居中，容差外扣分） */
  offset: number;
  /** 酱料涂抹采样点（仅 kind === 'sauce'） */
  blobs?: SauceBlob[];
  /** 肉饼实体（仅 kind === 'patty'） */
  patty?: Patty;
}

/** 小票上要求的一项（自下而上的摆放顺序，不含两片面包） */
export type TicketItem =
  | { kind: 'patty' }
  | { kind: 'topping'; topping: ToppingId }
  | { kind: 'sauce'; sauce: SauceId };

/** 顾客订单 */
export interface Ticket {
  id: string;
  /** 顾客运行时实例 id（用于回查顾客） */
  customerUid: string;
  /** 顾客定义 id（形象/偏好表） */
  customerDefId: string;
  /** 肉饼目标火候 */
  doneness: Doneness;
  /** 自下而上的要求顺序 */
  items: TicketItem[];
  createdAt: number;
  day: number;
}

/** 烤架上的肉饼实体 */
export interface Patty {
  id: string;
  /** 底面熟度 0..1+ */
  bottom: number;
  /** 顶面熟度 0..1+ */
  top: number;
  flipped: boolean;
  /** 保温值 1（刚出锅）→ 0（凉透） */
  heat: number;
  /** 是否已从烤架取下 */
  offGrill: boolean;
  /** 是否已触发过焦糊事件（用于一次性提示） */
  burned?: boolean;
}

/** 顾客订单偏好与形象参数 */
export interface CustomerDef {
  id: string;
  name: string;
  /** 形象参数（程序化绘制用） */
  look: {
    skin: number;
    hair: number;
    hairStyle: 0 | 1 | 2 | 3;
    shirt: number;
    /** 是否戴帽 */
    hat: boolean;
  };
  /** 耐心时长倍率（1 = 标准） */
  patienceFactor: number;
  /** 偏好配料池（订单优先从这里抽） */
  favorites: ToppingId[];
  /** 偏好酱料 */
  favSauce: SauceId;
}

/** 顾客运行时状态 */
export type CustomerPhase = 'arriving' | 'queued' | 'ordering' | 'waiting' | 'done';

export interface Customer {
  uid: string;
  def: CustomerDef;
  phase: CustomerPhase;
  /** 排队/等待位置索引 */
  slotIndex: number;
  /** 剩余耐心时长（毫秒） */
  patienceLeft: number;
  /** 耐心总时长（毫秒） */
  patienceMax: number;
  /** 已点单的小票 id */
  ticketId: string | null;
  /** 服务结果（用于结算展示） */
  result?: ServeResult;
}

/** 单项评分结果 */
export interface ScoreBreakdown {
  waiting: number;
  grill: number;
  build: number;
  total: number;
}

/** 一次上菜结算 */
export interface ServeResult {
  customerUid: string;
  scores: ScoreBreakdown;
  tip: number;
  points: number;
  /** 烤肉细分 */
  grillDetail: { patties: number; avgError: number; burn: number };
  /** 组装细分 */
  buildDetail: { missing: number; extra: number; wrongOrder: number; offsetAvg: number };
}
