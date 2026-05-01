# Cursor SDK 自动派发工兵设计

本文档描述**未来**可能新增的工具 `dispatch_cursor_worker` 及相关配套能力的设计意图。**本文档不构成实现承诺**；Stage 1 与当前仓库**未集成** Cursor SDK，也未实现下列工具。

---

## 结论

- **Cursor SDK route 值得做 PoC**：`@cursor/sdk` 可从 Node.js 创建 Agent、指定模型、在 local / cloud runtime 下运行，并支持 `send`、`run.stream`、`run.wait`、`run.cancel` 等能力，有望减少 Cursor 工兵路线上的手动步骤。
- **第一版应为 experimental**：SDK 处于 public beta，API 与计费规则可能变化；行为与稳定性需单独验证。
- **第一版只支持 local runtime**：`local.cwd` 指向当前工作树，与现有「本地工兵」心智一致；**不**在第一版支持 cloud runtime（含托管 VM、克隆仓库等），后者仅作 future direction。
- **手动任务包路线必须保留**：`prepare_cursor_agent_task` 作为**稳定 fallback**，适用于所有用户，尤其无 `CURSOR_API_KEY` 或不愿授权 SDK 的场景。
- **不应直接进入生产默认路径**：自动派发应显式启用（配置/工具选择），且文档与产品默认叙事仍以手动 handoff + external worker 为主，直到 PoC 与评审完成。
- **需要 `CURSOR_API_KEY`，可能产生费用**：调用 Cursor 托管能力会产生用量与账单风险，须在帮助类工具与文档中明确，且**永不**在输出中回显密钥。

---

## 为什么需要 dispatch_cursor_worker

### 现有 `prepare_cursor_agent_task` 的短板

- **手动复制**：用户需将任务包从 MCP 展示复制到 Cursor Agent。
- **手动开窗口**：无法程序化打开或聚焦 Cursor Agent / Agents 窗口。
- **手动 Rename**：窗口策略依赖用户自行 Rename；主参谋仅能提供 `window_hint` 等建议。
- **手动回传**：工兵完成后需用户或主流程调用 `submit_worker_result`。
- **UI 渲染不稳定**：任务包以代码块等形式在 Cursor/MCP 链路中展示时，可能出现复制不便或展示异常。

### Cursor SDK 可能带来的改善

- **程序化创建 Agent**：减少「新开窗口 + 粘贴」的重复劳动。
- **程序化 send prompt**：将结构化任务提示词交给 SDK Agent，而非纯手动粘贴。
- **`wait` / `stream` 获取结果**：便于在设计中区分同步等待与异步轮询。
- **指定模型**：例如 `model: { id: "composer-2" }`（具体以 SDK 文档为准）。
- **读取本地工作树**：local runtime 下 cwd 指向仓库，与「工兵改本地代码」一致。

上述能力**均依赖** SDK 可用性、密钥与计费；**不**保证与 Cursor 桌面端 Agents UI 100% 一致（例如窗口复用策略仍可能需产品层约定）。

---

## 与现有路线的关系

系统内应长期并存**三条**工兵相关路线，互不替代默认地位，由用户配置与任务属性选择。

### 1. Cursor manual handoff

**工具**：`prepare_cursor_agent_task`（及既有 `submit_worker_result`、`get_worker_board` 等）。

**特点**：

- **稳定**：不依赖 `@cursor/sdk`，不依赖 `CURSOR_API_KEY`。
- **用户手动控制**：复制、开窗口、Rename、回传均由用户主导。
- **适合所有用户作为 fallback**：尤其是企业环境禁用第三方 API Key、或仅信任「可见的 Agent 窗口」的场景。

### 2. Cursor SDK worker（设计中的未来路线）

**未来工具**：`dispatch_cursor_worker`（及下文设计的配套工具）。

**特点**：

- **需要 `CURSOR_API_KEY`**，并可能产生 Cursor **用量费用**。
- **自动派发**：创建 Agent、发送任务提示词、记录 `agentId` / `runId`（设计意图）。
- **适合愿意授权 Cursor SDK 的用户**。
- **experimental**：beta API、行为与计费可能变化。

### 3. External API worker

**工具**：`chief_config_help`、`chief_external_preflight`、`dispatch_worker` 等。

**特点**：

- **用户自定义 provider/model**，不依赖 Cursor SDK。
- **适合外部模型、自动化、长任务**、与 Cursor 解耦的流水线。

**明确**：`dispatch_cursor_worker` **不替代** external API worker；两者服务于不同密钥模型与运行时。

---

## 建议的工具形态

以下工具均为**设计草案**，**未实现**；第一版 PoC 可只落地 **preflight + dispatch** 的子集，其余标为 future。

### chief_cursor_sdk_help

**作用（设计意图）**：

