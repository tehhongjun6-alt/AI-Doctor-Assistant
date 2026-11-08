# PLAN.md — Medora 健康指南（第一版）

> 规划日期：2026-11-06｜状态：**全部完成（2026-11-08）**，已存档
> 之前的计划都已完成，存档在 `plans/` 文件夹
>
> **执行者须知**：每一步都写明了「改哪些文件、怎么做、完成标准」。**设计已经定好，照着做，不要自行改设计。** 如果发现计划和代码对不上，停下来汇报，不要自己发挥。**第 5 步之前不要推送**（推送会触发线上部署）。

## 1. 项目是什么

- **产品**：Medora，给马来西亚用户用的 AI 健康咨询网页（[heymedora.vercel.app](https://heymedora.vercel.app/)）
- **这次的目标**：在侧边栏「附近诊所」下面加一个「**健康指南**」页面，放 20 张常见病卡片，点开可以看知识重点，再一键去问 Medora
- **项目阶段**：**C（已经做完，要升级）**｜**规模**：小～中型（只改前端，最花时间的是写内容）
- **现有架构（这次只碰前端）**
  - 前端：React 19 + Vite，`consultation-frontend/src/`
  - 工作区页面切换：`workspace/Sidebar.tsx` 第 8 行 `type Section = 'chat' | 'map'`，第 46–49 行是导航项目；`App.tsx` 用 `section` 状态切换页面（约第 80、177–183、279、311 行）
  - 设计规范：`src/design/tokens.css`；图标组件：`components/Icon.tsx`
  - 文字：`i18n.ts`，三种语言 `'zh' | 'en' | 'ms'`，`ms` 的 key 必须和 `zh` 一样（TypeScript 会检查）
- **测试命令**：`cd consultation-frontend && npm test`（**必须用 `npm test`**，它会加上 jsdom 环境），编译检查 `npm run build`

## 2. 已定决策

| 决策 | 选择 | 为什么 |
|---|---|---|
| 名称 | 中文「**健康指南**」、English「**Health Guide**」、BM「**Panduan Kesihatan**」 | 一看就知道是健康知识 |
| 内容存在哪 | 前端的 TypeScript 文件 `src/guide/guideTopics.ts`，**不用数据库、不用后端** | 内容固定，最简单；用 TypeScript 能检查三种语言都有写 |
| 图片 | **Health Icons** 的开源医疗图标，加上分类代表色 | CC0 公有领域授权，免费、不用标注出处、风格统一；不用真实病症照片，避免吓到用户 |
| 图标怎么上色 | 把 SVG 文件放进项目，用 CSS `mask-image` 显示，颜色由分类的 CSS 变量决定 | 不加新套件，同一个图标可以套用任何颜色 |
| 详情怎么显示 | 点卡片弹出详情：电脑版是对话框，手机版是全屏 | 不用换页，关掉就回到卡片墙 |
| 「问 Medora」 | 切到问诊页，**把问题填进输入框，但不自动发送** | 用户可以先修改；对话满 3 个时也能用 |
| 内容谁写 | AI 根据权威资料起草，**用户审核后才算完成**；马来语再请会马来语的人看 | 医疗内容必须有人把关 |

### 20 个主题（已和用户确认）

| # | id | 中文 | English | 分类 | 建议的 Health Icons 图标（实际名称以官网为准） |
|---|---|---|---|---|---|
| 1 | `dengue` | 骨痛热症 | Dengue | 传染病 | Malaria / Mosquito 相关 |
| 2 | `influenza` | 流感 | Influenza | 传染病 | Virus / Viral Lung Infection |
| 3 | `covid19` | 新冠 | COVID-19 | 传染病 | Virus 相关 |
| 4 | `hfmd` | 手足口病 | Hand, Foot and Mouth Disease | 传染病 | Child / Baby 相关 |
| 5 | `tuberculosis` | 结核病 | Tuberculosis (TB) | 传染病 | Lungs |
| 6 | `gastroenteritis` | 急性肠胃炎和食物中毒 | Gastroenteritis & Food Poisoning | 传染病 | Stomach / Diarrhea 相关 |
| 7 | `diabetes` | 糖尿病 | Diabetes | 慢性病 | Diabetes / Glucose 相关 |
| 8 | `hypertension` | 高血压 | High Blood Pressure | 慢性病 | Blood Pressure 相关 |
| 9 | `cholesterol` | 高胆固醇 | High Cholesterol | 慢性病 | Heart / Blood 相关 |
| 10 | `asthma` | 哮喘 | Asthma | 慢性病 | Inhaler / Lungs |
| 11 | `kidney` | 慢性肾病 | Chronic Kidney Disease | 慢性病 | Kidneys |
| 12 | `gout` | 痛风 | Gout | 慢性病 | Joint / Foot 相关 |
| 13 | `cold` | 感冒和喉咙痛 | Common Cold & Sore Throat | 日常不适 | Cough / Throat 相关 |
| 14 | `fever` | 发烧（大人和小孩） | Fever (Adults & Children) | 日常不适 | Temperature / Thermometer Digital |
| 15 | `gastritis` | 胃痛和胃酸倒流 | Stomach Pain & Acid Reflux | 日常不适 | Stomach |
| 16 | `eczema` | 湿疹和皮肤过敏 | Eczema & Skin Allergy | 日常不适 | Dermatology |
| 17 | `mental-health` | 焦虑和抑郁 | Anxiety & Depression | 日常不适 | Brain / Mental Health 相关 |
| 18 | `stroke` | 中风 | Stroke | 认识急症 | Brain |
| 19 | `heart-attack` | 心脏病发作 | Heart Attack | 认识急症 | Heart |
| 20 | `heatstroke` | 中暑 | Heatstroke | 认识急症 | High Temperature |

分类：`infection`（传染病，6 个）、`chronic`（慢性病，6 个）、`everyday`（日常不适，5 个）、`emergency`（认识急症，3 个）

## 3. 护栏与不可改动的部分

### 护栏（必须做到）

- **内容只能来自权威来源**：NHS、MedlinePlus、WHO、马来西亚卫生部（KKM / MyHealth）。每张卡片至少 1 个来源，**链接必须是执行者实际打开过、确认存在的页面**，不准编造网址
- **用自己的话写**，不准整段复制来源网站的文字（版权）
- 每张卡片都要有「**什么时候要立刻看医生**」，而且不能是空的
- 急症分类的 3 张卡片：「什么时候要立刻看医生」第一条必须是「立即拨打 999」
- 骨痛热症卡片：必须写明退烧用 paracetamol，**不要吃布洛芬（ibuprofen）或阿司匹林（aspirin）**
- 焦虑和抑郁卡片：必须附上求助热线（Befrienders KL **03-7627 2929**，后端急症模板已在用这个号码），以及有自伤念头时立即拨打 999
- 不写药物剂量；不做诊断性的说法（例如「你有这些症状就是 XX 病」）
- 页面底部和详情页都要有免责声明：「以上内容仅供健康教育参考，不能替代医生的诊断和治疗」
- 每张卡片显示「最后审核日期」
- 分类颜色和卡片文字的对比度至少要 4.5:1
- 所有新增的界面文字都要有中、英、马三种语言
- 新界面一律使用 `src/design/tokens.css` 的变量，不准自己写色码（新的分类颜色要先加进 tokens.css）

### 不可改动（除非用户明确同意）

- 后端完全不改；不加新的 npm 套件
- Medora 现有的视觉设计和品牌色
- 问诊、地图现有的行为
- 现有的测试不准修改，只能新增

## 4. 分步计划

### [x] 第 1 步｜图标和分类颜色（只改前端）

**做法**：
1. 到 [healthicons.org](https://healthicons.org/) 按第 2 节的表格，替 20 个主题各挑一个 **outline（线条）风格、24px** 的图标，下载 SVG，存成 `src/guide/icons/<id>.svg`（例如 `dengue.svg`）
   - 表格里的图标名称只是建议，以官网实际有的为准；找不到合适的就挑最接近的，并把实际用的图标名称记在 README
2. 新建 `src/guide/icons/README.md`，写明：
   - 来源：Health Icons（https://healthicons.org/ ，https://github.com/resolvetosavelives/healthicons ）
   - 授权：CC0 公有领域（2026-11-06 已查证），不需要标注出处
   - 20 个主题各自用了哪个图标
3. `src/design/tokens.css`：新增 4 组分类颜色，各有主色和浅底色。**不要用蓝紫色**：
   ```css
   --guide-infection: #2e7d6b;      --guide-infection-bg: #e8f4f1;
   --guide-chronic: var(--berry-700); --guide-chronic-bg: var(--pink-50);
   --guide-everyday: #8a5a00;       --guide-everyday-bg: #fdf4e1;
   --guide-emergency: var(--emergency); --guide-emergency-bg: var(--emergency-bg);
   ```

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/guide/icons.test.ts`：用 `import.meta.glob('./icons/*.svg', { query: '?raw', import: 'default', eager: true })` 读取所有图标，确认**刚好 20 个**，文件名和第 2 节的 20 个 id 一一对应，而且每个文件内容都以 `<svg` 开头
- 前端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：图标确实来自 Health Icons（README 有记录）；没有用蓝紫色；tokens.css 只新增、没有改动现有变量

**实际做法（2026-11-06，待验收）**：
- 20 个图标全部取自官方仓库 `public/icons/svg/outline-24px/`，原样下载；实际名称见 `src/guide/icons/README.md`。和建议不同的：哮喘用 `body/lungs`（24px 没有吸入器）、湿疹用 `conditions/allergies`（24px 没有 Dermatology）、中风用 `body/neurology`、高胆固醇用 `body/blood-drop`、手足口病用 `people/boy-0105y`
- 授权：已读官方 LICENSE，`public/icons` 的 SVG 为 CC0 1.0
- `tokens.css` 在「地图机构类型」后面只新增 8 个 `--guide-*` 变量，数值完全照计划
- 测试：`src/guide/icons.test.ts`（2 个测试）；`npm test` 11 个文件 39 个测试全过；`npm run build` 成功（只有原本就有的 chunk 超过 500 kB 提醒）
- ⚠️ 已知事项（用户同意先照计划做）：传染病主色在浅底上对比度 4.37:1、急症 4.36:1，低于 4.5:1；当图标用（3:1 标准）没问题，第 3 步分类小标签不要用「主色字 + 浅底」

### [x] 第 2 步｜20 张卡片的内容（只改前端）

**做法**：
1. 新建 `src/guide/guideTypes.ts`：
   ```ts
   import type { Language } from '../i18n'
   export type GuideCategory = 'infection' | 'chronic' | 'everyday' | 'emergency'
   export type Localized<T> = Record<Language, T>   // zh、en、ms 三种语言都必须有
   export interface GuideSource { name: string; url: string }
   export interface GuideTopic {
     id: string
     category: GuideCategory
     title: Localized<string>          // 病名
     summary: Localized<string>        // 这是什么：中文 60 字以内
     symptoms: Localized<string[]>     // 常见症状：3～5 条
     care: Localized<string[]>         // 怎么处理和预防：3～5 条
     seeDoctor: Localized<string[]>    // 什么时候要立刻看医生：2～4 条
     askPrompt: Localized<string>      // 「问 Medora」时填进输入框的问题
     sources: GuideSource[]            // 至少 1 个
     reviewedAt: string                // 最后审核日期，格式 'YYYY-MM-DD'
   }
   ```
2. 新建 `src/guide/guideTopics.ts`：`export const GUIDE_TOPICS: GuideTopic[]`，按第 2 节表格的顺序写 20 个主题
   - 每条重点都写成短句，口语化，中文每条 30 字以内
   - `askPrompt` 例如：「我想了解骨痛热症的危险信号，以及什么时候要去医院？」
   - 内容要符合第 3 节护栏的每一条
   - `reviewedAt` 先填写作的日期，用户审核后再更新

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/guide/guideTopics.test.ts`：
  - 刚好 20 个主题，`id` 没有重复，而且和第 2 节表格一致
  - 分类数量：`infection` 6、`chronic` 6、`everyday` 5、`emergency` 3
  - 每个主题三种语言的 `title`、`summary`、`askPrompt` 都不是空的；`symptoms`、`care` 各 3～5 条，`seeDoctor` 2～4 条
  - 每个主题至少 1 个来源，网址以 `https://` 开头
  - 3 张急症卡片三种语言的 `seeDoctor[0]` 都包含「999」
  - `dengue` 的中文 `care` 包含「paracetamol」和「布洛芬」，英文 `care` 包含「ibuprofen」
  - `mental-health` 三种语言的 `seeDoctor` 都包含「03-7627 2929」和「999」
  - `reviewedAt` 符合 `YYYY-MM-DD` 格式
- 前端 `npm test` 全部通过，`npm run build` 没有错误
- **【你做】逐张审核中文内容**（大约 20～30 分钟）；有问题的地方告诉执行者修改，审核完成才算这一步结束
- 【你做】马来语请会马来语的人看（可以在第 5 步之前完成）

**验收重点**：每个来源网址都要实际打开确认存在；内容不是从来源网站整段复制的；没有写药物剂量

**实际做法（2026-11-06，AI 草稿完成，等用户审核内容）**：
- 新增 `src/guide/guideTypes.ts`、`src/guide/guideTopics.ts`（20 个主题，顺序同第 2 节表格）、`src/guide/guideTopics.test.ts`
- 来源：WHO（骨痛热症）+ NHS 各页面 + Befrienders KL 官网；25 个网址全部用 curl 实际打开，HTTP 200，用的是跳转后的最终网址
- 内容用自己的话写；没有写剂量；中文每条 ≤30 字、简介 ≤60 字（已用脚本检查）
- 本地化：不用 NHS 的 111，改成看医生 / 999；高血压、高胆固醇、哮喘、胃痛、湿疹的 seeDoctor 也加了「出现急症信号拨打 999」
- `reviewedAt` 全部先填 2026-11-06
- 测试：`npm test` 12 个文件 64 个测试全过；`npm run build` 成功
- ✅ 用户已审核中文内容（2026-11-06）
- ⏳ 还差：马来语请会马来语的人看（第 5 步之前）

### [x] 第 3 步｜健康指南页面（只改前端）

**做法**：
1. `workspace/Sidebar.tsx`：
   - 第 8 行改成 `export type Section = 'chat' | 'map' | 'guide'`
   - 第 46–49 行的 `items` 在 `map` 后面加 `{ id: 'guide', icon: 'book', label: t.navGuide }`
2. 新建 `src/guide/GuidePanel.tsx`（卡片墙）：
   - 顶部：标题 `t.guideTitle`、一句介绍 `t.guideIntro`
   - 分类筛选按钮：全部 / 传染病 / 慢性病 / 日常不适 / 认识急症（`role="tablist"` 或一组 `aria-pressed` 按钮）
   - 卡片网格：手机 2 栏、平板 3 栏、电脑 4 栏；每张卡片是一个 `<button>`，有图标（第 4 点）、病名、分类小标签
   - 页面底部：免责声明 `t.guideDisclaimer`
3. 新建 `src/guide/GuideDetail.tsx`（详情）：
   - `role="dialog"`、`aria-modal="true"`、`aria-labelledby` 指向标题；按 Esc 或点关闭按钮会关闭，关闭后焦点回到原来那张卡片
   - 电脑版是置中的对话框；手机版（宽度 < 768px）是全屏
   - 内容依序：图标 + 病名 + 分类 → 这是什么 → 常见症状 → 怎么处理和预防 → 🔴 什么时候要立刻看医生（用 `--emergency` 系列颜色标出）→ 来源（新分页打开）和「最后审核：YYYY-MM-DD」→ 免责声明 →「问 Medora」按钮（第 4 步才接上功能，这一步先放按钮并呼叫 `onAsk(topic)`）
4. 新建 `src/guide/GuideIcon.tsx`：用 `import.meta.glob('./icons/*.svg', { query: '?url', import: 'default', eager: true })` 取得图标网址，显示成一个 `<span aria-hidden="true">`，style 设定 `mask-image` 和 `-webkit-mask-image` 为该网址，`background-color` 为 `var(--guide-<category>)`；外框背景用 `var(--guide-<category>-bg)`
5. 新建 `src/guide/guide.css`：所有样式只用 tokens 变量
6. `App.tsx`：
   - 在地图那个 `ws-view`（约第 311 行）后面，加一个 `section === 'guide'` 时显示的 `ws-view`，放 `<GuidePanel lang={lang} onOpenMenu={() => setDrawerOpen(true)} onAsk={...} />`
   - 手机版顶部要有打开菜单的按钮，跟地图页一样
7. `i18n.ts`（三种语言）：`navGuide`、`guideTitle`、`guideIntro`、`guideAll`、`guideCatInfection`、`guideCatChronic`、`guideCatEveryday`、`guideCatEmergency`、`guideWhatIs`、`guideSymptoms`、`guideCare`、`guideSeeDoctor`、`guideSources`、`guideReviewed`、`guideAsk`、`guideClose`、`guideDisclaimer`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/guide/GuidePanel.test.tsx`：
  - 显示 20 张卡片
  - 点「认识急症」后只剩 3 张
  - 点「骨痛热症」卡片会打开对话框，标题是骨痛热症，而且看得到「什么时候要立刻看医生」区块和来源链接
  - 按 Esc 关闭对话框
  - 切到 BM 后，导航和标题显示马来语
- 新增测试：侧边栏有「健康指南」，点了会显示健康指南页面
- 前端 `npm test` 全部通过，`npm run build` 没有错误
- 【你做】电脑和手机各打开一次，看卡片墙和详情的样子

**验收重点**：问诊和地图页面行为不变；对话框可以用键盘操作；颜色都来自 tokens

**实际做法（2026-11-06，待验收）**：
- `Sidebar.tsx`：`Section` 加 `'guide'`，导航加 `book` 图标的「健康指南」
- 新增 `GuidePanel.tsx`、`GuideDetail.tsx`、`GuideIcon.tsx`、`guide.css`，另加一个小文件 `guideLabels.ts`（分类名称对照，面板和详情共用）
- 筛选用一组 `aria-pressed` 按钮；对话框 Esc / 关闭按钮 / 点背景关闭，Tab 在对话框里循环，关闭后焦点回到卡片
- 分类小标签用「分类浅底 + 正文次要色文字 + 分类主色小圆点」，避开第 1 步记下的对比度问题；急症区块标题用 `--emergency-hover`（比 `--emergency` 深，对比度够）
- 遮罩颜色用 `color-mix(var(--ink-900) 36%, transparent)`，没有新写色码，tokens.css 没改
- `App.tsx`：地图后面加 `section === 'guide'` 的 `ws-view`；`onAsk` 先放空函数，第 4 步接上
- `i18n.ts`：三种语言各加 17 个 key
- 测试：新增 `src/guide/GuidePanel.test.tsx`（20 张卡、急症筛选剩 3 张、骨痛热症对话框和来源链接、Esc 关闭并回到卡片）和 `src/guide/guideNav.test.tsx`（侧边栏进入健康指南、切 BM 后导航和标题是马来语）；`npm test` 14 个文件 69 个测试全过；`npm run build` 成功
- 在浏览器看过电脑版（4 栏、置中对话框）和手机版（375px：2 栏、全屏详情），截图正常
- ⏳ 还差：【你做】电脑和手机各打开一次看样子

### [x] 第 4 步｜「问 Medora」按钮（只改前端）

**做法**：
1. `chat/ChatPanel.tsx`：`ChatPanelProps`（第 20–28 行）新增 `prefill?: { text: string; nonce: number }`。`prefill` 改变时（看 `nonce`），把 `text` 放进输入框（`setInput`）并把焦点移到输入框，**不要自动发送**
2. `App.tsx`：
   - 新增状态 `const [chatPrefill, setChatPrefill] = useState<{ text: string; nonce: number }>()`
   - `GuidePanel` 的 `onAsk={(topic) => { setChatPrefill({ text: topic.askPrompt[lang], nonce: Date.now() }); setSection('chat') }}`
   - 把 `prefill={chatPrefill}` 传给 `ChatPanel`
   - **不要**自动开新对话，留在当前的对话里

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/guide/askMedora.test.tsx`：打开「骨痛热症」→ 点「问 Medora」→ 画面切回问诊页，输入框的内容等于该主题的中文 `askPrompt`，而且**没有**发出任何聊天请求（模拟的 fetch 没有被调用到 `/api/chat`）
- 前端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：不会自动发送；对话满 3 个时也能正常填入

**实际做法（2026-11-06，2026-11-08 已验收）**：
- `ChatPanel.tsx`：新增 `prefill?: { text; nonce }`，`nonce` 变了就 `setInput(text)` 并把焦点移到输入框，不发送
- `App.tsx`：新增 `chatPrefill` 状态；`GuidePanel` 的 `onAsk` 填入 `topic.askPrompt[lang]` 并切到问诊页，留在当前对话
- 计划外的一点小改动：`startNewChat`、`selectConversation` 里会清掉 `chatPrefill`，避免开新对话 / 换对话时旧问题又被填进去
- 测试：新增 `src/guide/askMedora.test.tsx`（填入内容等于中文 askPrompt、焦点在输入框、没有调用 `/api/chat`；对话满 3 个时也能填入）；`npm test` 15 个文件 71 个测试全过；`npm run build` 成功

### [x] 第 5 步｜部署和线上验证

- 推送到 GitHub，等 Vercel 部署完成（后端没有改，Render 不用动）
- **完成标准**（【你做】用手机试）：
  - [x] 侧边栏有「健康指南」，打开后看到 20 张卡片
  - [x] 分类筛选正常
  - [x] 点开卡片可以看到完整内容，来源链接打得开
  - [x] 「问 Medora」会把问题填进输入框，不会自动发送
  - [x] 切换中文、EN、BM 都正常

**验收重点**：这一步由你亲自验收

**实际做法（2026-11-08，用户手机验收通过）**：
- 推送前前端 `npm test` 15 个文件 71 个测试全过，`npm run build` 成功
- 2026-11-08 推送 `0365216..d279f1e` 到 `main`（包含第 1～4 步），Vercel 约 40 秒部署完成
- 线上 bundle `assets/index-B9UvtvaH.js` 已包含「健康指南 / Health Guide / Panduan Kesihatan」、20 个主题的 `askPrompt`、Befrienders 热线
- 工作区要登录，AI 没有登录线上账号，界面验收由用户做
- 验收时发现 Render 免费实例休眠后唤醒不了（登录失败）；Restart service 无效，Manual Deploy → Deploy latest commit（`d279f1e`）后恢复
- ⚠️ 马来语还没请人看过（用户决定先上线）

## 5. 当前进度和下一步

- **当前进度**：第 1～5 步全部完成（2026-11-08 用户手机验收通过）
- **下一步**：本计划存档；下一个计划是向量 RAG（MOH CPG）

## 6. 分工

- **【你做】**
  - 第 2 步：逐张审核中文内容；请会马来语的人看马来语
  - 第 3、5 步：用电脑和手机实际看一次
- **【AI做】**：下载图标、写内容草稿、写代码和测试、每完成一步更新本文件进度
- **【一起】**：第 3 步完成后，看卡片的样式要不要调整

## 7. 关键假设和查证结果

- ✅ **已查证（2026-11-06，Health Icons 官方 GitHub）**：图标采用 CC0 公有领域授权，可自由修改，不用标注出处；共约 776 个图标；有 Lungs、Kidneys、Heart、Stomach、Brain、Dermatology、Temperature 等图标
- 每个主题的具体图标名称**需要到官网确认**；骨痛热症、中暑等可能没有完全对应的图标，用最接近的
- 浏览器对 CSS `mask-image` 的支持：现代浏览器都支持，Safari 需要加 `-webkit-` 前缀
- 内容由 AI 起草，需要人工审核；马来语由 AI 翻译，需要会马来语的人审核

## 8. 暂不做（以后再讨论）

- 更多主题、AI 自动生成卡片、审核后台
- 收藏、点赞、分享卡片
- 依照用户问过的问题推荐相关卡片
- 视频
- 紧急求助页、点选式症状自查、意见反馈、关于 Medora 等其他新页面

## 9. 【执行限制】

- 完成标准：<当前这一步在「4. 分步计划」里写的「完成标准」，例如第 1 步：「`src/guide/icons/` 刚好有 20 个 SVG，文件名对应 20 个 id，前端 `npm test` 全部通过」>，达到立即停止，不顺手优化别的
- 范围：只看与问题直接相关的文件，不扫全项目，不用子代理
- 次数：最多「修改 → 验证」2 轮；同一错误出现 2 次直接停
- 禁止：为了通过而修改 / 删除 / 跳过测试，或降低验证标准
- 停止时汇报：做了什么、当前证据、卡在哪、建议下一步（由我决定是否继续）

> 补充：这一批每一步的「允许修改的现有测试」都是「无」。新的测试一律放在新文件，不准改动旧测试。

## 10. 新对话开场白（开发用）

> 先读 PLAN.md 和现有代码，用 3 句话复述项目和当前进度。
> 我确认后，只做第 N 步，按完成标准验证，并更新 PLAN.md 进度。
> 做完后停下来等验收，不要自己提交。

## 11. 【验收流程】

每一步做完都要验收，**不能由做的那个对话自己验收**。

- **流程**：开发对话做第 N 步 → 开一个**全新的**验收对话检查 → 用户看结论决定 → 通过就提交 → 下一步
- **不通过**：把验收员列出的问题贴回开发对话修，修完再开一个新的验收对话检查（修的次数算在执行限制的「最多 2 轮」里）
- **验收对话必须是全新的对话**，不能继承开发对话的记忆；能换模型就换成和开发不同的模型
- **每一步验收通过后马上提交**；**第 5 步之前不要推送**
- 有界面的步骤，用户要亲自打开页面看一眼

### 验收开场白（把 N 换成步骤号）

> 你是验收员，不是开发者。只检查，**不准修改任何文件**。
> 1. 读 PLAN.md 第 N 步的「做法」「允许修改的现有测试」「完成标准」「验收重点」，以及第 3 节（护栏）和第 9 节（执行限制）。
> 2. 运行 `git status` 和 `git diff`，列出改了哪些文件，指出计划以外的改动。
> 3. 检查测试文件的改动：有没有修改、删除或跳过不在「允许修改」清单里的测试。
> 4. 自己运行测试命令，贴出结果摘要；不要只看之前的对话说通过了。
> 5. 逐条对照完成标准，每条标 ✅ 或 ❌，并附上证据（文件、行号或测试名称）。
> 6. 检查 PLAN.md 这一步是否打了 [x]，并记录了实际的做法和名称。
>
> 最后给出结论：**通过** 或 **不通过**。不通过时，列出要修的具体项目。
