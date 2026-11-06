# PLAN.md — Medora 第二批功能

> 规划日期：2026-11-06｜状态：规划已确认，尚未开始执行
> 上一份计划（7 步升级，已全部完成）存档在 `plans/2026-11-05-upgrade-v1.md`
>
> **执行者须知**：每一步都写明了「改哪些文件、怎么做、完成标准」。**设计已经定好，照着做，不要自行改设计。** 如果发现计划和代码对不上，停下来汇报，不要自己发挥。**第 12 步之前不要推送**：推送会触发线上部署，而第 9 步要先在数据库执行 SQL。

## 1. 项目是什么

- **产品**：Medora，给马来西亚用户用的 AI 健康咨询网页（[heymedora.vercel.app](https://heymedora.vercel.app/)），帮用户梳理症状、判断轻重、找附近诊所和医院
- **目标**：在现有功能上加 12 项改进，让回答更可靠、更好用，并支持马来语
- **用户**：马来西亚的中文、英文、马来语用户，用手机或电脑
- **项目阶段**：**C（已经做完，要升级）**｜**规模**：中型（产品原型）
- **现有架构**
  - 前端：React 19 + Vite + MapLibre，部署在 Vercel（`consultation-frontend/`）。2026-11-06 改版成 Medora 品牌后，代码分成这些文件夹：`chat/`、`map/`、`workspace/`、`landing/`、`login/`、`services/`、`components/`、`design/`（`design/tokens.css` 是设计规范）
  - 后端：Express 5 + TypeScript + Gemini（`@google/genai`），部署在 Render（`consultation-backend/`）
  - 数据库：Supabase Postgres，`public.users`、`public.conversations`、`public.conversation_messages` 三张表
  - 问诊流程（`src/app.ts` 的 `handleChat`，约第 316–717 行）：急症检测 → 路由 → 查医学资料 → Gemini 生成回答 → 安全检查 → `appendTurn` 存入数据库
- **测试命令**
  - 后端：`cd consultation-backend && npm test`，编译检查 `npm run build`
  - 前端：`cd consultation-frontend && npm test`（**必须用 `npm test`**，它会加上 jsdom 环境，直接跑 `npx vitest` 会全部失败），编译检查 `npm run build`

## 2. 已定决策

| 决策 | 选择 | 为什么 |
|---|---|---|
| 机制 | 保持现有流水线；新增一个「病情摘要」模块，同时用于就诊摘要和病情摘要记忆 | 两个功能需要的能力相同，做一次就好 |
| 框架 | 沿用 Express + React + Supabase，**不加新的 npm 套件** | C 阶段优先沿用 |
| 就诊摘要 | 每次按按钮时即时生成，**不存进数据库** | 内容以对话为准，不用担心旧摘要和对话不一致 |
| 病情摘要记忆 | 对话超过 20 条后，每多 10 条就把 20 条以外的旧内容整理一次，存在 `conversations.case_summary`；**在回答送出之后才在后台生成**，不拖慢回答 | 只多耗一点 Gemini 额度，长对话也记得开头的重点 |
| 重新回答 | 先删除最后一轮，再用同一句话重新生成 | 做法简单。失败时前端显示错误和「重试」按钮，重试会把那句话当普通消息重新发送，所以不会丢失内容 |
| 删除账号 | 必须重新输入密码；删除后，账号和所有对话**立即永久删除** | 健康数据，要彻底删除；输入密码可以防止误删 |
| 每一步花多少秒 | 写进 Render 的日志，也放在回应的 `timings` 字段；**不做界面** | 给开发者看的，不打扰用户 |
| 语音输入 | 用浏览器自带的语音识别，**不经过我们的后端** | 不用花钱，也不用加套件 |
| 马来语 | 语言代码 `ms`，界面按钮显示「BM」；AI 先翻译，再由会马来语的人审核 | 跟中文、英文同等支持 |

### 已和用户确认的细节

- 提示词放宽：AI 不确定时，要**明确告诉用户还不确定，并请用户多提供哪些信息**，不要硬猜原因
- 回答长度上限：从 1500 调到 3000 tokens
- 导航：Google Maps 按钮新设计已经有了，**只需要加 Waze**
- 复制和分享：手机用系统分享；不支持的浏览器改为分享到 WhatsApp
- 健康指南**不在这一批**，这一批全部完成后再规划

## 3. 护栏与不可改动的部分

### 护栏（必须做到）

- 原有的继续保留：急症拦截（含马来语）、输出安全检查（含英文）、不正式确诊、按用户限流、对话只有本人能看
- 新增：
  - 就诊摘要和病情摘要**只整理用户明确说过的内容**，没提到的就留空，不得推测；AI 的分析要标明「AI 初步分析，不是诊断」
  - 就诊摘要页面要注明「由 AI 整理，可能有遗漏或错误，就诊前请自行核对」
  - 删除账号必须先验证密码；只能删除自己的账号；删除后连同对话一起清除
  - 复制或分享出去的急症回答，文字里**一定要有拨打 999 的提示**
  - 语音输入旁边要说明「语音会由浏览器的语音服务处理」
  - 记录花费时间的日志里**不能出现用户说的内容**，只能有数字和路由名称
  - 马来语文字（界面、急症模板、免责声明）要请会马来语的人看一遍
  - 所有新增的界面文字都要有中文、英文；第 11 步以后还要有马来语
  - 新界面一律使用 `src/design/tokens.css` 里的变量，不准自己写色码

### 不可改动（除非用户明确同意）

- 部署平台（Render / Vercel / Supabase）；Render 的 `DATABASE_URL` 继续用 Supabase **Session pooler**
- `public.users` 的表结构和登录方式；`conversations` 和 `conversation_messages` **只能新增字段，不能改或删除现有字段**
- 现有的急症规则：**只能新增，不能删改**
- Gemini 模型和思考程度
- 现有接口的路径和行为：可以加字段，行为只能按本计划写的方式改
- Medora 的视觉设计（`src/design/tokens.css`、品牌、颜色）
- 本地开发端口：后端 8002

## 4. 分步计划

### [x] 第 1 步｜调高回答长度上限 + 提示词放宽（只改后端）

**问题**：
- `services/geminiHealthConsultation.ts` 第 334 行 `maxOutputTokens: 1500`，长回答容易被截断，解析失败后用户只会看到兜底回答
- 第 54 行的「防无限审问铁律」规定：用户回答过一轮追问后，就**必须**给出原因判断。信息不够时，AI 只能硬猜

**做法**：
1. `geminiHealthConsultation.ts`：新增并 export 纯函数 `resolveMaxOutputTokens(value: string | undefined): number`。`value` 是正整数就用它，否则回传 `3000`。第 334 行改成 `maxOutputTokens: resolveMaxOutputTokens(process.env.GEMINI_MAX_OUTPUT_TOKENS)`
2. 同一个文件：把 `const systemPrompt` 改名为 `export const CONSULTATION_SYSTEM_PROMPT`，所有用到的地方一起改
3. 把第 54 行那一条规则**整条替换**成下面这段（其他提示词一字不改）：
   ```
   2) 或者【追问规则】：用户已经回答过你上一轮的追问时，本轮默认切换为 "assessment_first"（或 "advice_first"）。
      但如果关键信息仍然不足以判断，可以再用一次 "inquiry_first"，并且必须做到：
      - summary 第一句明确告诉用户「目前信息还不够确定」，并说明还缺哪些信息、为什么需要；
      - followUpQuestions 只问 1～2 个最关键的问题；
      - possibleCauses 只列最常见的 1 条，或设为 []，绝不编造；
      - advice 照常给出安全的临时处理方式，seekCareWhen 保留危险信号。
      连续使用 "inquiry_first" 最多 2 轮；第 3 轮必须给出评估，并在 summary 中说明哪些地方仍不确定。
   ```

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/geminiPrompt.test.ts`：
  - `resolveMaxOutputTokens(undefined)` → `3000`；`'4000'` → `4000`；`'abc'` → `3000`；`'0'` → `3000`
  - `CONSULTATION_SYSTEM_PROMPT` 包含「目前信息还不够确定」和「最多 2 轮」，**不包含**「绝不允许连续两轮」
- 后端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：除了第 54 行那条规则和 334 行，提示词其他文字一字不动。实际回答效果**需实测**，可以用 `eval/answer-accuracy-test.md` 的 T01、T08 试

### [x] 第 2 步｜每一步花多少秒（只改后端）

**做法**：
1. 新建 `src/services/stageTimer.ts`：
   ```ts
   export function createStageTimer(now: () => number = () => performance.now()) {
     // mark(stage)：记录「距离上一次 mark」的毫秒数（四舍五入为整数）
     // result()：回传 { [stage]: ms, total: ms }
   }
   ```
2. `app.ts` 的 `handleChat`：开头建立 timer，依序 `mark`：
   - `prepare`：读取或建立对话之后（约第 420 行之后）
   - `emergencyCheck`：`checkEmergencyRisk` 之后
   - `route`：`routeMedicalData` 之后
   - `retrieve`：`getMedicalData` 之后（`direct_model` 没有这一段）
   - `generate`：`generateHealthAnswer` 之后
   - `safety`：安全检查之后
   - `save`：`appendTurn` 之后
   - 急症路径（`respondWithEmergency`）只记 `generate` 和 `save`
3. 每次回传成功结果前：
   - `console.log('[chat-timing]', JSON.stringify({ conversationId, route, ...timer.result() }))`，`route` 是路由名称，急症就写 `'emergency'`
   - 在回应的 `data` 里加上 `timings: timer.result()`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/stageTimer.test.ts`：注入假时钟（依次回传 0、120、450），`mark('a')`、`mark('b')` 后，`result()` 等于 `{ a: 120, b: 330, total: 450 }`
- 新增 `tests/timing.test.ts`（supertest + 假的路由、资料和 Gemini）：`POST /api/chat` 回应的 `data.timings` 有 `route`、`generate`、`total`，而且都是 ≥ 0 的数字
- 后端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：日志和 `timings` 里只有数字、对话 ID、路由名称，**没有用户的消息内容**

### [x] 第 3 步｜Waze 导航（只改前端）

**问题**：`map/MapPanel.tsx` 第 51 行的 `directionsUrl` 只有 Google Maps，但马来西亚很多人用 Waze

**做法**：
1. 新建 `src/map/links.ts`，把 `directionsUrl` 从 `MapPanel.tsx` 搬过来，并新增：
   ```ts
   export function wazeUrl(p: { latitude: number; longitude: number }) {
     return `https://waze.com/ul?ll=${p.latitude}%2C${p.longitude}&navigate=yes`
   }
   ```
2. `MapPanel.tsx` 改成从 `./links` import；在地点卡片（约第 473 行）和选中地点的详情（约第 538 行）的 Google Maps 按钮旁边，各加一个 Waze 按钮（`target="_blank" rel="noopener noreferrer"`，样式跟旁边的按钮一致）
3. `i18n.ts`：新增 `navigateWaze`（中文和英文都写「Waze」）

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/map/links.test.ts`：`wazeUrl({ latitude: 3.139, longitude: 101.6869 })` 等于 `'https://waze.com/ul?ll=3.139%2C101.6869&navigate=yes'`；`directionsUrl` 的结果和搬家前一样
- 前端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：【你做】用手机点一次 Waze 按钮，确认能打开 Waze 并开始导航