- 检查 `CURSOR_API_KEY` 是否在环境中可用（存在性/格式类检查，**不**打印密钥值）。
- 调用 `Cursor.me` / `Cursor.models.list` 等（以 SDK 实际 API 为准），用于确认账号与模型列表可读。
- 输出费用提示、public beta 状态说明与文档链接。
- **不显示 API Key**。

### chief_cursor_sdk_preflight

**作用（设计意图）**：

- 任务是否存在（如 `task_id` 在 `.chief/tasks.json` 中）。
- `depends_on` 是否均已 **done**（与现有 external preflight 门控思想一致）。
- `CURSOR_API_KEY` 是否存在。
- 所选 **model** 是否在 `Cursor.models.list`（或等价能力）中可用。
- **runtime** 是否受支持（第一版仅允许 `local`）。
- `allowed_files` / `forbidden_files` 等字段是否存在、是否可解析。
- **提醒**：`allowed_files` / `forbidden_files` 仅为协作约束与提示，**不是**硬沙箱。

### dispatch_cursor_worker

**作用（设计意图）**：

- 使用 Cursor SDK **创建** Agent（配置 local runtime、模型等）。
- **发送**任务提示词（见下文「任务提示词设计」）。
- **记录** `cursor_agent_id`、`cursor_run_id` 等到任务状态（见「状态字段草案」）。
- 根据产品选择 **同步** `run.wait` 或 **异步** 立即返回（见「同步 vs 异步设计」）。
- **`dry_run`**：仅报告将要执行的动作与参数摘要，**不**调用 SDK。

### get_cursor_worker_run

**作用（设计意图）**：

- 查询某次 Cursor SDK run 的 **status**、**result** 摘要（如完成、错误、取消）。
- **不泄露 token**、不回显密钥。

### cancel_cursor_worker_run

**作用（设计意图）**：

- 对 **running** 状态的 run 调用取消（以 SDK 的 `run.cancel` 或等价 API 为准）。
- **不删除**用户仓库中的代码文件。
- **不自动恢复** Git 工作区或文件内容（与 `chief_repair` 等修复流区分）。

**Future 备注**：第一版可仅实现 `chief_cursor_sdk_preflight` + `dispatch_cursor_worker`；run 查询与取消放到后续迭代。

---

## 输入 schema 草案

`dispatch_cursor_worker` 建议输入形状：

```json
{
  "task_id": "string",
  "model": "string (optional)",
  "runtime": "local",
  "wait": "boolean (optional)",
  "dry_run": "boolean (optional)"
}
```

**说明**：

- **`task_id`**：必填；对应 `.chief/tasks.json` 中的任务。
- **`model`**：可选；默认可为 `composer-2` 或由 `.chief/config.json` / 环境映射（具体映射规则实现阶段再定）。
- **`runtime`**：第一版**仅允许** `"local"`；传入其他值应拒绝或明确提示「未支持」。
- **`wait: false`**：启动 run 后尽快返回 **`agentId` / `runId`**（及初始状态），便于异步轮询。
- **`wait: true`**：`dispatch_cursor_worker` 在工具内 `run.wait` 直到结束；**注意** MCP 工具往往有超时上限，长任务可能中断或表现为失败，需文档说明。
- **`dry_run: true`**：只做 preflight 与「将要做的事」的摘要，**不**调用 SDK 创建 Agent 或启动 run。

---

## 状态字段草案

未来可在 `.chief/tasks.json` 的任务对象上**增量**增加字段（**不破坏**现有字段语义；与现有 `worker_route` 共存时需兼容解析）。

建议字段（草案）：

| 字段 | 含义 |
|------|------|
| `cursor_agent_id` | SDK 创建的 Agent 标识 |
| `cursor_run_id` | 当前或最近一次关联的 run 标识 |
| `cursor_runtime` | 如 `local`（第一版） |
| `cursor_model` | 实际使用的模型 id |
| `cursor_run_status` | 如 pending / running / finished / error / cancelled（与 SDK 枚举对齐实现时映射） |
| `cursor_dispatched_at` | ISO 时间戳 |
| `cursor_finished_at` | run 结束时间（若可取得） |
| `cursor_result_summary` | 结果摘要文本（非全量日志，避免文件过大） |
| `worker_route` | 区分工兵路线（见下） |

**`worker_route` 取值建议（扩展，不替换现有语义）**：

- `cursor_agent`：**手动** Cursor Agent（任务包 handoff），与当前 Stage 1 一致。
- `cursor_sdk`：**SDK 自动** Cursor Agent（本设计文档描述路线）。
- `external`：外部 API `dispatch_worker` 路线。

**兼容原则**：

- 不删除或重定义已有 `worker_route` 值；新增值仅用于新路线。
- 手动 handoff 仍可继续使用既有字段（如 `lane`、`window_hint`），与 SDK 字段可并存但需定义优先级（实现阶段定义）。

