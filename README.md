# 汉堡小店（burgeria-web）

网页版汉堡店经营游戏 —— 致敬经典快餐店经营玩法的**原创复刻**项目。

## ⚠️ 版权声明

- 本项目**仅用于个人学习**游戏开发，复刻的是**玩法机制**（机制本身不受版权保护）。
- 所有美术（程序化矢量绘制）与音频（Web Audio 合成）均为**本项目原创**，不含任何第三方游戏素材。
- 与 "Papa's xxx" 系列无任何关联；如权利人认为本项目构成侵权，请联系仓库所有者即删。

## 技术栈

Phaser 3 + TypeScript + Vite · 纯静态，无服务端 · 全部资产程序化生成（零图片/音频文件）

## 开发

```bash
npm install
npm run dev      # 本地开发 http://localhost:5173
npm run build    # 产物输出 dist/
npm run preview  # 本地预览构建产物
npm run deploy   # Wrangler 直传 Cloudflare Pages（CI 兜底）
```

## 文档

- [PLAN.md](./PLAN.md) —— 开发计划（机制考据 / 分阶段 / 里程碑）
- [DEPLOY.md](./DEPLOY.md) —— GitHub + Cloudflare Pages 部署方案
