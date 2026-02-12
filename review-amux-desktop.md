# `amux-desktop` 工程级审查

> 审查范围：`apps/desktop`（含 `electron/*` 与 `src/*`）  
> 重点：状态管理、配置持久化、服务生命周期、日志与可观测性  
> 说明：以下建议均为增量优化，不涉及大规模重构，不引入额外依赖。

---

## A. 状态管理

### 1) 代理服务状态存在“双状态源”

- **现象**：`ChatCard` 自维护 `serviceStatus`，`Header` 又通过 `useProxyStore` 维护一套状态。
- **影响**：同一时刻页面不同区域可能显示不一致（如一个显示 running，另一个 still stopped）。
- **原因**：状态分散在组件本地 state 与全局 store，且刷新节奏不同（`Header` 5s 轮询）。
- **建议**：统一以 `useProxyStore` 为唯一状态源；`ChatCard` 只消费 store，不再维护本地 `serviceStatus`。
- **验证方式**：
  1. 手动快速执行 start/stop/restart，观察 Header 与 Chat 区状态是否始终一致。
  2. 增加组件测试：mock `proxy-service:status` 变化，断言两个区域读到同一状态。
- **代码位置**：`apps/desktop/src/components/chat/ChatCard.tsx:22`，`apps/desktop/src/components/layout/Header.tsx:25`

### 2) “停止生成”前后端语义不一致

- **现象**：前端 `stopStreaming` 已调用 IPC，但主进程 `chat:stop-streaming` 仍是 TODO。
- **影响**：用户点击停止后，UI 显示已停止，但后端请求实际继续跑，浪费 token 与资源。
- **原因**：缺少请求级 `AbortController` 管理与 conversation->controller 映射。
- **建议**：
  - 在 `chat:send-message` / `chat:regenerate` 为每个会话维护 `AbortController`。
  - `chat:stop-streaming` 触发对应 controller.abort()，并清理映射。
- **验证方式**：
  1. 发起长流式请求后立即点击停止。
  2. 断言主进程 fetch 被 abort，且不再收到新的 `chat:stream-content` 事件。
- **代码位置**：`apps/desktop/src/stores/chat-store.ts:203`，`apps/desktop/electron/ipc/chat.ts:499`

### 3) 自动启动服务行为未受 `proxy.autoStart` 控制

- **现象**：进入 Chat 页面时只要状态是 stopped 就自动拉起代理服务。
- **影响**：违背设置项语义，可能在用户不希望时占用端口与系统资源。
- **原因**：Chat 组件内硬编码自动启动逻辑，未读取设置仓库中的 `proxy.autoStart`。
- **建议**：把自动启动决策下沉到主进程启动期，且严格受 `proxy.autoStart` 控制；Chat 页面仅提示状态。
- **验证方式**：
  1. 设置 `proxy.autoStart=false` 后重启应用，应保持 stopped。
  2. 设置 `proxy.autoStart=true` 后重启应用，应自动 running。
- **代码位置**：`apps/desktop/src/components/chat/ChatCard.tsx:74`，`apps/desktop/src/pages/Settings.tsx:380`，`apps/desktop/electron/services/database/repositories/settings.ts:12`

### 4) 流式失败时临时消息回收不完整

- **现象**：发送消息时先插入 `temp-*` 用户消息，失败路径未统一清理或标记失败。
- **影响**：会出现“消息已发出但无响应”的脏状态，影响会话可理解性。
- **原因**：乐观更新存在，但缺少失败补偿机制（回滚或 failed 状态）。
- **建议**：为本地临时消息增加 `status`（pending/sent/failed），失败时可重试或回滚。
- **验证方式**：
  1. 模拟后端 `chat:send-message` 报错。
  2. 断言 UI 显示 failed 状态，且可点击重试，不再出现“无状态临时消息”。
- **代码位置**：`apps/desktop/src/stores/chat-store.ts:182`，`apps/desktop/src/stores/chat-store.ts:196`