---

## 同步 vs 异步设计

### 同步模式

`dispatch_cursor_worker` 在 `agent.send`（或等价）后**直接** `run.wait` 直至 run 结束。

**优点**：

- 实现心智简单；调用方一次工具调用即可拿到终态（在超时允许范围内）。

**缺点**：

- **MCP 工具可能超时**，长任务不适合。
- 用户**无法**在运行中途通过 Chief 工具看细粒度状态（除非客户端支持长连接，多数场景不具备）。
- run **失败**时，任务在 `tasks.json` 中应标为 `failed` 还是保持 `running` 并提示人工处理，需与「不自动 mark done」策略一起定义，否则易产生不一致。

### 异步模式

`dispatch_cursor_worker` **启动** run 后立即返回 `agentId` / `runId`；用户稍后调用 `get_cursor_worker_run`（或轮询）。

**优点**：

- 更适合**长任务**，贴近 external worker「派发—查状态」模型。
- 支持 **`cancel_cursor_worker_run`** 中途取消。
- **降低**单次 MCP 调用超时风险（仅启动阶段占用时间）。

**缺点**：

- 需在 `tasks.json` **持久化** run id 等字段。
- 需要**更多工具**与状态机（preflight、get、cancel）。
- **状态同步**复杂（SDK 状态与本地任务状态可能短暂不一致）。

### 建议

- **第一版 PoC** 可采用**同步** `wait` 验证 SDK 与提示词链路是否打通（短任务、可接受超时风险）。
- **正式产品设计**应**偏向异步**：默认 `wait: false`，配合 `get_cursor_worker_run` 与清晰的 `cursor_run_status`，并与 `chief_next_action` / `chief_audit` 的建议文案对齐（实现阶段落地）。

---

## 任务提示词设计

`dispatch_cursor_worker` **不应**将用户随意一句话直接当作 SDK Agent 的唯一输入；应**复用** `prepare_cursor_agent_task` 所承载的**任务包语义**，针对 SDK 做**精简结构化**提示，例如包含：

- `task_id`
- `description`
- `lane` / 窗口策略提示（若与 manual 路线一致）
- `allowed_files` / `forbidden_files`（再次强调非硬沙箱）
- `depends_on` 已满足的说明（由 preflight 保证，提示中可写「依赖已由 Chief 门控确认」）
- 对 **done / blocked / failed** 的期望定义（与 `submit_worker_result` 语义对齐，便于人类复核）
- **不要求** SDK Agent 在对话中调用 `submit_worker_result`：**第一版**由 `dispatch_cursor_worker`（或后续独立步骤）根据 run 结果写入 `cursor_result_summary` 等，**不**自动等价于任务 done

**约束（第一版）**：

- **不要让 SDK Agent 自行修改 `.chief/tasks.json`**，除非后续单独设计「受控写回」与审计；第一版默认避免。
- **不要让 SDK Agent 直接调用 Chief-of-Staff MCP**，避免递归派发、循环工具调用；工兵输出以自然语言 + 代码改动为主，状态回写由外层工具或用户 `submit_worker_result` 完成。

---

## 安全边界

1. **不显示 `CURSOR_API_KEY`**：任何工具输出、日志、错误信息均不得包含密钥明文。
2. **没有 `CURSOR_API_KEY` 不派发**：preflight 失败则拒绝或仅 `dry_run` 说明。
3. **`depends_on` 未完成不派发**：与 external 路线门控一致。
4. **SDK route 可能产生费用**：须在 `chief_cursor_sdk_help` 与文档中反复提示。
5. **SDK beta，API 可能变化**：版本锁定与变更日志需单独维护；不对外宣称「稳定」。
6. **`allowed_files` / `forbidden_files` 仅为提示**，不是硬沙箱；不能替代代码审查与权限模型。
7. **第一版不支持 cloud runtime**（含自动克隆、托管 VM 等）。
8. **第一版不支持 autoCreatePR** 等云特性（归入 Phase 6 及以后）。
9. **第一版不让 SDK Agent 直接调用 Chief-of-Staff MCP**，避免递归。
10. **`dispatch_cursor_worker` 失败时**必须保留 **`prepare_cursor_agent_task` fallback**；错误信息应引导用户改用手动任务包。
11. **不默认自动 mark task done**：run 成功或模型声称完成，**不等于**任务验收通过；须见「done / blocked / failed 映射设计」。
12. **不自动删除、归档 Cursor Agent**（若 SDK 暴露生命周期 API，默认保守处理）。
13. **不自动恢复文件**：取消或失败不触发自动 `git checkout` 等破坏性/隐式回滚（除非未来单独设计且用户确认）。

---

## done / blocked / failed 映射设计

