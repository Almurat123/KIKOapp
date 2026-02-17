# Chat / Conversation 状态审计与重构指南

> **目的**：梳理 kiko-web 聊天相关全部状态，标出重复/冗余/风险，并给出**可直接执行的重构步骤**。  
> **受众**：前端同事，可按 Task 逐个 PR 落地。  
> **最后更新**：2026-02-17

---

## 1. 当前状态清单

### 1.1 全局（useConversations → ConversationContext）

| 状态 | 类型 | 文件 | 含义 |
|------|------|------|------|
| `conversations` | `Conversation[]` | `hooks/useConversations.ts` | 会话列表，每项含 messages, activeTask |
| `activeConversationId` | `string \| null` | 同上 | 当前选中的会话 |
| `isLoading` | `boolean` | 同上 | 正在加载会话列表 |
| `conversationsRef` | `Ref<Conversation[]>` | 同上 | 同步 ref，供 WS 回调读最新值 |

**每个 Conversation 上：**

| 字段 | 含义 |
|------|------|
| `messages` | 消息列表 |
| `activeTask` | `{ id, status } \| null` — 唯一的「此会话是否正在跑」标记 |

### 1.2 RootLayout (`layouts/RootLayout.tsx`)

| 状态 | 含义 | **问题** |
|------|------|----------|
| `generatingConversationId` | 正在生成回复的会话 ID | **冗余** — 可从 `conversations.find(c => c.activeTask)?.id` 派生 |

### 1.3 Layout (`components/Layout/Layout.tsx`)

| 状态 | 含义 | **问题** |
|------|------|----------|
| `chatStarted` | 是否已离开欢迎页 | **重复** — 与 ChatInterface 的 `hasStarted` 双写同步 |

### 1.4 ChatInterface (`components/Chat/ChatInterface.tsx`)

**派生状态（不存在 useState，从 context 计算）：**

| 名称 | 来源 | 含义 |
|------|------|------|
| `conversationId` | `params.conversationId \|\| activeConversationId` | 当前会话 ID |
| `isThinking` | activeTask + messages | 有任务但尚无内容 |
| `isStreaming` | activeTask + messages | 有任务且有内容流入 |
| `isBusy` | `isThinking \|\| isStreaming \|\| firstSendPending` | 是否禁止输入 |

**本地 useState：**

| 状态 | 含义 | **问题** |
|------|------|----------|
| `hasStarted` | 已离开欢迎页 | **重复** — 与 Layout `chatStarted` |
| `firstSendPending` | 欢迎页首条消息创建中 | OK |
| `isStopping` | 停止中（300ms） | OK |
| `isLoadingConversation` | 切换加载 | OK |
| `thinkingText` / `thinkingStartTime` | 思考提示 | OK |

**Refs：**

| Ref | 含义 | **问题** |
|-----|------|----------|
| `currentConversationIdRef` | 上一次 conversationId | 因 conversationId 双源需要 |
| `isSendingRef` | 发送中防误清 | OK |
| `messagesRef` | 同步 ref | OK |

---

## 2. 问题一览

| # | 类型 | 问题 | 风险等级 |
|---|------|------|----------|
| P1 | 多写 | `activeTask: null` 在 **10 处**写入（见下表） | **高** |
| P2 | 复杂 | 会话切换 effect（~896–985 行）有 ~7 个分支、2 次清 activeTask | **高** |
| P3 | 双源 | `conversationId` = params \|\| activeConversationId + ref | **高** |
| P4 | 重复 | `hasStarted` ↔ `chatStarted` 双写同步 | **中** |
| P5 | 冗余 | `generatingConversationId` 可从 activeTask 派生 | **中** |
| P6 | 派生 | `isThinking` / `isStreaming` 依赖 activeTask + message.status 两处 | **中** |

### activeTask 写入点索引

| 操作 | 位置 | 行为 |
|------|------|------|
| 设为非 null | RootLayout: `message_start` | `{ id: task-${messageId}, status: 'running' }` |
| 设为非 null | RootLayout: `task_status` (running/pending) | `{ id, status: 'running' }` |
| 设为非 null | ChatInterface: `handleSend` | `{ status: 'pending' }` |
| 设为非 null | ChatInterface: 会话切换 effect（目标有 streaming） | `{ status: 'streaming' }` |
| **清空** | RootLayout: `task_status` (done/completed) | `null` |
| **清空** | RootLayout: `message_complete`（pending 分支） | `null` |
| **清空** | RootLayout: `message_complete`（fallback 分支） | `null` |
| **清空** | RootLayout: `message_complete`（dedup 分支） | `null` |
| **清空** | ChatInterface: `client_action`（卡片展示） | `null` |
| **清空** | ChatInterface: `stopGeneration` | `null` |
| **清空** | ChatInterface: 会话切换 effect（2 处） | `null` |

---

## 3. 重构任务（按优先级，每个可独立 PR）

### Task 1：删除 `generatingConversationId`，改为派生

