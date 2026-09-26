# 老爹汉堡店 · GitHub + Cloudflare Pages 部署方案

> 配套文档：`PLAN.md`（开发计划）· 本文档版本 v1.0
> 选型结论：**Cloudflare Pages Git 集成** · **公开仓库 + 公开页面** · 免费域名 `*.pages.dev`

---

## 1. 方案总览

### 1.1 架构

```
本地开发 (D:/pi/papas-burgeria)
   │  git push
   ▼
GitHub 仓库 (公开, burgeria-web)          ── main 分支   ──▶ 生产环境  https://burgeria-web.pages.dev
   │                                        ── dev 分支   ──▶ 预览环境  https://xxxx.burgeria-web.pages.dev
   ▼  Webhook 自动触发
Cloudflare Pages 全球构建/托管
   │  npm run build → dist/
   ▼
访客 ──▶ 边缘 CDN（无限带宽，全静态，零冷启动）
```

### 1.2 已确认决策记录

| 项 | 决策 | 说明 |
|---|---|---|
| 部署方式 | Pages Git 集成 | CF 面板绑定仓库，push 即自动构建，零 CI 维护 |
| 仓库可见性 | 公开 | ⚠️ 见 §4 风险缓解（必须阅读） |
| 域名 | `*.pages.dev` | 免费，后续可随时加自定义域名（§9.2） |
| 构建产物 | 纯静态 `dist/` | Vite 单页应用，无服务端，Pages 免费档完美匹配 |
| 仓库名 | `burgeria-web` | **中性命名**，避开原版商标词（§4.1） |

---

## 2. 现状核查（已确认）

| 检查项 | 状态 |
|---|---|
| git / gh CLI | ✅ gh 2.98.0，已登录 `ZhangYiFei12`（HTTPS 协议） |
| Node / npm | ✅ v24.19.0 / 11.17.0（构建环境将固定为 20 LTS，见 §7.1） |
| 项目目录 | `D:/pi/papas-burgeria/`，当前仅 PLAN.md，**尚无独立 git 仓库** |
| 父仓库 | `D:/pi` → `github.com/ZhangYiFei12/elsfk.git`，需与本项目**隔离**（§3.3） |

---

## 3. 仓库策略

### 3.1 独立仓库

`papas-burgeria` 建立自己的 git 仓库（不并入父仓库 elsfk）：

- 独立的提交历史、Issues、Releases；
- Pages 只监听该仓库，构建无关代码不会被误触发。

### 3.2 分支模型

| 分支 | 用途 | Pages 行为 |
|---|---|---|
| `main` | 稳定版，里程碑/功能完成后合入 | 自动部署到**生产** `burgeria-web.pages.dev` |
| `dev` | 日常开发主分支 | 自动部署到**预览** URL（固定别名） |
| `feat/xxx` | 单功能分支 | 每次 push 生成一次性预览 URL（哈希前缀） |

### 3.3 与父仓库（D:/pi）隔离

父仓库的 `.gitignore` 追加一行，避免嵌套仓库被误跟踪：

```gitignore
papas-burgeria/
```

---

## 4. ⚠️ 版权风险与公开部署的缓解措施（必读）

你已选择**公开仓库 + 公开页面**。游戏机制复刻本身合法，但「高仿原版画风 + 公网分发」放大了风险面。以下缓解措施**全部执行**：

| # | 措施 | 落点 |
|---|---|---|
| 1 | **仓库/项目/页面标题全中性命名**：`burgeria-web`、页面标题「汉堡小店」，不用 Papa's / 老爹 / Flipline 字样 | 仓库名、index.html `<title>`、游戏内标题画面 |
| 2 | **素材 100% 自绘**：程序化矢量生成（PLAN.md §3.3），不引用任何原版贴图/音频文件 | `src/art/` |
| 3 | **README 显著声明**：「Fan-style 原创复刻，仅致敬玩法；所有美术/音频均为本项目原创；如权利人认为侵权请联系即删」 | README.md 顶部 |
| 4 | **不使用原版角色名/顾客名**（顾客用自创名字表） | `src/config/customers.ts` |
| 5 | **保留回退预案**：若收到 Cloudflare DMCA 下架或权利方函件，随时可切换为「私有仓库 + Access 邮箱保护」模式（§9.1，10 分钟内完成） | 本文档 |

