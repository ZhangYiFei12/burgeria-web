import { BALANCE } from '../config/balance';
import type { CustomerDef, Doneness, SauceId, Ticket, TicketItem, ToppingId } from '../types';
import type { RNG } from '../core/RNG';
import { uid } from '../core/RNG';

/** 某等级下可用于订单的配料池 */
export interface OrderPool {
  toppings: ToppingId[];
  sauces: SauceId[];
}

/**
 * 订单生成：按顾客偏好加权抽取，等级越高项数越多（还原「越玩越复杂」）
 */
export function generateTicket(
  rng: RNG,
  customer: CustomerDef,
  rank: number,
  pool: OrderPool,
  day: number,
): Ticket {
  const { toppings, sauces } = pool;

  // 项数：等级越高越多（2-3 起步 → 最多 5 项）
  const maxItems = Math.min(5, 2 + Math.floor(rank / 2));
  const wanted = rng.int(2, maxItems);
  const wantedToppings = Math.max(1, wanted - 1);

  // 配料：偏好项权重更高（权重 3 vs 1）
  const pickedToppings: ToppingId[] = [];
  const available = [...toppings];
  for (let i = 0; i < wantedToppings && available.length > 0; i++) {
    const weights = available.map((t) => (customer.favorites.includes(t) ? 3 : 1));
    const chosen = rng.weighted(available, weights);
    pickedToppings.push(chosen);
    available.splice(available.indexOf(chosen), 1);
  }

  // 酱料：偏好酱料权重更高（权重 4 vs 1）
  const sauceWeights = sauces.map((s) => (s === customer.favSauce ? 4 : 1));
  const pickedSauce = rng.weighted(sauces, sauceWeights);

  // 火候：前期偏五分熟，等级越高 rare/well 概率上升（还原原版曲线）
  const doneness = pickDoneness(rng, rank);

  // 组装顺序：配料打乱后与酱料混合（酱料随机插入，符合小票上下顺序要求）
  const items: TicketItem[] = pickedToppings.map((topping) => ({ kind: 'topping', topping }));
  const insertAt = rng.int(0, items.length);
  items.splice(insertAt, 0, { kind: 'sauce', sauce: pickedSauce });
  // 肉饼固定在最底层之上（小票上「肉饼」永远排在配料之前）
  items.unshift({ kind: 'patty' });

  return {
    id: uid('ticket'),
    customerId: customer.id,
    doneness,
    items,
    createdAt: 0,
    day,
  };
}

/** 火候抽取：等级 1 时五分熟概率高，随等级提高 rare/well 增多 */
export function pickDoneness(rng: RNG, rank: number): Doneness {
  const mediumWeight = Math.max(3, 8 - rank * 0.5);
  return rng.weighted<Doneness>(['rare', 'medium', 'well'], [2 + rank * 0.3, mediumWeight, 1.5 + rank * 0.35]);
}

/**
 * 交付时校验：小票是否属于该顾客（挂错 → 0 分）
 */
export function ticketMatchesCustomer(ticket: Ticket | null, customerTicketId: string | null): boolean {
  if (!ticket || !customerTicketId) return false;
  return ticket.id === customerTicketId;
}

/** 顾客耐心总时长 */
export function patienceFor(customer: CustomerDef, rng: RNG): number {
  const [min, max] = BALANCE.patience.baseMs;
  return rng.float(min, max) * customer.patienceFactor;
}