**优先级**：中 — 最简单的改动，先做热身  
**预计**：~30 min  
**涉及文件**：`RootLayout.tsx`, `Layout.tsx`, `Sidebar.tsx`

**步骤**：

1. **RootLayout.tsx**  
   - 删除 `const [generatingConversationId, setGeneratingConversationId] = useState(...)` (L46)  
   - 用 `useMemo` 派生：
     ```typescript
     const generatingConversationId = useMemo(
       () => conversations.find(c => c.activeTask != null)?.id ?? null,
       [conversations]
     );
     ```
   - 删除所有 `setGeneratingConversationId(...)` 调用（L174, L257, L272, L367）  
   - 从 `<Layout>` props 中删除 `setGeneratingConversationId={...}`

2. **Layout.tsx**  
   - 从 `LayoutProps` 删除 `setGeneratingConversationId` prop  
   - 从 `SidebarContextType` 删除 `setGeneratingConversationId`  
   - `sidebarContextValue` 中删除对应字段  
   - `generatingConversationId` 仍作为 prop 传给 Sidebar（只读），不变

3. **Sidebar.tsx**  
   - 无变化，已经只读使用 `generatingConversationId`

4. **ChatInterface.tsx**  
   - 删除 `sidebar?.setGeneratingConversationId(...)` 调用（L632-633, L1627-1628）

**验证**：Sidebar 在 AI 生成时仍高亮正确的会话；停止后高亮消失。

---

### Task 2：`hasStarted` / `chatStarted` 合并为单一来源

**优先级**：中  
**预计**：~45 min  
**涉及文件**：`ChatInterface.tsx`, `Layout.tsx`

**方案**：保留 Layout 的 `chatStarted`（通过 SidebarContext），ChatInterface 只写不读。

**步骤**：

1. **ChatInterface.tsx**  
   - 删除 `const [hasStarted, setHasStartedLocal] = useState(...)` (L219)  
   - 删除 `setHasStarted` wrapper 函数 (L222-226)  
   - 把所有 `hasStarted` 的**读取**替换为 `sidebar?.chatStarted ?? false`  
   - 把所有 `setHasStarted(value)` 替换为 `sidebar?.setChatStarted(value)`  
   - 注意：mount 时的初始化 `sidebar?.setChatStarted(initialMessages.length > 0 || !!conversationId || isLoading)` 仍需保留

2. **Layout.tsx**  
   - `chatStarted` 初始值改为 `false`，由 ChatInterface mount 时 set  
   - 无其他改动

**验证**：欢迎页 → 发消息 → back 按钮出现 → 点 back → 欢迎页恢复。直接打开 `/chat/:id` → back 按钮正确。

---

### Task 3：收口 `activeTask` 清空逻辑

**优先级**：**高** — 这是 bug 根源  
**预计**：~1.5 hr  
**涉及文件**：`RootLayout.tsx`, `ChatInterface.tsx`, 可选新建 `utils/taskLifecycle.ts`

**方案**：创建一个 helper 函数，所有"任务结束"语义都通过它，减少散落。

**步骤**：

1. **新建** `src/utils/taskLifecycle.ts`：
   ```typescript
   import type { Conversation } from '../hooks/useConversations';

   /**
    * 清空会话的 activeTask。
    * 所有"任务结束"语义（WS 事件、用户停止、卡片展示）都通过此函数。
    * 方便加日志、防重复、后续加 onTaskEnd 回调等。
    */
   export function clearActiveTask(
     conversationId: string,
     updateConversation: (id: string, updates: Partial<Conversation>) => void,
     reason: string
   ) {
     console.log(`[TaskLifecycle] clearActiveTask: ${conversationId} reason=${reason}`);
     updateConversation(conversationId, { activeTask: null });
   }
   ```

2. **RootLayout.tsx**  
   - import `clearActiveTask`  
   - 替换所有 `updateConversation(targetSessionId, { activeTask: null })` 为  
     `clearActiveTask(targetSessionId, updateConversation, 'message_complete')` 等，传入具体 reason  
   - 对 `message_complete` 带 messages 更新的情况：先 `updateConversation(..., { messages, activeTask: null })`，这一处保持原样（因为要原子更新 messages + task），但加注释说明

3. **ChatInterface.tsx**  
   - import `clearActiveTask`  
   - `stopGeneration` 中：`clearActiveTask(conversationId, updateConversation, 'user_stop')`  
   - `client_action`（卡片展示）中：`clearActiveTask(conversationId, updateConversation, 'card_displayed')`  
   - 会话切换 effect 中：`clearActiveTask(conversationId, updateConversation, 'conversation_switch')`（**只保留一处，删除第二次重复清空**）

**验证**：打开控制台，触发以下场景，确认每次只有 1 条 `[TaskLifecycle] clearActiveTask` 日志：
- 正常流式完成
- 用户点停止
- 卡片（swap）展示
- 切换会话

---

### Task 4：拆分会话切换 effect

