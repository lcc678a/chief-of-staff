# Chief-of-Staff Stage 1 发布说明

## 摘要

Chief-of-Staff（参谋长）Stage 1 是一个 Cursor-first 但非 Cursor-only 的 AI 项目调度工作流：

- 主参谋负责规划、拆任务、诊断状态、判断下一步
- Cursor 工兵负责本地交互式代码任务
- 外部 API 工兵负责用户自定义模型、自动化、批量、长任务
- 状态主要落在 `.chief/` 文件结构中

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

- 本项目**不能**自动打开 Cursor Agent 子窗口。
- 本项目**不能**自动 Rename Cursor Agent；只能提示用户**手动** Rename。
- 任务包代码块在 Cursor/MCP 展示链路中可能不稳定渲染为复制框；任务包内容与备份文件可作为 fallback。
- `chief_external_preflight` **不发真实 HTTP 请求**，因此 Key 存在不代表 API 一定可用。
- `chief_repair` **不覆盖**损坏或已存在的 `tasks.json` / `config.json`。
- `allowed_files` 是协作约束，**不是**硬沙箱或强制文件锁。
- `chief_audit` **不自动修复**问题。
- 尚未建立完整自动化测试套件。
- 外部 API 工兵需要用户自行配置 API Key（环境变量等）。

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