> 现实预期：此类同人复刻在公网上大量存在，被主动追责的概率低，但**不为零**。上述措施能显著降低被识别为「直接侵权」的可能。

---

## 5. 一次性初始化步骤（Phase 0 内执行，约 15 分钟）

### Step 1 · 项目脚手架与 .gitignore（若 Phase 0 尚未建脚手架，先建再继续）

```bash
cd D:/pi/papas-burgeria
# .gitignore 由脚手架生成，确认包含：
# node_modules/  dist/  .DS_Store  *.local  .env*
```

### Step 2 · 初始化独立仓库并推送 GitHub

```bash
cd D:/pi/papas-burgeria
git init -b main
git add .
git commit -m "chore: project scaffold + docs"

gh repo create burgeria-web --public --source=. --remote=origin --push
# ↳ 等价于：在 ZhangYiFei12 名下创建公开仓库 burgeria-web，并推送 main
```

### Step 3 · 父仓库隔离

```bash
cd D:/pi
echo "papas-burgeria/" >> .gitignore
```

### Step 4 · Cloudflare Pages 创建项目（面板操作）

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Workers & Pages** → **Create** → **Pages** 标签 → **Connect to Git**
2. 授权 GitHub → 选择仓库 `ZhangYiFei12/burgeria-web` → **Begin setup**
3. 构建配置：

| 配置项 | 值 |
|---|---|
| Project name | `burgeria-web`（即生产子域名） |
| Production branch | `main` |
| Framework preset | `Vite`（或 None） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 环境变量 | `NODE_VERSION` = `20`（生产与预览都配，见 §7.1） |

4. **Save and Deploy** → 首次构建完成后获得生产 URL `https://burgeria-web.pages.dev`

### Step 5 · 启用 dev 分支预览

Pages 项目 → **Settings → Builds & deployments → Branch control → Preview deployments** 确认为 **Enabled（All non-Production branches）**：

```bash
git checkout -b dev && git push -u origin dev
# → 自动生成预览 URL: https://<hash>.burgeria-web.pages.dev 及分支别名
```

### Step 6 · 验证清单

- [ ] `https://burgeria-web.pages.dev` 能打开游戏标题画面
- [ ] push 一个空提交到 `main`，观察 Pages 构建日志成功（约 30-60 秒）
- [ ] push 到 `dev`，预览 URL 生效
- [ ] `curl -I https://burgeria-web.pages.dev` 返回 200 且带 `cf-ray` 头

---

## 6. 日常发布流程

```bash
# 日常开发
git checkout dev && git commit -m "feat: ..." && git push
#     → 预览 URL 自动更新，手机/其他设备直接开预览链接试玩

# 功能分支（可选）
git checkout -b feat/grill-system && git push
#     → 一次性预览 URL，方便分享验收

# 发版：dev 验收通过 → 合入 main
git checkout main && git merge dev && git push
#     → 生产 URL 自动上线
```

---

## 7. 构建配置细则

### 7.1 Node 版本固定

Pages 构建镜像的默认 Node 版本会漂移，**必须固定**：面板环境变量 `NODE_VERSION=20`（生产 + 预览各配一份）。本地开发用 24 无碍——构建行为以 CI 为准，避免「本地好、线上坏」。

### 7.2 缓存与安全头（`public/_headers`，Vite 会原样拷入 dist 根目录）

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: no-cache

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

> Vite 产物文件名自带内容哈希，`/assets/*` 可安全设为一年不可变；`index.html` 不缓存保证发版即生效。

### 7.3 SPA 路由