### [x] 第 4 步｜复制、分享回答（只改前端）

**做法**：
1. 新建 `src/chat/answerText.ts`：`formatAnswerAsText(answer: HealthAnswer, t: Translation): string`
   - 依序输出：摘要、可能原因、建议、什么时候要看医生、免责声明，区块标题沿用 `AssistantMessage.tsx` 现在用的 i18n 文字
   - 去掉 Markdown 的 `**`
   - `urgency === 'emergency'` 时，开头加上新的 `t.emergencyCallText`（「⚠️ 紧急情况请立即拨打 999」）
   - 最后一行加 `t.shareFooter`（「— 来自 Medora AI，仅供参考，不能替代医生诊断」）
2. `chat/AssistantMessage.tsx`：已经生成完毕的回答下方加一排操作按钮：
   - **复制**：`navigator.clipboard.writeText(text)`，成功后按钮文字显示「已复制」2 秒
   - **分享**：有 `navigator.share` 就用 `navigator.share({ text })`；没有就开新分页到 `https://wa.me/?text=${encodeURIComponent(text)}`
   - 欢迎消息和还在生成中的回答不显示这排按钮
3. `components/Icon.tsx`：没有 `copy`、`share` 图标就新增
4. `i18n.ts`：新增 `copyAnswer`、`copied`、`shareAnswer`、`shareFooter`、`emergencyCallText`（中文和英文）

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/chat/answerText.test.ts`：
  - summary 是「常见于 **感冒后咳嗽**」时，输出不含 `**`，并包含摘要、每一条建议和 `shareFooter`
  - `urgency: 'emergency'` 的输出第一行包含「999」
- 新增 `src/chat/answerActions.test.tsx`：模拟 `navigator.clipboard`，点「复制」后，`writeText` 收到的文字包含摘要
- 前端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：急症回答复制出来的文字一定有 999；【你做】用手机试一次分享到 WhatsApp

### [x] 第 5 步｜参考资料显示来源机构（两边都改，小）

**问题**：回答下方已经有参考资料清单（`AssistantMessage.tsx` 约第 177–190 行），但只显示文章标题，用户看不出来是 NHS 还是 MedlinePlus

**做法**：
1. 后端 `app.ts` 约第 572 行，`sources` 的 `.map` 改成 `({ title: item.title, url: item.url, provider: item.provider })`
2. 后端 `conversationRepository.ts`：`ConversationMessageRecord.sources` 和 `AppendTurnInput.sources` 的类型加上可选的 `provider?: string`（`sources` 存成 jsonb，**不用改 SQL**）
3. 前端 `services/chatService.ts`：`Source` 加 `provider?: string`
4. 前端 `AssistantMessage.tsx`：每个来源前面显示机构名称标签。对应表：`medlineplus` → MedlinePlus、`openfda` → OpenFDA、`rxnorm` → RxNorm、`kkmnow` → KKMNow、`nhs` → NHS、`icd11` → WHO ICD-11。旧消息没有 `provider` 的，就不显示标签

**允许修改的现有测试**：无

**完成标准**：
- 后端新增 `tests/sources.test.ts`：假资料的 provider 是 `'nhs'` 时，回应 `data.sources[0].provider === 'nhs'`
- 前端新增测试：`provider: 'nhs'` 的来源显示「NHS」；没有 provider 的来源照常显示，不出错
- 两边 `npm test` 全部通过

**验收重点**：旧对话（没有 provider 的来源）载入后显示正常

### [x] 第 6 步｜重新回答（两边都改）

**做法（后端）**：
1. `conversationRepository.ts`：接口新增 `popLastTurn(id: string, userId: string): Promise<{ userMessage: string } | null>`
   - 在一个 transaction 里删除最后两条消息（必须依次是 assistant 和它前面的 user），`message_count - 2`
   - 回传被删除的那句用户消息
   - 不属于此用户、没有完整的一轮，都回传 `null`
   - 对话状态（activeCategory 等）**不回滚**，这是已接受的取舍
   - 内存实现和 PG 实现都要做
2. `schemas/chat.ts`：`ChatRequest` 加可选的 `regenerate?: boolean`，验证必须是布尔值
3. `app.ts` 的 `handleChat`，在读取对话之后、调用 Gemini 之前：
   - `regenerate: true` 但没有 `conversationId` → `400 INVALID_CHAT_REQUEST`
   - 调用 `popLastTurn`，得到 `null` → `409 { code: 'NOTHING_TO_REGENERATE', message: '没有可以重新回答的内容。' }`
   - 成功：用**被删除的那句用户消息**当作这次的 message（忽略请求里的 message），重新取得 `getContextHistory`，接着走正常流程（包括急症检测）

**做法（前端）**：
1. `services/chatService.ts`：`ChatRequest` 加 `regenerate?: boolean`
2. `chat/ChatPanel.tsx`：`sendMessage` 加第三个参数 `options?: { regenerate?: boolean }`；新增 `regenerateLast()`：从画面上移除最后一条 AI 回答，再用最后一句用户消息调用 `sendMessage(message, false, { regenerate: true })`
3. `chat/AssistantMessage.tsx`：新增 prop `onRegenerate?: () => void`，有传才显示「重新回答」按钮（放在第 4 步那排按钮里）。`ChatPanel` 只传给**最后一条** AI 回答，正在生成时不传
4. 失败时沿用现有的错误和「重试」逻辑：重试是把那句话当普通消息重新发送
5. `i18n.ts`：新增 `regenerate`（「重新回答」/「Regenerate」）

**允许修改的现有测试**：无

**完成标准**：
- 后端新增 `tests/regenerate.test.ts`（内存实现 + 假的 Gemini）：
  - 先聊两轮，再 `regenerate` → Gemini 收到的 message 是第二轮的用户消息，history 只有第一轮；完成后 `GET /api/conversations/:id` 仍然是 4 条消息
  - 空对话 → `409 NOTHING_TO_REGENERATE`，Gemini **没被调用**
  - 别人的对话 → `404`
- 后端 `tests/conversationRepository.test.ts` **新增**（不改旧的）`popLastTurn` 的测试：正常删除、空对话回 `null`、别人的对话回 `null`
- 前端新增测试：只有最后一条回答有「重新回答」按钮；点了之后请求带有 `regenerate: true` 和 `conversationId`
- 两边 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：`popLastTurn` 的 PG 实现用了 transaction，而且 SQL 带 `user_id` 条件；检查在调用 Gemini 之前就完成

### [ ] 第 7 步｜删除账号（两边都改）

**做法（后端）**：
1. `auth/userRepository.ts`：接口新增 `deleteById(id: string): Promise<boolean>`。PG 实现：`delete from public.users where id = $1`。`conversations` 有 `on delete cascade`（`sql/001_conversations.sql` 第 8 行），对话会一起删除
2. `conversationRepository.ts`：接口新增 `deleteAllForUser(userId: string): Promise<number>`（内存和 PG 都要做，PG：`delete from public.conversations where user_id = $1`）
3. `app.ts`：把 `dependencies.userRepository ?? createPgUserRepository()` 提出来存成常量 `userRepository`，`/api/auth` 也改用它；新增 `app.delete('/api/account', requireAuth, ...)`：
   - body 没有 `password` → `400 { code: 'PASSWORD_REQUIRED' }`
   - 用 `userRepository.findByEmail(request.user.email)` 找到用户，找不到或 `id` 跟 `request.user.sub` 对不上 → `404`
   - 用 `auth/password.ts` 的 `verifyPassword` 验证，错误 → `401 { code: 'WRONG_PASSWORD' }`，并用 `LoginRateLimiter`（key：`delete:${userId}`）计算失败次数；超过限制 → `429`
   - 正确 → 先 `conversationRepository.deleteAllForUser(userId)`，再 `userRepository.deleteById(userId)` → `204`
4. 已知限制：已经发出的 token 在过期前仍然有效，但账号和对话都不在了，之后的请求会失败。前端删除后会立刻清除 token

**做法（前端）**：
1. `workspace/Sidebar.tsx`：账号区（约第 143–156 行）的「退出登录」下面加一个「删除账号」按钮，用 tokens 里的危险色
2. 新建 `src/workspace/DeleteAccountDialog.tsx`：
   - 说明「账号和所有对话会永久删除，无法恢复」
   - 密码输入框、取消和确认按钮；没输入密码时不能按确认
   - 用 `authFetch` 调用 `DELETE /api/account`，body 是 `{ password }`
   - `204` → 调用 `auth.ts` 的 `clearSession()`，回到首页
   - `401` 显示「密码不正确」；`429` 显示「尝试太多次，请稍后再试」
3. `i18n.ts`：新增对应文字（中文和英文）

**允许修改的现有测试**：无

**完成标准**：
- 后端新增 `tests/account.test.ts`（内存的 users 和 conversations）：
  - 密码正确 → `204`，用户和他的对话都不见了，**另一个用户的对话还在**
  - 密码错误 → `401`，什么都没删除
  - 没给密码 → `400`
- 前端新增测试：没输入密码时确认按钮停用；确认后调用 `DELETE /api/account`，然后回到首页
- 两边 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：PG 的 `delete` 一定带 `where id = $1`；密码错误时**绝对不能**删除任何东西

### [ ] 第 8 步｜就诊摘要（两边都改）

**做法（后端）**：
1. `geminiHealthConsultation.ts`：把 `fallbackModels` 和 `isRetriableModelError` 改成 `export`，供下面共用
2. 新建 `src/services/caseSummary.ts`：
   - 类型：
     ```ts
     export interface CaseSummary {
       chiefComplaint: string        // 主要问题
       symptoms: string[]            // 症状
       duration: string              // 持续多久
       medications: string[]         // 用过的药
       allergies: string[]           // 过敏
       relevantHistory: string[]     // 相关病史
       aiAssessment: string[]        // AI 曾给出的可能方向
       redFlags: string[]            // 需要注意的危险信号
       questionsForDoctor: string[]  // 可以问医生的问题
     }
     ```
   - `export function isCaseSummary(value: unknown): value is CaseSummary`
   - `export function createCaseSummarizer(options?: { apiKey?: string })`，回传 `summarizeCase({ messages, language, purpose }): Promise<CaseSummary>`
     - `messages: Array<{ role: 'user' | 'assistant'; content: string }>`
     - `language: 'zh' | 'en'`（第 11 步加 `'ms'`）
     - `purpose: 'visit' | 'memory'`
   - 用 `responseJsonSchema` 要求 Gemini 回传上面的结构；失败时依次换用 `fallbackModels`
   - 提示词重点：
     - 只整理**用户明确说过的内容**，没提到的就填空字符串或 `[]`，绝不推测
     - `aiAssessment` 只总结 AI 在对话里**说过的**可能方向
     - `purpose: 'visit'` 用指定语言写，给医生看，要简洁
3. `app.ts`：
   - 依赖新增 `summarizeCase?`（测试可以注入）
   - 新增 `POST /api/conversations/:id/visit-summary`（`requireAuth`），body 是 `{ language }`：
     - `get` 不到 → `404 CONVERSATION_NOT_FOUND`
     - `getMessages` 里没有用户消息 → `409 { code: 'NOTHING_TO_SUMMARIZE' }`
     - 先 `chatRateLimiter.consume(userId)`，超过限制 → `429`
     - 把全部消息的 `content` 交给 `summarizeCase`（`purpose: 'visit'`）→ `200 { summary, generatedAt }`
     - Gemini 失败 → `502 AI_MODEL_UNAVAILABLE`
   - **不存进数据库**

**做法（前端）**：
1. 新建 `src/services/visitSummaryService.ts`：`requestVisitSummary(conversationId, language)`
2. `chat/ChatToolbar.tsx`：加「就诊摘要」按钮，当前对话有至少 1 条用户消息时才能按
3. 新建 `src/chat/VisitSummaryDialog.tsx`：
   - 读取中显示载入状态
   - 依序显示各区块，空的区块不显示
   - 顶部提示「由 AI 根据对话整理，可能有遗漏或错误，就诊前请自行核对」，底部显示生成日期
   - 按钮：**打印**（`window.print()`，加打印用的 CSS，打印时只显示摘要内容）、**复制**（纯文字）
4. `i18n.ts`：新增对应文字（中文和英文）

**允许修改的现有测试**：无

**完成标准**：
- 后端新增 `tests/caseSummary.test.ts`：`isCaseSummary` 对缺少字段、类型错误的对象回传 `false`，对完整的对象回传 `true`
- 后端新增 `tests/visitSummary.test.ts`（假的 summarizer）：
  - 本人的对话 → `200`，回传 summary
  - 别人的对话 → `404`
  - 空对话 → `409 NOTHING_TO_SUMMARIZE`，summarizer **没被调用**
- 前端新增测试：点「就诊摘要」→ 调用对应接口 → 画面显示 `chiefComplaint` 的文字和 AI 提示
- 两边 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：提示词有「不得推测」的规定；摘要没有存进数据库；打印时只印出摘要；【你做】实际生成一次，看看内容是否忠于对话

### [ ] 第 9 步｜病情摘要记忆（只改后端，含 SQL）

**做法**：
1. 新增 `consultation-backend/sql/002_case_memory.sql`：
   ```sql
   alter table public.conversations
     add column if not exists case_summary jsonb,
     add column if not exists case_summary_upto integer not null default 0;
   ```
2. `conversationRepository.ts`：
   - `ConversationState` 加 `caseSummary: CaseSummary | null` 和 `caseSummaryUpto: number`，`get` 要读出来
   - 接口新增 `saveCaseSummary(id: string, summary: CaseSummary, upto: number): Promise<void>`（内存和 PG 都要做）
3. `app.ts`：新增函数 `maybeUpdateCaseMemory(conversationId, userId)`，在**回答送出之后**调用，不 `await`，错误只 `console.error`：
   - 重新 `get` 对话；只有 `messageCount > CONTEXT_HISTORY_LIMIT`，而且 `messageCount - caseSummaryUpto >= 10` 时才继续
   - `cutoff = messageCount - CONTEXT_HISTORY_LIMIT`；取 `getMessages` 的前 `cutoff` 条
   - `summarizeCase({ messages, language: 'en', purpose: 'memory' })`，然后 `saveCaseSummary(id, summary, cutoff)`
   - 用一个内存里的 `Set<string>` 防止同一个对话同时生成两次
4. `geminiHealthConsultation.ts`：
   - `HealthConsultationInput` 加 `caseMemory?: CaseSummary`
   - 把组合用户消息内容的逻辑（约第 324 行）抽成 export 的纯函数 `buildUserContent(input)`
   - 有 `caseMemory` 时，在 evidence 前面加上「[早前对话的病情摘要（超出最近 20 条的内容）]」区块，内容是把 CaseSummary 的非空字段列出来
5. `app.ts`：除了 `direct_model`，所有调用 `generateHealthAnswer` 的地方（包括急症）都传 `caseMemory: activeConversation?.caseSummary ?? undefined`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/caseMemory.test.ts`（内存实现 + 假的 summarizer + 假的 Gemini）：
  - 对话不到 20 条时，summarizer **没被调用**
  - 聊到 11 轮（22 条）后，summarizer 被调用 1 次，收到的是最早的 2 条消息
  - 下一轮调用 Gemini 时，输入带有 `caseMemory`
  - summarizer 出错时，聊天回应仍然是 `200`
