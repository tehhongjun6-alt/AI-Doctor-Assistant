# PLAN.md — AI Doctor Assistant 升级计划

> 规划日期：2026-11-05｜状态：执行中（第 1 步已完成）
> 执行者须知：每一步都写明了「改哪些文件、怎么做、完成标准」。**设计已经定好，照着做，不要自行改设计。** 如果发现计划和代码对不上，停下来汇报，不要自己发挥。

## 1. 项目是什么

- **目标**：在现有基础上提升回答质量和安全性，加入「多对话」功能，并让地图按病情推荐就医地点
- **用户**：马来西亚用户（中文 / 英文，部分用户会用马来语），用手机或电脑网页使用
- **项目阶段**：**C（已经做完，要升级）**｜**规模**：中型（产品原型）
- **现有架构**
  - 前端：React 19 + Vite + MapLibre，部署在 Vercel（`consultation-frontend/`）
  - 后端：Express 5 + TypeScript + Gemini（`@google/genai`），部署在 Render（`consultation-backend/`）
  - 数据库：Supabase Postgres，通过 `pg` 连接（`src/auth/userRepository.ts` 是现有写法的范例），目前只存账号
  - 问诊流程（`src/app.ts` 的 `handleChat`）：急症检测 → 路由（`routing/medicalDataRouter.ts`：规则有把握就直接用，否则交给 Gemini，Gemini 失败时退回规则）→ 查医学资料 → Gemini 生成固定格式的回答 → 输出安全检查
  - 对话记忆：现在存在**后端内存**（`services/conversationStore.ts`，30 分钟过期）和**前端 sessionStorage**（`ChatPanel.tsx`），重启或关闭标签页就没了
- **测试命令**：后端 `cd consultation-backend && npm test`；前端 `cd consultation-frontend && npm test`

## 2. 已定决策

| 决策 | 选择 | 为什么 |
|---|---|---|
| 机制 | 保持现有流水线（规则路由 + RAG + 一次 Gemini 结构化输出） | 问诊流程固定，不需要 ReAct；改成多 Agent 会更慢、更耗额度 |
| 框架 | 沿用 Express + React + Supabase Postgres（`pg`） | C 阶段优先沿用；不加新依赖 |
| 对话存储 | Supabase Postgres 的两张新表 | 和账号放在同一个数据库 |
| AI 记忆 | 每个对话独立；发给 Gemini 的是该对话最近 20 条，加上话题、紧急状态、上一轮资料和搜索词 | 全部消息都保存，但只把最近 20 条交给 AI。病情摘要以后再做 |
| 对话从哪来 | **以服务器为准**：不再使用前端传来的 `history`；对话 ID 由服务器生成 | 防止前端伪造聊天记录，也避免两边记录不一致 |
| 什么时候建对话 | **发出第一条消息时才建**（不提供「建空对话」接口） | 不会出现占位置的空对话 |
| 自动删除 | 打开对话列表或发消息时，顺便删除**所有用户**的过期对话（每小时最多执行一次） | Render 免费档会休眠，不能依赖定时任务 |
| 地图 | 沿用 Geoapify，加入诊所和药房分类 | 分类名已查证（见第 7 节） |

### 多对话规则（已和用户确认）

- 每个用户**最多 3 个对话**；满了显示「已满」，用户要**自己删掉一个**才能新建
- 标题 = 第一条用户消息的**前 15 个字**，超过就加「…」（不调用 AI）
- 每个对话**最多 100 条消息**（用户和 AI 的消息合计，即 50 轮来回），满了提示开新对话
- 对话**超过 30 天没有新消息就自动删除**（以最后一条消息的时间计算）
- 每个对话的记忆各自独立

## 3. 护栏与不可改动的部分

### 护栏（必须做到）