**优先级**：高  
**预计**：~1 hr  
**涉及文件**：`ChatInterface.tsx` (~896–985 行)

**方案**：把单一大 effect 拆成命名函数，每个函数处理一个场景。

**步骤**：

1. 在 ChatInterface 内（effect 上方）定义三个函数：

   ```typescript
   /** 场景 A：正在发第一条消息，会话刚创建，URL 刚跳转 */
   const handleNewConversationNavigation = (newId: string) => {
     currentConversationIdRef.current = newId;
     setIsLoadingConversation(false);
     // isSendingRef 保护，不做任何 load/清空
   };

   /** 场景 B：用户点击侧边栏切换到已有会话 / 直接打开 URL */
   const handleConversationSwitch = (prevId: string | null, newId: string) => {
     setIsLoadingConversation(true);
     // 加载消息（如果本地没有）
     if (!currentConv?.messages?.length) {
       loadConversation(newId);
     }
     // 清 UI
     setThinkingText('Thinking');
     setFirstSendPending(false);
     setInput('');
     // 设 hasStarted
     sidebar?.setChatStarted(!!newId || isLoading);
     // 清 refs
     processedMessagesRef.current.clear();
     processedStrategyIdsRef.current.clear();
     currentConversationIdRef.current = newId;
     justSwitchedConversationRef.current = true;
     requestAnimationFrame(() => setIsLoadingConversation(false));
   };

   /** 场景 C：conversationId 没变，但 messages 有后台更新 */
   const handleBackgroundMessageSync = () => {
     // 现有 "Case 2" 逻辑搬到这里
   };
   ```

2. effect 主体简化为：
   ```typescript
   useEffect(() => {
     const prevId = currentConversationIdRef.current;
     const newId = conversationId;
     if (prevId === newId) {
       handleBackgroundMessageSync();
       return;
     }
     // ID changed
     if (isSendingRef.current) {
       handleNewConversationNavigation(newId!);
       return;
     }
     handleConversationSwitch(prevId, newId!);
   }, [conversationId, ...]);
   ```

3. 在 `handleConversationSwitch` 内，只调用**一次** `clearActiveTask`（Task 3 的函数）。

**验证**：
- 欢迎页发第一条 → 消息不消失，thinking 正常
- 侧边栏切换会话 → 加载正确，停止按钮不卡
- 直接打开 `/chat/:id` → 正确加载历史
- 后台流式更新 → 不中断

---

### Task 5（可选）：`conversationId` 单一来源

**优先级**：低 — 当前能工作，但长期技术债  
**预计**：~2 hr  
**涉及文件**：`ChatInterface.tsx`, `useConversations.ts`, 路由相关

**方案概述**：
- `conversationId` **只来自 URL** (`params.conversationId`)
- `activeConversationId` 只用于 Sidebar 高亮等非关键 UI
- 导航时只用 `navigate()`，不再依赖 `activeConversationId` 作为 fallback
- 删除 `currentConversationIdRef`，因为 `params` 变化必定触发 re-render

**注意**：这个改动范围大，建议在 Task 1-4 稳定后再做。

---

## 4. 状态流简图

```
[ 欢迎页 ]
  chatStarted=false, conversationId=null, activeTask=null
       │
       │  用户发第一条消息
       ▼
  setChatStarted(true), firstSendPending=true
  createConversation() → conversations 新增一项
  updateConversation(newId, { messages: [userMsg] })
  navigate(/chat/newId)
       │
       │  isSendingRef=true → 会话切换 effect 早退
       ▼
  sendMessage() → 后端创建 task
  WS: message_start → activeTask={ running }
       │
       │  流式 chunk → messages 内容增长
       │  isThinking → isStreaming（有内容后）
       ▼
  WS: message_complete → clearActiveTask(reason='message_complete')
  isBusy=false，输入框恢复

[ 用户点停止 ]
  stopGeneration() → clearActiveTask(reason='user_stop')
  chatApi.stopTask(activeTaskId)

[ 切换会话 ]
  handleConversationSwitch(prevId, newId)
  → clearActiveTask(prevId, reason='conversation_switch')（如果 prevId 有 task）
  → loadConversation(newId)（如果本地没消息）
```

---

## 5. 测试检查清单

每个 Task PR 合并前，手动验证以下场景：

- [ ] 欢迎页发第一条 → 消息立即显示，thinking 出现，回复正常
- [ ] 发消息后切 tab 再回来 → 消息没有消失
- [ ] 流式回复中点停止 → 停止按钮消失，可发新消息
- [ ] 流式回复中切换到另一个会话 → 前会话后台继续，新会话正确显示
- [ ] 直接打开 `/chat/:id` → 历史消息加载，无欢迎页闪烁
- [ ] Swap 卡片展示 → thinking 消失，卡片正常
- [ ] 侧边栏：AI 生成时正确高亮该会话，生成完后高亮消失
- [ ] Back 按钮：有会话时显示，回到欢迎页后消失
