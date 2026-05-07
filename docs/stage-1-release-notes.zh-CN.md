# Chief-of-Staff Stage 1 发布说明

## 摘要

Chief-of-Staff（参谋长）Stage 1 是一个 Cursor-first 但非 Cursor-only 的 AI 项目调度工作流：

- 主参谋负责规划、拆任务、诊断状态、判断下一步
- Cursor 工兵负责本地交互式代码任务
- 外部 API 工兵负责用户自定义模型、自动化、批量、长任务
- 状态主要落在 `.chief/` 文件结构中

**0.1.1** 修复新项目安装体验：新增 **`npx chief-of-staff-mcp init`** 命令，一次性创建 MCP 配置、Cursor rule（`alwaysApply`）和 `.chief` 状态目录。**0.1.1** 还强化了默认 Cursor rule：恢复**主参谋 / 工兵**边界，明确实现默认通过 **Cursor Agent Worker** 或 **External API Worker**，不让主参谋在默认情况下直接写应用代码；模糊产品目标须先过**决策检查点**；并强调**保留项目记忆**、勿擅自覆盖既有方向。文档补充：说明 Cursor 中新添加的 MCP server **可能首次默认关闭**，需要用户**手动启用**或 **Reload / Restart Cursor** 后，Agent Chat 才能稳定看到 Chief-of-Staff 工具。文档补充：说明用户可以把**高级推理模型**用于主参谋 Chief，把**其他模型**用于 **Cursor Agent Worker** 或 **External API Worker**；Chief-of-Staff **不**声称能强制或自动替用户切换 Cursor 模型。

**0.1.2** 在 **0.1.1** 能力基础上做发布与文档收尾：npm 与仓库文档将**当前版本**统一为 **v0.1.2**；明确 **Cursor Agent Worker** 为**手动交接**——主参谋准备任务包，用户新开 Cursor Agent 窗口复制执行，完成后把工兵摘要带回主参谋（非自动回传）；根 README 将「Two recommended modes」改为 **Usage modes**；继续同步强调 External API Worker 需在配置 provider/model/API 后派发、结果经 Chief-of-Staff 流程回收；以及 MCP 首次启用、模型策略与「不自动切换 Cursor 模型」等表述。

**0.1.3** 是针对 **External API Worker 路线**的关键 hotfix，主要修复 `0.1.2` 在真实 npm/npx 安装下无法可靠派发外部工兵的问题：

- **工兵脚本路径不再硬编码到用户项目目录**：`dispatch_worker` 用 `import.meta.url` 把 `run_worker.js` 解析到**包安装位置**（`dist/workers/run_worker.js`），而不是 `process.cwd()/chief-mcp-server/dist/...`。`npx chief-of-staff-mcp` 安装的用户不会再出现「子进程立刻退出、没有日志、task 永远卡在 running」。脚本不存在时立刻把任务标记为 failed 并给出可读错误。
- **provider 名字解耦**：`config.providers` 下的 key 完全自由（`openai` / `dashscope` / `deepseek` / `moonshot` / 任意 OpenAI-compatible 端点）。`getProvider` 不再硬编码 `dashscope` 分支；通用的 `OpenAICompatibleProvider` 按 key 读取 `base_url` / `api_key_env` / `models`。`run_worker` 选 provider 时也优先使用 `task.provider`，再回落到 `config.default_provider`，跟 `dispatch_worker` 的解析路径保持一致。
- **流式日志不再乱序**：`run_worker` 用串行 Promise 队列处理 `appendFile`，替换原来 `void appendLog(...)` 的 fire-and-forget 写法。流式 chunk 在 `.chief/logs/<task>.log` 中按到达顺序落盘；worker 结束前会 `flush` 队列。
- **完整结果会持久化**：worker 完成后会把完整输出写到 `.chief/results/<task>.md`，并把 `result_file` 与一句话 `summary` 写回 `tasks.json`。主参谋之后不再需要靠读完整日志才能拿到结果。
- **External Worker 工作流是异步的**：`dispatch_worker` 派出 detached 子进程后**立即返回**；默认 rule 与工具描述都明确告诉主参谋**不要**让用户原地等几分钟，用户可以继续与主参谋交流，主参谋只在用户问「跑完没」或后续工作真的依赖该结果时才查 `get_worker_status` / `get_worker_summary`。
- **默认只读路径，不读全文**：`get_worker_status` / `get_worker_summary` 默认返回 `status` / `summary` / `result_file` / `log_file` 四件套；默认 rule 要求主参谋**不**自动把 `result_file` 完整内容或完整日志贴进主聊天，避免吃 token，只有用户**明确**要求时才打开完整结果或读完整日志。

升级建议：升级到 0.1.3 后，旧版本由 0.1.2 派出但永远卡在 running 的 task，需要人工把状态改回 pending（或重新登记）后再 `dispatch_worker`；0.1.3 不会自动收拾旧版本留下的僵尸 task。

**0.1.4** 是 0.1.3 之后的 cleanup hotfix：同步 `package-lock.json` 的包名与版本元数据到 `chief-of-staff-mcp@0.1.4`；补齐根 README 的 0.1.3/0.1.4 状态说明；增强 `dispatch_worker` 的派发阶段可观测性，在标记 running 前检查 worker 脚本存在，写入 `=== dispatch start ===` 日志，并把 worker stdout/stderr 追加到 `.chief/logs/<task>.log`；同时轻微增强 External Worker 的 system prompt。该版本不引入 0.2 的自定义 system prompt、thinking_mode 或 self-critique。