- 原有的继续保留：急症拦截、输出安全检查、不正式确诊、按用户限流
- 新增：
  - 急症检测能认出马来语描述
  - 英文回答也会经过安全检查
  - 只有本人能列出、读取、续写、删除自己的对话。别人的对话一律回 **404**，不透露它存不存在
  - 删除对话时，数据库里的对话和消息**真的删掉**（用 `on delete cascade`）
  - 新表**开启 RLS**（Row Level Security），防止别人通过 Supabase 的公开接口读取表格
  - 页面上说明「对话会保存在你的账号，30 天没有新消息会自动删除」
  - 马来语急症关键词要请会马来语的人看一遍
  - 所有新增的界面文字都要有中文和英文两个版本（`i18n.ts`）

### 不可改动（除非用户明确同意）

- 部署平台（Render / Vercel / Supabase），Render 的 `DATABASE_URL` 继续用 Supabase **Session pooler**
- 现有的 `public.users` 表结构和登录方式
- 现有的急症规则：**只能新增，不能删改**
- Gemini 模型和思考程度
- 接口路径 `/api/chat`、`/api/chat/stream`、`/api/hospitals/nearby`：可以加字段；行为只能按本计划写明的方式改
- 本地开发端口：后端 8002（8000 已被另一个项目占用）

## 4. 分步计划

### [x] 第 1 步｜A1：追问那一轮的资料搜索（只改后端）

**问题**：用户回答追问时（如「三天了，38 度」），在两种情况下会把**中文原句**拿去搜英文医学数据库：(a) Gemini 路由失败，退回规则；(b) Gemini 没提取出英文词。

**已实现**（2026-11-05，后端 24 个测试全部通过）：
- 会话新增 `lastSearchQueries`（`conversationStore.ts`），每轮保存搜索词
- 路由上下文新增 `previousSearchQueries`（`medicalDataRouter.ts` 的 `MedicalDataRouteContext`、`heuristicRouter.ts` 的 `HeuristicRouteContext`）
- 情况 (a) 和 (b) 都优先沿用 `previousSearchQueries`；规则路由没有时，再从 `topicMessages` 里找上一句的医学词；都没有才用原句
- **第 4b 步要沿用这两个名称**：数据库和会话状态用 `lastSearchQueries`，路由上下文用 `previousSearchQueries`

### [x] 第 2 步｜A3：安全检查补英文规则（只改后端）

**做法**：在 `safety/outputSafetyCheck.ts` 的 `UNSAFE_MEDICAL_PATTERNS` 里**新增**英文规则，覆盖三种说法：
- 越权确诊：如 "I diagnose you with"、"you definitely have"
- 保证治好：如 "guaranteed to cure"、"100% cure"
- 劝人别就医：如 "no need to see a doctor"、"you don't need to go to the hospital"

**完成标准**
- 新增测试：上面每种说法至少 1 个例子会被拦下
- 新增测试：正常的英文回答（如 "Please see a doctor if symptoms persist"）**不会**被误拦
- `npm test` 全部通过

### [x] 第 3 步｜A13：急症检测加马来语（只改后端）

**做法**：在 `safety/emergencyCheck.ts` 现有的规则里，**新增**马来语关键词，类别沿用现有的。至少覆盖：
- 胸痛：`sakit dada`
- 呼吸困难：`tak boleh bernafas`、`sesak nafas teruk`
- 自伤：`bunuh diri`、`nak mati`
- 中风：`mulut senget`、`cakap pelat tiba-tiba`
- 抽搐：`sawan`
- 中毒或过量：`telan banyak ubat`、`minum racun`
- 大出血：`darah tak berhenti`
- 昏迷：`pengsan`、`tak sedar diri`

**完成标准**
- 新增测试：上面每一类至少 1 句马来语会判定为急症，而且类别正确
- 原有的急症测试全部通过（不准改原有规则）
- `npm test` 全部通过
- 【你做】请会马来语的人看一遍关键词（可以在第 7 步之前完成）

**验收重点**：`git diff` 里 `emergencyCheck.ts` 只有新增的行，原有的规则一行都没删改；马来语关键词不会误拦普通句子（例如只说「sakit kepala」头痛，不应判定为急症）

