# Chief-of-Staff 快速开始

## 安装 MCP（Cursor）

- **试用当前仓库**：在 `chief-mcp-server` 下 `npm install` 与 `npm run build`，再在 Cursor MCP 配置里指向本机的 `dist/server.js`（见 [docs/install-cursor.zh-CN.md](./install-cursor.zh-CN.md) 方式 A）。
- **将来包发布到 npm 后**：可用 `npx -y <package-name>` 安装（以 `chief-mcp-server/package.json` 的 `name` 为准；详见同一文档方式 B）。
- 完整步骤与 FAQ：**[docs/install-cursor.zh-CN.md](./install-cursor.zh-CN.md)**。

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