**0.1.5** 是 0.1.4 之后的紧急收尾补丁：补齐 0.1.4 发布时漏提交到 GitHub 源码的 `run_worker.ts` system prompt 增强，确保 npm 包与仓库源码一致；同时将默认 Cursor rule 中 acknowledgement 示例改为 ASCII-first 表述，避免 Windows/终端环境下中文示例词显示乱码。该版本不引入新的 worker 架构能力。

## v0.1 产品化

Stage 1 能力封版后，项目进入 **v0.1 产品化**阶段：目标是提供可安装、可打包的 **Cursor MCP** server（`chief-mcp-server` 目录，npm 包名以该目录下 `package.json` 为准）。**暂不承诺** Claude Code、Trae、Workbody 等平台的适配；其他 IDE/Agent 路线需单独实测后再写入支持说明。

## 产品命名

- **产品展示名**：Chief-of-Staff
- **中文展示名**：Chief-of-Staff（参谋长）
- **完整定位名**：Chief-of-Staff for Cursor
- 代码/仓库/包名可使用 `chief-of-staff`
- 「Chief of Staff」是泛词，传播时建议搭配 Cursor、MCP、Agent Workflow 等定位词，以免丢失语境

## Stage 1 包含什么

### 健康检查与修复

- `chief_doctor`
- `chief_repair`

### 深度诊断

- `chief_audit`

### 下一步建议

- `chief_next_action`

### 任务规划与状态查看

- `plan_tasks`
- `get_worker_board`
- `get_worker_status`
- `get_worker_summary`

### Cursor 工兵路线

- `prepare_cursor_agent_task`
- `submit_worker_result`
- `lane` / `window_hint`
- 手动 Rename 指引
- 依赖安全门
- 文件范围约束（`allowed_files` / `forbidden_files`）

### 外部 API 工兵路线

- `chief_config_help`
- `chief_external_preflight`
- `dispatch_worker`
- provider/model 优先级保护
- API Key 不泄露（通过环境变量，工具不显示密钥值）

### 安全机制

- `allowed_files` / `forbidden_files`
- `depends_on` / `blocked_by`
- `blocked` / `failed` outcome
- `chief_repair` 不覆盖已有任务/config
- `chief_audit` / `chief_external_preflight` / `chief_config_help` / `chief_next_action` 只读

## 典型工作流

### 1. 新用户 / 空项目

- `chief_doctor`
- `chief_repair`
- `chief_next_action`
- `plan_tasks`

### 2. Cursor 工兵任务

- `plan_tasks`
- `prepare_cursor_agent_task`
- 将任务包粘贴到 Cursor Agent
- 可按需手动 Rename Agent
- `submit_worker_result`
- `get_worker_board` / `chief_next_action`

### 3. 外部 API 工兵任务

- `chief_config_help`
- `chief_external_preflight`
- `dispatch_worker`
- `get_worker_status` / `get_worker_summary`

### 4. 调试项目状态

- `chief_doctor`
- `chief_audit`
- `chief_next_action`

## 已知限制

- **Cursor Home / 全局 Agent** 可能没有当前仓库上下文，**可能无法调用项目级** `.cursor/mcp.json` **中的 MCP**；**v0.1 建议在目标项目文件夹已在 Cursor 中打开的前提下，于该项目窗口内的 Agent 中测试与日常使用 Chief-of-Staff。**
- 本项目**不能**自动打开 Cursor Agent 子窗口。
- 本项目**不能**自动 Rename Cursor Agent；**Agent 对话框命名目前依赖用户手动 Rename**；只能通过 `window_hint` 等提示对齐「哪个框做哪项任务」；更强命名规范见 [docs/product-principles.zh-CN.md](./product-principles.zh-CN.md)。
- 任务包代码块在 Cursor/MCP 展示链路中可能不稳定渲染为复制框，且可能出现压缩、折叠等展示问题；**仍需后续优化**；任务包落盘文件、工兵看板与明确 `task_id` 可作为 fallback。
- `chief_external_preflight` **不发真实 HTTP 请求**，因此 Key 存在不代表 API 一定可用。
- `chief_repair` **不覆盖**损坏或已存在的 `tasks.json` / `config.json`。
- `allowed_files` 是协作约束，**不是**硬沙箱或强制文件锁。
- `chief_audit` **不自动修复**问题。
- 尚未建立完整自动化测试套件。
- 外部 API 工兵需要用户自行配置 API Key（环境变量等）。
- **Cursor SDK**（`@cursor/sdk` 等）可能成为后续**自动派发 Cursor 工兵**的路线，但 **Stage 1 未集成**；当前仍以手动任务包与外部 API 工兵为主。
- **单主参谋**与**主参谋 + 工兵**两种使用模式已在 [docs/product-principles.zh-CN.md](./product-principles.zh-CN.md) 中说明。

## Stage 1 验收状态

详见 [docs/stage-1-acceptance-plan.md](./stage-1-acceptance-plan.md)。

- 仓库内已有阶段验收计划。
- 关键 smoke tests 覆盖：`chief_doctor`、工兵看板、任务包、`depends_on`、external 配置与 `chief_external_preflight`、`chief_next_action`、`chief_audit` 等。
- **发布前**需按该计划完整执行验收。

## Stage 2 候选方向

- 自动化测试
- file lock / active worker lock
- external worker 真实 API 连通性测试（需安全处理 API Key）
- 更丰富的路线选择策略
- 任务模板
- 更稳的 Cursor handoff fallback
- UI / dashboard
- 英文完整文档