### [x] 第 4a 步｜多对话：建表 SQL

**做法**：新增 `consultation-backend/sql/001_conversations.sql`，内容如下。`user_id` 的类型必须和 `public.users.id` 一致；下面假设是 `uuid`，执行前先在 Supabase 确认。

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  active_category text,
  active_emergency jsonb,
  topic_messages jsonb not null default '[]'::jsonb,
  last_evidence jsonb not null default '[]'::jsonb,
  last_search_queries jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);
create index conversations_updated_idx on public.conversations (updated_at);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,            -- 给 AI 看的纯文字（AI 回答用 formatAnswerForHistory 转换）
  answer jsonb,                     -- AI 的完整结构化回答，前端还原显示用
  sources jsonb,                    -- 参考资料列表
  is_emergency boolean not null default false,
  map_care_level text check (map_care_level in ('hospital', 'clinic')),  -- 第 6 步使用
  use_for_context boolean not null default true,  -- false = 安全检查没通过的兜底回答，不交给 AI
  created_at timestamptz not null default now()
);
create index conversation_messages_conv_created_idx on public.conversation_messages (conversation_id, created_at);

-- 后端用 postgres 身份连接，不受 RLS 影响；开启 RLS 是为了挡住 Supabase 公开接口的访问
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
```

**完成标准**
- SQL 文件已建立
- 【你做】在 Supabase 的 SQL Editor 执行成功；Table Editor 里能看到两张表，并标示 RLS 已开启

**验收重点**：SQL 要和上面的内容一致（两张表都开启 RLS、都有 `on delete cascade`）；`user_id` 的类型要和 `public.users.id` 一致；这一步只新增 SQL 文件，不能改任何代码

### [x] 第 4b 步｜多对话：存取数据的代码（只改后端）

**做法**
1. 新建 `src/services/conversationRepository.ts`，定义接口（全部 async）：
   - `listByUser(userId)`：返回 `[{ id, title, messageCount, createdAt, updatedAt }]`，按 `updatedAt` 从新到旧，不含过期的
   - `get(id, userId)`：返回对话状态（标题、activeCategory、activeEmergency、topicMessages、lastEvidence、lastSearchQueries、messageCount、updatedAt）；不存在、不属于此用户、已过期，都返回 `null`
   - `createIfUnderLimit(userId, title)`：用户的有效对话少于 3 个才建立，否则返回 `null`。用一条 SQL 完成：`insert ... select ... where (select count(*) ...) < 3`
   - `getContextHistory(id, limit = 20)`：返回最近 20 条 `use_for_context = true` 的消息，格式是 `{ role, content }`，按时间从旧到新
   - `getMessages(id, userId)`：返回全部消息（含 answer、sources、isEmergency、mapCareLevel、createdAt），供前端显示；不属于此用户就返回 `null`
   - `appendTurn({...})`：在**一个 transaction** 里写入用户消息和 AI 消息，`message_count + 2`，更新 `updated_at` 和状态字段
   - `delete(id, userId)`：删除成功返回 `true`；不属于此用户就返回 `false`
   - `deleteExpired()`：删除所有 `updated_at` 早于 30 天前的对话
2. 两种实现：
   - `createMemoryConversationRepository()`：存在内存，给测试用，也给没有 `DATABASE_URL` 的本地开发用
   - `createPgConversationRepository()`：仿照 `userRepository.ts` 的写法
3. 把 `conversationStore.ts` 里 `saveTurn` 计算新状态的逻辑（activeCategory、topicMessages、lastEvidence、activeEmergency、lastSearchQueries）抽成纯函数 `nextConversationState(existing, turn)`，两种实现都用它。`formatAnswerForHistory` 保留
4. 常量：`MAX_CONVERSATIONS_PER_USER = 3`、`MAX_MESSAGES_PER_CONVERSATION = 100`、`CONVERSATION_TTL_DAYS = 30`、`CONTEXT_HISTORY_LIMIT = 20`

**完成标准**：新增 `tests/conversationRepository.test.ts`，用内存实现验证：
- 第 4 个对话 `createIfUnderLimit` 返回 `null`；删掉一个后可以再建
- `getContextHistory` 只回最近 20 条，并跳过 `use_for_context = false` 的消息
- 过期对话：`listByUser` 和 `get` 都看不到，`deleteExpired` 会删掉（测试里用可注入的「现在时间」模拟）
- 用户 B 对用户 A 的对话执行 `get`、`getMessages`、`delete`，分别得到 `null`、`null`、`false`
- `nextConversationState` 的结果和原来 `saveTurn` 一致
- `npm test` 全部通过，`npm run build` 没有类型错误
- PG 实现不在单元测试里连真实数据库，留到第 7 步线上验证

**验收重点**：这一步还**不能**改 `app.ts` 的接口行为（那是 4c 的事），原有测试必须全部不动就通过；PG 实现的每条 SQL 都要带 `user_id` 条件，防止读到别人的对话；`appendTurn` 真的用了 transaction

### [x] 第 4c 步｜多对话：接口（只改后端）

**已实现**（2026-11-05，后端 51 个测试全部通过）：
- 新增会话管理 REST 接口：`GET /api/conversations`（获取对话列表，上限 3 个，每小时节流清理过期对话）、`GET /api/conversations/:id`（获取对话详情与全部历史消息，跨用户或过期返回 404）、`DELETE /api/conversations/:id`（删除对话，跨用户返回 404，成功返回 204）。
- 对话上限与额度保护：在调用 Gemini 模型之前完成拦截，满 3 个新对话返回 409 `CONVERSATION_LIMIT_REACHED`，达到 100 条消息返回 409 `CONVERSATION_FULL`，不浪费模型额度。
- 历史上下文由后端安全接管（忽略客户端 `history` 传参，由 `getContextHistory` 供给），各轮次（含急症与兜底）统一通过 `appendTurn` 写入存储库。
- 彻底移除旧的 `ConversationStore` 类，并将 `createApp` 依赖完整切换为 `conversationRepository`。

**做法**
1. `createApp` 的依赖：`conversationStore` 改成 `conversationRepository`。没有注入时，有 `DATABASE_URL` 就用 PG 实现，否则用内存实现并 `console.warn` 一次
2. 新接口（全部 `requireAuth`）：
   - `GET /api/conversations` → `200 { conversations: [...], limit: 3 }`
   - `GET /api/conversations/:id` → `200 { conversation: { id, title, messageCount }, messages: [...] }`；不是本人的就回 `404 { error: { code: 'CONVERSATION_NOT_FOUND' } }`
   - `DELETE /api/conversations/:id` → `204`；不是本人的就回 `404`
3. `POST /api/chat` 和 `/api/chat/stream` 的改动：
   - **没给 `conversationId`**：用 `createIfUnderLimit` 建新对话（标题取消息前 15 个字）。满 3 个就回 `409 { error: { code: 'CONVERSATION_LIMIT_REACHED', message: '对话已满（最多 3 个），请先删除一个。' } }`
   - **给了 `conversationId`**：用 `get` 读取，不是本人的或已过期就回 `404 CONVERSATION_NOT_FOUND`。`messageCount >= 100` 就回 `409 { error: { code: 'CONVERSATION_FULL', message: '这个对话已满 100 条，请开新对话。' } }`
   - 上面这些检查都要在**调用 Gemini 之前**做，不浪费额度
   - 给 AI 的历史改用 `getContextHistory`，**忽略请求里的 `history` 字段**（字段仍可接收，避免旧前端出错）
   - 路由上下文继续传 `previousSearchQueries: conversation.lastSearchQueries`（第 1 步的功能不能丢）
   - 每一轮（包括急症回答和兜底回答）都要 `appendTurn`；兜底回答的 `use_for_context = false`
   - 回应里继续返回 `conversationId`
   - `GET /api/conversations` 和发消息时调用 `deleteExpired()`，用内存时间戳限制**每小时最多执行一次**
4. 删除旧的 `ConversationStore` 类（第 4b 步已经把逻辑抽出来）

**⚠️ 允许修改的现有测试（行为有意改变，已经用户同意）**：`tests/app.test.ts` 里这两个：
- `returns the structured answer from the model service`：改成不带 `conversationId`，并断言 `conversationId` 是服务器生成的；断言 `history` 来自服务器而不是请求。回答结构的断言要保留
- `does not let one user continue another user's conversation`：改成断言 intruder 拿到 **404**，而且 Gemini 没被调用。「看不到别人对话」的意图要保留