- 新增 `buildUserContent` 测试：有 `caseMemory` 时包含病情摘要区块，没有时不包含
- 后端 `npm test` 全部通过，`npm run build` 没有错误
- 【你做】在 Supabase 的 SQL Editor 执行 `002_case_memory.sql`（**第 12 步部署之前一定要做**）

**验收重点**：摘要是在回答送出之后才生成的，不拖慢回答；超过 20 条后才会多调用 Gemini，而且每 10 条最多一次

### [ ] 第 10 步｜语音输入（只改前端）

**做法**：
1. 新建 `src/types/speech.d.ts`：声明最少需要的 `SpeechRecognition` 类型（不加新套件）
2. 新建 `src/chat/useSpeechInput.ts`（React hook）：
   - 检测 `window.SpeechRecognition ?? window.webkitSpeechRecognition`，回传 `{ supported, listening, start, stop, error }`
   - 语言对应：`{ zh: 'zh-CN', en: 'en-US' }`（第 11 步加 `ms: 'ms-MY'`）
   - `interimResults: true`；识别到的文字通过 callback 加进输入框
   - 结束或出错时把 `listening` 设回 `false`
3. `chat/ChatPanel.tsx`：输入框和发送按钮之间加麦克风按钮，**不支持的浏览器不显示**
   - 录音中有明显的状态（用 tokens 的颜色和动画）
   - 错误 `not-allowed` → 显示 `t.micPermissionDenied`；其他错误 → 显示 `t.micError`
   - 按钮附近显示小字 `t.micPrivacyNote`（「语音会由浏览器的语音服务处理」）