---

## B. 配置持久化

### 5) Provider 更新后 Bridge 缓存可能陈旧

- **现象**：`provider:update` 后未触发 `invalidateProviderCache`。
- **影响**：API Key / BaseURL 已更新但请求仍命中旧 Bridge 实例，表现为“配置改了不生效”。
- **原因**：Bridge 缓存按 `proxyId:providerId` 命中，Provider 更新链路缺少缓存失效。
- **建议**：在 `provider:update` / `provider:delete` 后调用 `invalidateProviderCache(id)`。
- **验证方式**：
  1. 更新 provider 的 key/baseUrl。
  2. 紧接一次请求应命中新配置（无需重启服务）。
- **代码位置**：`apps/desktop/electron/ipc/providers.ts:95`，`apps/desktop/electron/services/proxy-server/bridge-manager.ts:319`

### 6) 设置导入绕过类型约束

- **现象**：配置导入对 setting key 使用 `as any` 写入。
- **影响**：异常键值可写入 settings 表，长期污染配置并引发隐蔽错误。
- **原因**：import 逻辑缺少 key 白名单与 value 类型校验。
- **建议**：
  - 基于 `SettingsSchema` 建立可导入 key 白名单。
  - 对 number/boolean/array 做最小运行时校验，不合法直接记录 `errors`。
- **验证方式**：
  1. 构造含非法 key 与错误类型的导入文件。
  2. 导入结果应部分失败并给出错误，数据库不落脏值。
- **代码位置**：`apps/desktop/electron/services/config/import.ts:176`，`apps/desktop/electron/ipc/settings.ts:19`

### 7) 主题/语言持久化存在“双写模型”不一致

- **现象**：UI 使用 zustand persist 存 `theme/locale`，数据库 settings 同时定义了 `appearance.theme/language`。
- **影响**：多来源配置易漂移，后续跨进程/导入导出时表现不一致。
- **原因**：前端本地持久化与主进程 DB 持久化未形成单一事实源。
- **建议**：统一以 settings 表为主；zustand 仅做缓存层，初始化与变更都经 IPC。
- **验证方式**：
  1. 切换主题/语言后重启应用，检查 UI 与 settings 表一致。
  2. 导出/导入后，主题/语言可正确恢复。
- **代码位置**：`apps/desktop/electron/services/database/repositories/settings.ts:25`，`apps/desktop/src/stores/settings-store.ts:66`，`apps/desktop/src/stores/i18n-store.ts:22`

---

## C. 服务生命周期

### 8) Tray / Auto-launch 模块已实现但主流程未接入

- **现象**：存在 `services/tray` 与 `services/auto-launch`，但 `main.ts` 未初始化。
- **影响**：相关设置（最小化到托盘、开机启动）用户可配置但实际可能不生效。
- **原因**：生命周期编排未把模块纳入 app bootstrap。
- **建议**：
  - 在 `app.whenReady()` 后按设置决定是否初始化 tray / auto-launch。
  - 在 `before-quit` 中补充对应资源销毁。
- **验证方式**：
  1. 打开/关闭 `app.minimizeToTray`、`app.launchAtStartup` 后重启验证行为。
  2. 观察进程退出是否干净（无悬挂托盘/定时器）。
- **代码位置**：`apps/desktop/electron/main.ts:128`，`apps/desktop/electron/services/tray/index.ts:15`，`apps/desktop/electron/services/auto-launch/index.ts:11`

### 9) `TokenManager` 周期任务未可控回收

- **现象**：`start()` 内 `setInterval` 未保存 timer 句柄，`stop()` 无法清理该周期任务。
- **影响**：重复初始化后会出现多路重复检查，带来额外网络请求与并发刷新风险。
- **原因**：仅清理了 `setTimeout` 刷新任务，未清理全局巡检 interval。
- **建议**：增加 `checkTimer` 字段保存 interval id，在 `stop()` 清理并置空。
- **验证方式**：
  1. 多次触发 OAuth manager initialize/cleanup。
  2. 断言同一小时周期内仅触发一次 `checkAllAccounts`。