除了这两个，**其他现有测试一律不准改**。

**完成标准**：新增 `tests/conversations.test.ts`（supertest + 内存实现 + 假的 Gemini），验证：
- 不带 ID 发消息会建立对话，`GET /api/conversations` 能看到，标题是前 15 个字
- 第 4 个新对话回 409 `CONVERSATION_LIMIT_REACHED`，而且 Gemini **没被调用**
- 第 101 条回 409 `CONVERSATION_FULL`，而且 Gemini 没被调用
- 第二轮发给 Gemini 的 `history` 包含第一轮的内容
- 读、续写、删除别人的对话都回 404
- 删除后再 `GET` 回 404
- `npm test` 全部通过，`npm run build` 没有类型错误

**验收重点**：`app.test.ts` 只改了允许的那 2 个测试，而且原本的意图还在；409 和 404 的检查确实在调用 Gemini **之前**；第 1 步的 `previousSearchQueries` 还有传进路由；`/api/chat/stream` 也套用了同样的检查

### [x] 第 5 步｜多对话：前端

**已实现**（2026-11-05，前端 13 个测试、后端 51 个测试全部通过）：
- 新建 `src/ConversationList.tsx` 组件并在电脑端 Aside 与手机端底部弹出抽屉分别呈现，包含标题、最后更新时间、数量计数、30 天自动清理提示。
- 「新对话」按钮支持根据 3 个上限自动禁用并显示「已满 3/3」；支持 `window.confirm` 二次确认后调用 `DELETE /api/conversations/:id` 并同步更新列表与激活态。
- 改造 `App.tsx` 与 `ChatPanel.tsx`：彻底移除 `sessionStorage` 与客户端 `history` 传送；根据 `conversationId` 调用 `GET /api/conversations/:id` 还原历史对话与结构化回答；错误码（409 上限、409 满 100 条、404 过期/不存在）友好提示。
- `src/i18n.ts` 补充完整多对话中英双语文字。