4. `i18n.ts`：新增 `micStart`、`micStop`、`micPermissionDenied`、`micError`、`micPrivacyNote`（中文和英文）

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/chat/speechInput.test.tsx`（模拟 `window.webkitSpeechRecognition`）：
  - 支持时显示麦克风按钮；不支持时不显示
  - 中文界面点按钮后，`lang` 是 `'zh-CN'`
  - 模拟识别结果后，文字出现在输入框
  - 模拟 `not-allowed` 错误后，显示权限提示
- 前端 `npm test` 全部通过，`npm run build` 没有错误
- 【你做】实测电脑 Chrome、Android Chrome、iPhone Safari 各一次（各浏览器的支持程度**需实测**）

**验收重点**：没有任何音频送到我们的后端；不支持的浏览器不会出现坏掉的按钮

### [ ] 第 11a 步｜马来语：后端

**做法**：
1. `schemas/chat.ts`：`ChatLanguage` 改成 `'zh' | 'en' | 'ms'`；第 151 行改成接受 `'ms'`，其他值仍然当作 `'zh'`
2. `geminiHealthConsultation.ts`：`language` 类型加上 `'ms'`；约第 296 行的 `languageRule` 新增 `ms` 分支，比照英文版的写法：
   - 全部字段只能用自然的 Bahasa Melayu
   - 急症开头：`"🚨 **Amaran Kecemasan Perubatan (nama keadaan)**: "`
   - 免责声明以 `"🛡️ Penafian:"` 开头
   - `medical_qa` 的结尾句也要翻成马来语
3. `safety/emergencyCheck.ts`：
   - `buildEmergencyStructuredAnswer`（第 345 行）新增马来语的固定模板
   - 新增 `export function emergencyActionText(language)`，回传三种语言的「立即拨打 999」文字，原本的 `EMERGENCY_ACTION_TEXT` 保留为中文版本
   - `app.ts` 用到 `EMERGENCY_ACTION_TEXT` 的地方（约第 476、648 行）改成 `emergencyActionText(language)`
4. `safety/outputSafetyCheck.ts`：`createSafeFallbackAnswer`（第 57 行）和免责声明（约第 194、223 行）新增马来语
5. `services/caseSummary.ts`：`language` 加上 `'ms'`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `tests/malay.test.ts`：
  - `validateChatRequest({ message: 'x', language: 'ms' })` 的 language 是 `'ms'`
  - `buildEmergencyStructuredAnswer(..., 'ms')` 的 summary 包含「999」，而且**没有中文字**（用 `/[一-鿿]/` 检查）
  - `createSafeFallbackAnswer('ms')` 没有中文字
  - `emergencyActionText('ms')` 包含「999」
- 原有测试全部通过（中文和英文的行为不变）；`npm run build` 没有错误
- 【你做】请会马来语的人看急症模板和免责声明

**验收重点**：中文和英文的输出完全不变；马来语的急症模板一定有 999

### [ ] 第 11b 步｜马来语：前端

**做法**：
1. `i18n.ts`：`Language` 改成 `'zh' | 'en' | 'ms'`；新增 `ms` 区块，**key 必须和 `zh` 完全一样**。用 TypeScript 强制检查，例如先把 zh 抽成常量 `const zh = {...}`，再写 `ms: { ... } satisfies typeof zh`
2. `landing/landingCopy.ts`：新增 `ms`
3. `components/LangToggle.tsx`：改成三个按钮：中文 / EN / BM
4. 把 `App.tsx`、`chat/ChatPanel.tsx`、`landing/LandingPage.tsx`、`map/MapPanel.tsx`、`services/chatService.ts` 里所有 `lang === 'zh' ? … : …` 的写死文字，改成 i18n 的 key。可以用这个指令找出来：`grep -rn "=== 'zh'" src --include=*.tsx --include=*.ts`
5. `services/chatService.ts`：`ChatRequest.language` 的类型改成 `Language`
6. `chat/useSpeechInput.ts`：语言对应加上 `ms: 'ms-MY'`
7. `App.tsx`：语言切换时设定 `document.documentElement.lang`（`zh-CN` / `en` / `ms`）；如果语言有存在 localStorage，读取时要接受 `'ms'`

**允许修改的现有测试**：无

**完成标准**：
- 新增 `src/i18n.test.tsx`：点「BM」后，欢迎标题变成 `translations.ms.welcomeTitle`；之后发出的聊天请求 `language` 是 `'ms'`
- `grep -rn "=== 'zh' ?" src --include=*.tsx --include=*.ts`（不含测试文件）找不到任何结果
- 前端 `npm test` 全部通过，`npm run build` 没有错误

**验收重点**：每个页面（首页、登录、问诊、地图、就诊摘要、删除账号）都切到 BM 看一次，没有残留的中文或英文；【你做】请会马来语的人看界面文字

### [ ] 第 12 步｜部署和线上验证

- **先**在 Supabase 执行 `sql/002_case_memory.sql`（第 9 步）
- 推送到 GitHub，等 Render 和 Vercel 部署完成（不需要新的环境变量；想调整回答长度上限，可以在 Render 设定 `GEMINI_MAX_OUTPUT_TOKENS`）
- **完成标准**（【你做】用手机试）：
  - [ ] 问一个模糊的问题，AI 会说不确定，并请你补充信息
  - [ ] 地图上的 Waze 按钮能打开 Waze
  - [ ] 回答可以复制、分享到 WhatsApp、重新回答
  - [ ] 参考资料显示机构名称
  - [ ] 就诊摘要可以生成和打印
  - [ ] 语音输入可以用（或在不支持的浏览器上不显示按钮）
  - [ ] 切到 BM，界面和回答都是马来语；急症回答有 999
  - [ ] 用一个**测试账号**删除账号，确认登不进去，另一个账号的对话不受影响
  - [ ] Render 日志里看得到 `[chat-timing]`

**验收重点**：这一步由你亲自验收

## 5. 当前进度和下一步

- **当前进度**：第 6 步已完成（后端 `conversationRepository.ts` 新增 `popLastTurn` 支持内存与 PG 事务实现带 `user_id` 鉴权、`schemas/chat.ts` 与 `app.ts` 支持 `regenerate: true`，在调用 Gemini 前校验并弹出末轮、复用原用户消息重新提问；前端 `AssistantMessage.tsx` 与 `ChatPanel.tsx` 支持仅最后一条 AI 回答展示「重新回答」按钮并在重试时保持已有用户消息。新增 `regenerate.test.ts`、`conversationRepository.test.ts` 补充测试、前端 `regenerate.test.tsx`，后端 68 个测试、前端 25 个测试全过、构建无报错）
- **下一步**：第 7 步（删除账号）

## 6. 分工

- **【你做】**
  - 第 9 步：在 Supabase 执行 `002_case_memory.sql`
  - 第 11 步：请会马来语的人看马来语文字
  - 第 3、4、8、10、12 步：用手机实测
- **【AI做】**：写代码、写测试、每完成一步更新本文件进度
- **【一起】**：第 7、8、10 步新界面的样式，看要不要调整

## 7. 关键假设和查证结果

- ✅ **已查证（2026-11-06，Waze 官方开发者文件）**：导航链接格式是 `https://waze.com/ul?ll=纬度,经度&navigate=yes`
- ✅ **已确认（代码）**：`conversations.user_id` 有 `on delete cascade`，删除用户会连带删除对话
- ✅ **已确认（代码）**：Google Maps 导航按钮和参考资料清单，新设计已经有了
- 浏览器语音识别：各浏览器的支持程度，以及马来语 `ms-MY` 的识别效果**需实测**；Chrome 的语音识别会把声音送到 Google 处理，具体做法**需要查证**
- 回答长度上限调到 3000 后，回答速度和额度消耗的变化**需实测**
- 病情摘要记忆和就诊摘要会多用 Gemini 额度，免费档够不够**需实测**
- 马来语由 AI 翻译，需要人工审核