本游戏是单入口页面，无前端路由，**不需要** `_redirects`。若未来加帮助页等子路由，再补：

```
/*  /index.html  200
```

---

## 8. 运维手册

### 8.1 回滚

Pages → 项目 → **Deployments** → 选历史构建 → **Rollback to this deployment**。秒级生效，无停机。

### 8.2 免费额度（Pages）

| 项 | 免费额度 | 本项目用量预估 |
|---|---|---|
| 带宽 / 请求数 | 无限 | — |
| 构建次数 | 500 次/月 | 数十次，富余 |
| 单次部署文件数 / 单文件大小 | 20,000 个 / 25 MiB | 全程序化素材，远小于限制 |
| 并发构建 | 1 | 个人开发足够 |

### 8.3 故障排查速查

| 症状 | 排查 |
|---|---|
| 构建失败 `Unsupported engine` | 检查 `NODE_VERSION` 环境变量是否已配 |
| 构建成功但页面 404 | Build output directory 是否为 `dist`；`npm run build` 本地先验证 |
| 页面白屏 | 浏览器控制台看资源路径（`vite.config.ts` 无需设 base，根路径部署即可） |
| 改了没生效 | 确认 push 的分支 = 生产分支 `main`；看 Deployments 是否有新构建 |
| 构建排队久 | 免费档并发=1，属正常；紧急时用 §9.3 本地直传兜底 |

---

## 9. 可选增强

### 9.1 回退预案：切「私有 + Access 保护」（收到投诉时执行，约 10 分钟）

1. GitHub：仓库 Settings → Danger Zone → **Change visibility → Private**（Pages Git 集成对私有仓库继续工作）
2. Cloudflare Zero Trust（免费 50 用户内）→ **Access → Applications → Add → Self-hosted**
   - 域名填 `burgeria-web.pages.dev`
   - Policy：Allow / Emails / 只填你自己的邮箱（验证方式 One-time PIN）
3. 效果：任何访客打开链接需先邮箱验证码通过，游戏对外不可见

### 9.2 自定义域名（以后可选）

域名 NS 托管到 Cloudflare → Pages 项目 → **Custom domains → Set up** → 输入域名 → 自动签发 SSL，无需手动证书。

### 9.3 Wrangler 本地直传（CI 故障兜底）

```bash
npm i -D wrangler
npx wrangler login
npx wrangler pages project create burgeria-web --production-branch=main
npm run build && npx wrangler pages deploy dist --project-name=burgeria-web
```

### 9.4 趋势备注

Cloudflare 正在推荐新项目用 **Workers + Static Assets**（Pages 的继任方向），但 Pages 长期受支持、配置最简，个人静态项目现阶段仍是首选；未来迁移成本极低（同一 `dist/`）。

---

## 10. 与开发计划（PLAN.md）的整合

| 时机 | 动作 |
|---|---|
| **Phase 0** | 执行本文档 §5 全部初始化 → 骨架即上线（部署管线先于游戏内容就绪） |
| Phase 1-8 | 日常走 §6 流程：dev 分支持续预览；**每个里程碑 M1-M4 合入 main 上生产** |
| Phase 7（高仿美术）上线前 | 复查 §4 缓解措施 1-4 全部落实后再合 main |
| Phase 9 | README 上线声明 + §5.6 验证清单复跑 |

---

## 11. 命令速查

```bash
# ── 首次（Phase 0）──────────────────────────────
cd D:/pi/papas-burgeria
git init -b main && git add . && git commit -m "chore: scaffold"
gh repo create burgeria-web --public --source=. --remote=origin --push
cd D:/pi && echo "papas-burgeria/" >> .gitignore
# → CF 面板绑定仓库（§5 Step 4）

# ── 日常 ────────────────────────────────────────
git push                                    # 当前分支自动部署
git checkout main && git merge dev && git push   # 发生产
npx wrangler pages deploy dist --project-name=burgeria-web   # CI 兜底直传
```