**做法**
1. 新建 `src/ConversationList.tsx`：对话列表（标题 + 最后更新时间）、「新对话」按钮、每个对话的删除按钮、保存说明文字
2. 放在哪：
   - 电脑版：左侧 `aside` 里，`feature-nav-list` 的上面
   - 手机版：底部弹出菜单（`mobile-bottom-sheet`）里
3. `App.tsx`：管理 `conversations` 列表和 `activeConversationId`；登录后调用 `GET /api/conversations`；`ChatPanel` 的 `key` 改成 `activeConversationId ?? 'new'`，这样切换对话时会重新载入
4. `ChatPanel.tsx`：
   - **移除** sessionStorage 的保存和读取，以及 `storageKey` prop
   - 新增 props：`conversationId?`、`onConversationChanged()`（建立、更新后通知 App 重新拉列表）
   - 有 `conversationId` 时，用 `GET /api/conversations/:id` 载入消息并还原显示（`answer` 用原来的方式渲染）
   - 发消息时**不再送 `history`**
   - 处理错误码：
     - `CONVERSATION_LIMIT_REACHED`：显示「已满」提示
     - `CONVERSATION_FULL`：提示开新对话
     - `CONVERSATION_NOT_FOUND`：通知 App 刷新列表，并切回新对话
5. 「新对话」按钮：满 3 个时停用，文字显示「已满 3/3」
6. 删除：先用 `window.confirm` 确认，再调用 `DELETE`；删的是当前对话就切回新对话
7. `i18n.ts`：新增文字（中文和英文），包括新对话、已满、删除确认、保存说明、100 条已满、对话不存在

