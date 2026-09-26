import type { CustomerDef } from '../types';

/**
 * 顾客表（Phase 1 首发 8 位，全部为自创角色，不使用原版角色名）
 * 每位顾客：固定形象 + 订单偏好 + 耐心倍率
 */
export const CUSTOMERS: CustomerDef[] = [
  {
    id: 'xiaobei',
    name: '小北',
    look: { skin: 0xf3c9a4, hair: 0x3b2a21, hairStyle: 0, shirt: 0x4a90d9, hat: false },
    patienceFactor: 1.15,
    favorites: ['lettuce', 'tomato'],
    favSauce: 'ketchup',
  },
  {
    id: 'ayong',
    name: '阿勇',
    look: { skin: 0xd9a06a, hair: 0x1e1512, hairStyle: 3, shirt: 0xe8a33d, hat: true },
    patienceFactor: 1.0,
    favorites: ['onion', 'tomato'],
    favSauce: 'mustard',
  },
  {
    id: 'linda',
    name: '琳达',
    look: { skin: 0xf7d7bb, hair: 0xb5452f, hairStyle: 1, shirt: 0xd94f8a, hat: false },
    patienceFactor: 1.25,
    favorites: ['lettuce', 'pickle'],
    favSauce: 'mayo',
  },
  {
    id: 'laozhou',
    name: '老周',
    look: { skin: 0xe0b083, hair: 0x8c8c8c, hairStyle: 2, shirt: 0x6b7f5e, hat: true },
    patienceFactor: 0.85,
    favorites: ['pickle', 'onion'],
    favSauce: 'mustard',
  },
  {
    id: 'dingding',
    name: '丁丁',
    look: { skin: 0xf3c9a4, hair: 0x2b1f5c, hairStyle: 0, shirt: 0x54c1b8, hat: false },
    patienceFactor: 1.1,
    favorites: ['lettuce', 'onion', 'tomato'],
    favSauce: 'ketchup',
  },
  {
    id: 'maike',
    name: '麦克',
    look: { skin: 0xc98a5b, hair: 0x3d2b1f, hairStyle: 3, shirt: 0x9b5de5, hat: false },
    patienceFactor: 0.9,
    favorites: ['tomato', 'pickle'],
    favSauce: 'mayo',
  },
  {
    id: 'susu',
    name: '苏苏',
    look: { skin: 0xfae0c8, hair: 0x1f1a17, hairStyle: 1, shirt: 0xe05a5a, hat: false },
    patienceFactor: 1.2,
    favorites: ['lettuce', 'pickle', 'onion'],
    favSauce: 'ketchup',
  },
  {
    id: 'ajie',
    name: '阿杰',
    look: { skin: 0xe8b98c, hair: 0x5a3a26, hairStyle: 2, shirt: 0x3f9c5a, hat: true },
    patienceFactor: 0.95,
    favorites: ['onion', 'lettuce'],
    favSauce: 'mustard',
  },
];

export function customerById(id: string): CustomerDef {
  const found = CUSTOMERS.find((c) => c.id === id);
  if (!found) throw new Error(`未知顾客: ${id}`);
  return found;
}