## 8. 暂不做（以后再讨论）

- **健康指南（下一批）**：第一版只做知识卡片，大约 20 张，中英马三语，内容写在文件里，不做视频。等这一批完成后再规划
- 健康档案、上传照片、忘记密码、回答反馈 👍/👎、常见问题缓存、后台统计、换更强的模型、语音朗读回答、字体大小调节
- 回答准确度测试：题目在 `eval/answer-accuracy-test.md`

## 9. 【执行限制】

- 完成标准：<当前这一步在「4. 分步计划」里写的「完成标准」，例如第 3 步：「`wazeUrl({ latitude: 3.139, longitude: 101.6869 })` 等于 `'https://waze.com/ul?ll=3.139%2C101.6869&navigate=yes'`，前端 `npm test` 全部通过」>，达到立即停止，不顺手优化别的
- 范围：只看与问题直接相关的文件，不扫全项目，不用子代理
- 次数：最多「修改 → 验证」2 轮；同一错误出现 2 次直接停
- 禁止：为了通过而修改 / 删除 / 跳过测试，或降低验证标准
- 停止时汇报：做了什么、当前证据、卡在哪、建议下一步（由我决定是否继续）

> 补充：这一批每一步的「允许修改的现有测试」都是「无」。新的测试一律放在**新文件**，或在现有测试文件里**新增**测试，不准改动旧测试。

## 10. 新对话开场白（开发用）

> 先读 PLAN.md 和现有代码，用 3 句话复述项目和当前进度。
> 我确认后，只做第 N 步，按完成标准验证，并更新 PLAN.md 进度。
> 做完后停下来等验收，不要自己提交。

## 11. 【验收流程】

每一步做完都要验收，**不能由做的那个对话自己验收**。

- **流程**：开发对话做第 N 步 → 开一个**全新的**验收对话检查 → 用户看结论决定 → 通过就提交 → 下一步
- **不通过**：把验收员列出的问题贴回开发对话修，修完再开一个新的验收对话检查（修的次数算在执行限制的「最多 2 轮」里）
- **验收对话必须是全新的对话**，不能继承开发对话的记忆；能换模型就换成和开发不同的模型
- **每一步验收通过后马上提交**，下一步的改动才不会和上一步混在一起；**第 12 步之前不要推送**
- 有界面的步骤，用户要亲自打开页面看一眼；涉及线上的步骤，用户要亲自试一次

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