- **代码位置**：`apps/desktop/electron/services/oauth/token-manager.ts:36`，`apps/desktop/electron/services/oauth/token-manager.ts:44`

### 10) 代理服务指标存在“实现分叉”

- **现象**：`proxy-server/index.ts` 内有一套 metrics，`services/metrics` 又有另一套；IPC 返回后者。
- **影响**：运维视图可能与服务内部统计不一致，定位性能问题时口径混乱。
- **原因**：历史演进未收敛，两个模块都在统计请求。
- **建议**：选定单一指标源（建议 `services/metrics`），另一套仅保留必要状态或移除。
- **验证方式**：
  1. 压测固定请求量。
  2. 校验 IPC `proxy-service:metrics`、日志统计、服务内部监控三者数值一致。
- **代码位置**：`apps/desktop/electron/ipc/proxy-service.ts:15`，`apps/desktop/electron/ipc/proxy-service.ts:86`，`apps/desktop/electron/services/proxy-server/index.ts:42`

---

## D. 日志与可观测性

### 11) Logger 名义“缓冲写入”，实际“每次立即 flush”

- **现象**：`logRequest` push 后立刻 `flush()`，几乎退化为同步逐条写库。
- **影响**：高频请求下主进程 IO 压力增加，影响吞吐与响应延迟。
- **原因**：缓冲策略与实现不一致（timer/阈值存在但未生效）。
- **建议**：
  - 恢复真正缓冲策略：仅在 `MAX_BUFFER_SIZE` 或 `FLUSH_INTERVAL` 触发 flush。
  - 保留 `forceFlush` 用于退出前与手工触发。
- **验证方式**：
  1. 压测 1k 请求，比较优化前后主进程 CPU 与平均延迟。
  2. 验证异常退出前通过 `shutdownLogger` 不丢日志。
- **代码位置**：`apps/desktop/electron/services/logger/index.ts:93`，`apps/desktop/electron/services/logger/index.ts:126`

### 12) Logger 调试日志过密，生产噪声偏高

- **现象**：`flush/logRequest` 路径包含大量 `console.log`（每条请求多次输出）。
- **影响**：日志噪声高、排障信噪比下降，且有额外性能开销。
- **原因**：调试日志未按环境分级控制。
- **建议**：引入最小级别开关（如 `LOG_LEVEL` 或 settings 中 debug 标记），默认只输出 warn/error。
- **验证方式**：
  1. 生产模式运行，确认仅关键日志输出。
  2. 打开 debug 开关后可恢复详细日志，不影响主流程。
- **代码位置**：`apps/desktop/electron/services/logger/index.ts:58`，`apps/desktop/electron/services/logger/index.ts:94`

### 13) 关键路由可用性与注册状态缺少结构化快照

- **现象**：目前以 `console.log` 输出路由注册，缺少统一“当前启用路由清单”接口。
- **影响**：线上核对路由启停状态成本高，尤其是 Code Switch 路由（`/code/claudecode/v1/messages` 已启用；Codex 相关仍注释）。
- **原因**：可观测性停留在启动日志，没有提供机器可读状态。
- **建议**：增加只读 IPC（如 `proxy-service:get-route-manifest`）输出已注册 route manifest。
- **验证方式**：
  1. 启动后调用 manifest 接口，断言包含 `/providers/*`、`/proxies/*`、`/code/claudecode/v1/messages`。
  2. 断言不包含注释禁用的 Codex code-switch 路由。
- **代码位置**：`apps/desktop/electron/services/proxy-server/routes.ts:61`，`apps/desktop/electron/services/proxy-server/routes.ts:67`

---

## 建议实施顺序

1. **P0（高优先）**：#2、#5、#9、#11  
2. **P1（中优先）**：#1、#3、#6、#10、#13  
3. **P2（持续优化）**：#4、#7、#8、#12