SDK **Run status** 与 Chief **任务 outcome** 不能简单一一自动等价，否则会出现「模型自信但未完成」或「工具超时被标失败」等问题。

**建议处理**：

- **Run status = `error` / `cancelled`**：可映射为任务仍处需关注状态，或标为 `failed` / 附 `cursor_result_summary` 说明；**具体枚举**实现前需与 `chief_audit` 规则对齐。**备选**：保持 `running` 并提示人工处理——需权衡看板清晰度。
- **Run status = `finished` 且 result 文本存在**：**不应无条件**将任务标为 `done`。
- **第一版推荐**：将可公开摘要写入 **`cursor_result_summary`**，**不**自动调用 `submit_worker_result`。
- **用户或主参谋**在确认后使用 `submit_worker_result`：`outcome=done` | `blocked` | `failed`。
- **可选后续参数**：`confirm_result` 或「显式确认后才写 done」类开关，降低误标 done 风险。

**推荐保守策略（第一版）**：

- **`dispatch_cursor_worker` 不自动调用 `submit_worker_result`**。
- 工具结束语或结构化输出中提示下一步，例如：
  - 若结果看起来**完成**：请人工确认后执行 `submit_worker_result outcome=done`。
  - 若**阻塞**（依赖、环境、权限）：`outcome=blocked` 并附理由。
  - 若**失败**或 run 错误：`outcome=failed` 并附摘要。

这样避免 SDK Agent **口头完成**但实际未满足验收标准的情况直接污染任务真相源。

---

## 与 chief_next_action / chief_audit 的关系（设计层面）

**设计意图**（本任务不实现）：

- **`chief_next_action`**：当 `worker_route=cursor_sdk` 且任务为 pending / 可派发时，可建议先调用 **`chief_cursor_sdk_preflight`**；当 `cursor_run_status=running` 时，可建议 **`get_cursor_worker_run`**。
- **`chief_audit`**：可检查 `cursor_run_id` 缺失、任务状态与 SDK 状态不一致、`cursor_dispatched_at` 与 `cursor_finished_at` 矛盾等。

实现时需避免只读工具产生副作用；具体规则在实现任务中单开。

---

## PoC 范围建议

**下一步 PoC 不应**直接接入生产 MCP 主流程（默认安装路径）。

建议**单独**：

- 使用 `scripts/cursor-sdk-poc.ts` 或**独立实验目录**；
- 从环境读取 `CURSOR_API_KEY`（本地 `.env` 等，**不**提交仓库）；
- **local cwd** 指向当前仓库；
- 调用如 `Agent.prompt("Summarize this repo")`（以 SDK 实际 API 为准）；
- **打印** result 到控制台；
- **不写** `tasks.json`、**不**为 PoC 自动修改业务代码；
- **不**在未经评审的情况下将 `@cursor/sdk` 提交为产品 `package.json` 依赖；若必须安装，**单独任务**评审版本与许可证。

---

## 推荐路线（阶段）

### Phase 1: Design only

当前任务：输出本设计文档并与产品文档对齐；**无代码**。

### Phase 2: Minimal PoC

仅验证 **Agent 创建 / prompt / local runtime / model / result**；**不改**任务状态、不写 `.chief`。

### Phase 3: Preflight tool

实现 **`chief_cursor_sdk_preflight`**（只读 + 门控），**不**派发。

### Phase 4: Experimental dispatch_cursor_worker

最小实现：**`dry_run`** + **`local` runtime** + **`wait=false` 或 `wait=true`** 二选一或并列支持；标记 **experimental**。

### Phase 5: Run management

**`get_cursor_worker_run`** / **`cancel_cursor_worker_run`**。

### Phase 6: Cloud runtime

研究 **cloud runtime**、**autoCreatePR**、artifacts 等；单独安全与合规评审。

---

## 对产品路线的影响

- **Cursor SDK route** 是提升「Cursor 工兵」体验的重要机会，可显著减少复制粘贴与窗口摩擦。
- **不改变** v0.1「可安装 MCP 包」目标：SDK **未**纳入 Stage 1 交付范围。
- **可能成为 v0.2 级核心能力**：在 PoC 与密钥/计费/稳定性验证通过后，再考虑默认推荐程度。
- **手动任务包**（`prepare_cursor_agent_task`）**仍是**默认 fallback 与无 Key 场景下的唯一自动文案来源。
- **External API worker** **完整保留**，满足非 Cursor 模型与自动化编排需求。

---

## 文档与实现状态

- 调研结论可参考：[cursor-sdk-custom-agents-feasibility.zh-CN.md](./cursor-sdk-custom-agents-feasibility.zh-CN.md)（若存在）。
- **`dispatch_cursor_worker` 未实现**；集成 Cursor SDK **未声称**已完成或稳定。