**允许修改的现有测试**：`src/App.test.tsx` 里用到 `sessionStorage` 的部分，改成模拟 `/api/conversations` 接口。其他测试的意图要保留。

**完成标准**
- 前端测试新增：
  - 显示对话列表
  - 满 3 个时「新对话」按钮停用并显示「已满」
  - 确认后会调用 `DELETE`
  - 点选对话会调用 `GET /api/conversations/:id`
  - 发消息的请求里没有 `history`
- `npm test` 全部通过，`npm run build` 没有类型错误
- 本地打开页面：刷新后对话还在；能看到保存说明

**验收重点**：`App.test.tsx` 只改了 sessionStorage 相关的部分；所有新文字都有中文和英文；【你做】手机版和电脑版各打开一次，看对话列表的位置和「已满」显示

### [ ] 第 6 步｜A12：地图按病情推荐（两边都改）

**做法**
1. 后端 `services/geoapifyPlaces.ts`：
   - `NearbySearchInput` 加 `careLevel: 'hospital' | 'clinic'`
   - `hospital` 用 `categories=healthcare.hospital`；`clinic` 用 `categories=healthcare.clinic_or_praxis,healthcare.pharmacy`
   - 结果加 `type: 'hospital' | 'clinic' | 'pharmacy'`，依 `properties.categories` 判断；名称缺失时按类型给默认名
2. 后端 `app.ts`：
   - `/api/hospitals/nearby` 接收 `careLevel`；不传时默认 `'hospital'`，保持兼容；值不合法就回 400
   - 聊天回应新增 `mapCareLevel`：
     - 紧急程度 `high` 或 `emergency` → `'hospital'`
     - 路由是 `medical_api`，而且紧急程度是 `low` 或 `medium` → `'clinic'`
     - 其他情况 → `null`
   - `mapCareLevel` 同时存进 `conversation_messages.map_care_level`
3. 前端：
   - `ChatPanel` 的 `onOpenMap` 改成 `onOpenMap(careLevel)`；有 `mapCareLevel` 的回答才显示按钮。`hospital` 显示「查看附近医院」，`clinic` 显示「查看附近诊所和药房」。取代原本只看 `urgency` 的判断
   - `App.tsx` 保存 `mapCareLevel` 状态，从左侧选单直接打开地图时用 `'hospital'`
   - `MapPanel` 新增 prop `careLevel`，变化时重新查询；标题和标记按类型显示
   - `i18n.ts` 新增对应文字（中文和英文）

**完成标准**
- 后端新增测试：
  - 用假的 `fetch` 确认 `clinic` 时 `categories` 参数是 `healthcare.clinic_or_praxis,healthcare.pharmacy`
  - `careLevel` 不合法时回 400
  - `medical_api` + `low` 的聊天回应 `mapCareLevel` 是 `'clinic'`
- 前端新增测试：`mapCareLevel: 'clinic'` 的回答显示「查看附近诊所和药房」
- 两边 `npm test` 全部通过

**验收重点**：不传 `careLevel` 时仍然只搜医院（旧行为不变）；打招呼或科普回答**不会**出现地图按钮；【你做】打开页面，确认轻症显示诊所和药房、急症显示医院

### [ ] 第 7 步｜部署和线上验证

- 先确认第 4a 步的 SQL 已在 Supabase 执行
- 部署后端到 Render、前端到 Vercel（不需要新的环境变量）
- **完成标准**（【你做】用手机试一次）：
  - 线上能新建对话，刷新后还在，能删除
  - 满 3 个时显示「已满」
  - 轻症回答能打开「附近诊所和药房」，急症能打开「附近医院」
  - Supabase Table Editor 里能看到新数据

