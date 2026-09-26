/** 全局配色（暖色快餐店基调，模仿原版明亮饱和风格） */
export const C = {
  bgTop: 0x2f2418,
  floor: 0x8c5a3c,
  floorDark: 0x74492f,
  wall: 0xf3d9b0,
  wallShade: 0xe3c294,
  counter: 0xc98a5b,
  counterTop: 0xe8b98c,
  steel: 0xb8bcc4,
  steelDark: 0x8b9099,
  grillBody: 0x3a3f47,
  grillPlate: 0x50565f,
  grillSlot: 0x2b2f36,
  tray: 0xd8dde3,
  plate: 0xf7f2e8,
  wood: 0xa9703f,
  woodDark: 0x7f5330,

  uiPanel: 0x3b2b1e,
  uiPanelLight: 0xfff4dd,
  uiBorder: 0x2a1c12,
  uiPrimary: 0xe8a33d,
  uiPrimaryDark: 0xc4831f,
  uiGreen: 0x4a9d4a,
  uiGreenDark: 0x357a35,
  uiRed: 0xd9534f,
  uiBlue: 0x4a90d9,
  uiText: 0x4a2f18,
  uiTextLight: 0xfff4dd,

  bun: 0xe8a94e,
  bunDark: 0xd99a3f,
  bunLight: 0xf7d9a0,

  ticket: 0xfffdf5,
  ticketLine: 0xd8d0bd,

  star: 0xf7c948,
} as const;

/** 颜色线性插值（0xRRGGBB） */
export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

/** 颜色加深/变浅 */
export function shade(color: number, amount: number): number {
  return amount >= 0 ? lerpColor(color, 0xffffff, amount) : lerpColor(color, 0x000000, -amount);
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
