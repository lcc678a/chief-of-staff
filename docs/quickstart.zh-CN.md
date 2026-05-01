# Chief-of-Staff 快速开始

英文产品概览见仓库根目录 [README.md](../README.md)。

## 安装 MCP（Cursor）

- **已发布 npm 包时（推荐）**：在**目标项目根目录**执行 `npx chief-of-staff-mcp init`（详见 [docs/install-cursor.zh-CN.md](./install-cursor.zh-CN.md)「推荐方式」），一次性生成 MCP 配置、默认 Cursor rule 与 `.chief/`。
- **试用当前仓库 / 本地 server**：在 `chief-mcp-server` 下 `npm install` 与 `npm run build`，可用 `node .../dist/server.js init` 在目标项目初始化，或手动配置 MCP（见安装文档方式 A、`.cursor/mcp.json.example`）。**仅配 MCP 不配 rule 时，Agent 仍可能像普通编程助手。**
- 完整步骤与 FAQ：**[docs/install-cursor.zh-CN.md](./install-cursor.zh-CN.md)**。
- **首次验证 MCP 时**：`init` 后请 **Reload / Restart Cursor**，并在 Cursor **MCP 设置**里确认 **`chief-of-staff` 已启用**（部分版本新加的 MCP 可能默认关闭）。然后在**已打开目标项目**的 Cursor 窗口内，**新建** Agent Chat / Agent Window 再测（详见安装文档「在项目窗口内测试 MCP」）。若 Agent Chat 里看不到 `chief_doctor` / `chief_next_action` 等工具，**先检查 MCP 是否已启用**。从 **Cursor Home / 全局 Agent** 测试时若看不到项目级 MCP，**不代表**安装失败。
- **推荐自测顺序**：`chief_doctor` → `chief_next_action` → `chief_audit`（均由 Agent 在对话中触发调用即可）。
- **模型策略（常见用法）**：建议在**主 Chief 对话**里选用**更强的推理模型**；若使用 **Cursor Agent Worker**，可在**工兵窗口**选择适合执行的模型；若使用 **External API Worker**，则通过 **provider/model/API** 配置选择外部模型。Chief-of-Staff **不**替你自动切换 Cursor 模型。

## 从零开始的推荐流程

1. `cd` 进入你的项目根目录。
2. 运行 `npx chief-of-staff-mcp init`。
3. 用 Cursor **打开该项目**；**Reload / Restart Cursor**；在 **MCP 设置**里确认 **`chief-of-staff` 已启用**（若显示为关闭请手动打开）。
4. 在**该项目窗口内**新开 **Agent Chat**。
5. Chief 应在对话开头按顺序**简短说明**：主参谋角色 → 保持状态清晰与下一步建议 → 默认不直接写应用代码 → 两条工兵路线（Cursor / External）→ 你后续可随时切换路线或方向；不必每轮重复。
6. 你提出目标（例如产品想法）。
7. 对**模糊目标**，Chief **先问关键选择**（平台、数据、登录、MVP、工兵路线等），**不**直接大段写代码；并中性说明两条路线的执行差异，再请你选择。
8. 方向一致后，Chief 用 `plan_tasks` 等**登记任务**，并用 `prepare_cursor_agent_task` 准备 **Cursor 工兵任务包**，或在你配置好 API 后走 **External** 预检与派发。
9. 你选择 **Cursor Agent Worker**（新开 Agent 窗口粘贴任务包）或 **External API Worker**；简单实现通常**一个**工兵任务即可。

**反例（不符合产品设定）**：你说「我想做学习软件」，Agent **立刻**搭栈、改很多文件。  
**正例**：Chief **先问**目标用户、平台（小程序/Web/桌面等）、数据与登录、MVP 范围、更倾向哪种工兵路线，再总结待确认方向并准备任务/任务包。

补充：短回复如「好 / 可以 / 继续 / 嗯」只表示继续对话，**不自动等于**批准写代码、登记任务、准备任务包或派发工兵；进入实施前应有明确确认。

## 选择使用模式

更完整说明见 **[docs/product-principles.zh-CN.md](./product-principles.zh-CN.md)**。

### 单主参谋模式

适合新手和小任务。

建议先问：

```text
下一步做什么？
```

### 主参谋 + 工兵模式

适合任务变多时。

建议：

```text
把不需要我持续参与的任务交给工兵。
```

说明：

- 工兵能节省主对话上下文。
- 用户仍主要面对主参谋。
- 工兵窗口需要按建议**手动 Rename**（系统不会自动改名）。

## 1. 打开项目

示例路径：

```text
C:\Users\lichangchun\Desktop\chief-of-staff
```

- 在 Cursor 中打开上述项目（或你的克隆路径）。
- 修改 MCP / rules 后建议**重启 Cursor**，以便 MCP tools 与规则生效。

## 2. 从体检开始

示例话术：

```text
检查 Chief-of-Staff 项目状态。
```

这会引导调用 `chief_doctor`，了解 `.chief/` 与任务基础健康情况。

## 3. 如果缺基础结构，修复

示例：

```text
修复 Chief-of-Staff 基础结构。
```

`chief_repair` 只补缺失目录与默认文件，**不覆盖**已有 `tasks.json` / `config.json`。

## 4. 问下一步

示例：

```text
下一步做什么？
```

说明会调用 `chief_next_action`，从当前任务队列压缩出可执行建议。

## 5. 创建 Cursor 工兵任务

示例：

```text
登记一个 Cursor 工兵任务：修改 README 的快速开始说明。lane 用 docs，文件范围只允许 README.md。
```

- 参谋会登记任务（如通过 `plan_tasks` 等流程）。
- 可让参谋 `prepare_cursor_agent_task` 准备 Cursor 工兵任务包。
- 将任务包粘贴到 **Cursor Agents** 窗口执行。
- 可在 Agents 界面**右键 Agent → Rename**，改为建议的窗口名（若有 `window_hint`）。
- 完成后调用 `submit_worker_result` 回传 `done` / `blocked` / `failed`。

## 6. 使用外部 API 工兵

先检查配置：

```text
检查我的外部 API 工兵配置。
```

派发前预检示例：

```text
派发前检查 task-xxx 能不能走 external。
```

（将 `task-xxx` 换成实际任务 ID。）

- `chief_config_help`：只读查看配置与环境变量是否已设置（**不显示** API Key）。
- `chief_external_preflight`：只读预检是否满足派发条件（**不发真实请求**，不扣费）。
- `dispatch_worker`：真正派发外部工兵。
- Cursor 工兵路线**不需要**外部 API Key。

## 7. 深度审计

示例：

```text
做一次深度审计，看看有没有隐藏问题。
```

说明会调用 `chief_audit`，做比 `chief_doctor` 更深的一致性检查（仍只读）。

## 8. 常用说法

- 检查项目状态
- 修复基础结构
- 下一步做什么
- 显示工兵看板
- 审计隐藏问题
- 检查外部 API 配置
- external 派发前预检
- 为 task-xxx 准备 Cursor 工兵任务包
- 查看 task-xxx 状态
- 总结工兵结果

## 9. 安全提醒

- **不要**把 `.chief/tasks.json` 的本地测试污染提交进仓库。
- **不要**把 API Key 写入聊天、文档或截图可见处。
- Cursor Agent **命名需用户手动 Rename**，系统不会自动改名。
- `chief_external_preflight` **不扣费、不发 HTTP**，不能代替真实连通性验证。
- `allowed_files` 是协作约定，**不是**强制沙箱或操作系统级文件锁。