**验收重点**：这一步由你亲自验收；用两个不同账号试一次，确认 A 看不到 B 的对话

## 5. 当前进度和下一步

- **当前进度**：第 5 步已完成（多对话前端组件 ConversationList、ChatPanel 切换/加载历史、i18n 中英双语、13 个前端测试与 51 个后端测试全过）
- **下一步**：第 6 步（A12：地图按病情推荐）

## 6. 分工

- **【你做】**
  - 第 4a 步：确认 `users.id` 的类型，并执行建表 SQL
  - 第 3 步：请会马来语的人看急症关键词
  - 第 7 步：部署后用手机试一次
- **【AI做】**：写代码、写测试、每完成一步更新本文件进度
- **【一起】**：第 5 步完成后，看界面样式要不要调整

## 7. 关键假设和查证结果

- ✅ **已查证（2026-11-05，Geoapify Places 官方文档）**：分类名 `healthcare.hospital`、`healthcare.clinic_or_praxis`、`healthcare.pharmacy` 都存在
- Supabase 免费档 500 MB 够用：按每人最多 3 个对话 × 100 条、约 1.5 MB 估算，**需实测**
- Supabase 免费项目闲置太久可能会被暂停，具体规则**需要查证**
- 假设 `public.users.id` 是 `uuid`（第 4a 步前确认）
- 自动删除只在有人使用时才会执行；完全没人用的时候不会清理（可以接受）
- 马来语关键词由 AI 先写，需要有人看一遍

## 8. 暂不做（以后再讨论）

- A2 调高回答长度上限｜A4 提示词放宽「必须下判断」｜A5 回答标注参考资料
- A6 换更强的模型（需实测）｜A8 整套马来语界面｜A9 医院筛选（公立/私立/急诊）
- A10 常见问题缓存｜A11 更新 README｜A15 忘记密码
- 病情摘要记忆（和「就诊摘要」功能一起做）
- 回答准确度测试：题目已经准备在 `eval/answer-accuracy-test.md`，暂时不跑

## 9. 【执行限制】

- 完成标准：<当前这一步在「4. 分步计划」里写的「完成标准」，例如第 2 步：「三种英文说法各至少 1 个例子会被拦下，正常英文回答不被误拦，`npm test` 全部通过」>，达到立即停止，不顺手优化别的
- 范围：只看与问题直接相关的文件，不扫全项目，不用子代理
- 次数：最多「修改 → 验证」2 轮；同一错误出现 2 次直接停
- 禁止：为了通过而修改 / 删除 / 跳过测试，或降低验证标准
- 停止时汇报：做了什么、当前证据、卡在哪、建议下一步（由我决定是否继续）

> 补充：第 4c 步和第 5 步写明「允许修改」的测试，是因为行为被有意改变，不算违反「禁止修改测试」。除此之外的测试一律不准改。

## 10. 新对话开场白（开发用）

> 先读 PLAN.md 和现有代码，用 3 句话复述项目和当前进度。
> 我确认后，只做第 N 步，按完成标准验证，并更新 PLAN.md 进度。
> 做完后停下来等验收，不要自己提交。

## 11. 【验收流程】

每一步做完都要验收，**不能由做的那个对话自己验收**。

- **流程**：开发对话做第 N 步 → 开一个**全新的**验收对话检查 → 用户看结论决定 → 通过就提交 → 下一步
- **不通过**：把验收员列出的问题贴回开发对话修，修完再开一个新的验收对话检查（修的次数算在执行限制的「最多 2 轮」里）
- **验收对话必须是全新的对话**，不能继承开发对话的记忆；能换模型就换成和开发不同的模型
- **每一步验收通过后马上提交**，下一步的改动才不会和上一步混在一起
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
