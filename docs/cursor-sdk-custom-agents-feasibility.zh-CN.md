# Cursor SDK Custom Agents 可行性调研

> **声明**：本文仅基于截至调研时的公开文档与公告做**文献调研**，不代表 Chief-of-Staff 已集成 Cursor SDK，也不构成采购或合规建议。文中不展开 API Key 配置步骤，不涉及真实付费调用。

## 结论

| 维度 | 判断 |
|------|------|
| **总体** | **部分可行**：官方已提供 TypeScript SDK 与 Cloud Agents API v1（public beta），支持以代码方式创建 Agent、发送 prompt、流式获取运行过程与终态；**但**与 Chief-of-Staff 当前「本地 MCP + 手动任务包」模型在**认证、计费、仓库形态、结果结构**上仍有大量对接细节需在 PoC 中验证。 |
| **明确可行** | 存在官方 **`@cursor/sdk`**（`npm install @cursor/sdk`）与 **Cloud Agents API**（`https://api.cursor.com/v1/...`）；文档与示例展示 **`Agent.create` + `agent.send` + `run.stream()`**；REST 侧支持 **创建 Agent / Run、查询状态、SSE 流、取消、Artifacts 列表与下载**；可指定 **`model.id`（文档示例含 `composer-2`）**；官方表述支持在 **CI/CD** 等场景**程序化**触发。 |
| **部分可行** | 从 **Node.js 脚本**调用 SDK：**可行**。从 **Chief-of-Staff 的 MCP server 进程内**再调 SDK：**工程上可行**（同进程或子进程），但需解决依赖体积、密钥注入、错误与超时策略，且 **MCP 工具与 Cursor Cloud API 是两条链路**，未在本文档中实测。 **「替代手动复制任务包」**：对**已推送远端、可走 Cloud Agent 的工作流**可能大幅减摩擦；对**纯本地未提交变更、离线、无 API Key** 等场景 **不能** 完全替代。 |
| **暂不确定** | SDK **`run.wait()` 最终返回结构**与 Chief-of-Staff 的 **`submit_worker_result`（done/blocked/failed + 元数据）** 的一一映射；**本地 `local: { cwd }`** 与 **云端 `repos: GitHub URL`** 在「未 push 的 working tree」上是否等价；**Artifacts / PR / 分支** 与 **allowed_files / lane** 约束如何对齐；**public beta** 下模式是否持续稳定。 |
| **不可行（在本文调研范围内）** | 不在此宣称「零成本」「无需用户凭证」「与桌面 Agents 窗口 100% 行为一致」。**不**在缺乏密钥与授权的情况下调用云端 API。 |

## 官方信息摘录

以下为主要公开来源与可核对要点（访问日期以仓库内调研为准，请以官网最新版为准）。

| 来源 | 关键点 |
|------|--------|
| [Build programmatic agents with the Cursor SDK（Changelog）](https://cursor.com/changelog/sdk-release) | **`@cursor/sdk`**；示例：`Agent.create({ apiKey, model: { id: "composer-2" }, local: { cwd: process.cwd() } })`，`agent.send(...)`，`run.stream()`；**public beta**；计费为 **standard, token-based consumption pricing**；示例工程在 **[cursor/cookbook](https://github.com/cursor/cookbook)**；TypeScript 文档入口 [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)。 |
| [Cloud Agents API overview](https://cursor.com/docs/background-agent/api/overview) | API **v1 public beta**，可能变更；**程序化**创建/管理针对仓库的 **Cloud Agent**；认证为 **Basic Auth**，密钥来自 **Cursor Dashboard → Integrations** 或 **service account**（见文档链接）；提供 **OpenAPI**；**Create Agent** 需 `prompt`、`repos`（GitHub `url` 等）、可选 `model`（`model.id` 如 **`composer-2`**，参数见 `GET /v1/models`）；支持 **List/Get Run、SSE Stream、Cancel、Artifacts、Archive/Delete** 等。 |
| [Announcement / Blog（TypeScript SDK）](https://cursor.com/blog/typescript-sdk) | 与桌面/CLI/Web **同一套 harness**；可 **本地 / Cursor 云 VM / self-hosted workers**；云侧 **sandbox、克隆仓库、开发环境**；官方称团队从 **CI/CD** 触发、做自动化与内嵌产品；**MCP / Skills / Hooks / Subagents** 等能力与 Cursor 产品对齐的表述；示例与 cookbook 链接。 |

**与广告文案的对照**：市场文案中「**Build programmatic agents**」「**CI/CD**」「**Composer 2**」「**50% off Composer 2 usage through the SDK**」等，**前半部分**与官方 SDK + Cloud Agents 文档方向一致；**折扣与促销**具有时效性与产品规则（例如社区曾讨论限时活动与 **cache-read** 计费差异），**必须以 Cursor 当期定价与账户说明为准**，本调研**不**将其视为长期固定费率承诺。

## 对 Chief-of-Staff 的潜在价值

- **自动派发 Cursor 工兵（概念上）**：若增加未来的 `dispatch_cursor_worker`，可由编排层在依赖满足后调用 SDK 或 REST，发起一次 **Run**，减少「参谋生成任务包 → 用户手动粘贴」的断点。
- **减少复制任务包**：对适合 **远端仓库 + Cloud Agent** 的任务，prompt 可直接由程序构造；**保留手动任务包**作为无密钥、离线、或策略不允许走云 API 时的 **fallback**。
- **可能支持 CI/CD**：官方博客/changelog 明确将 CI/CD 列为使用场景之一；技术上可在 pipeline 内跑 Node 脚本调用 SDK（需妥善管理 **密钥与额度**）。
- **可能支持不同模型**：文档示例与 REST 均支持显式 **`model.id`**；完整列表以 **`GET /v1/models`** 为准。
- **不影响 external API worker**：SDK 路线与现有 **用户自选模型/API 的 external worker** 并行；二者计费与数据路径不同，需在产品中区分配置与风险提示。

## 关键未知

- **`submit_worker_result` 对齐**：Cloud Run 的 **终端状态 / SSE `result` / tool 事件** 如何稳定映射为 Chief-of-Staff 的 **done / blocked / failed** 与备注字段；失败类是否需人工二次标注。
- **工作区语义**：**本地 `cwd`** 与 **云上克隆的 GitHub 仓库** 在「仅本地修改未 push」时是否可满足任务；Chief-of-Staff 的 **allowed_files** 是否在 SDK 路径下具备同等约束力（属产品/安全策略，非 SDK 自动保证）。
- **结果形态**：是否总能得到便于入库的 **summary** 或 **统一 diff**；**Artifacts** 与 **PR 链接** 是否足以替代当前任务包 + 结果文件约定。
- **并发与生命周期**：REST 文档注明 **同一 Agent 同时仅一个 active Run**（忙则 `409`）；与 Chief-of-Staff 多任务并行策略如何协调。
- **beta 稳定性**：**v1 API / SDK public beta**，架构与字段可能变化；需锁定版本与回归策略。
- **合规与费用**：组织是否允许将 **Cursor API Key** 用于自动化；**token 计费**与预算告警。

## 推荐下一步

1. **阅读**官方 [TypeScript SDK 文档](https://cursor.com/docs/sdk/typescript) 与 [Cloud Agents OpenAPI](https://cursor.com/docs-static/cloud-agents-openapi.yaml)，并对照 [cookbook](https://github.com/cursor/cookbook) 跑通最小示例。
2. **做最小 PoC**（独立脚本或分支）：单次 `Agent.create` → `send` → `stream`/`wait`，记录终态与事件形状；**不要**接入 Chief-of-Staff 生产 MCP 路径直至评审通过。
3. **设计 `dispatch_cursor_worker` 之前**：确认 **认证方式、团队策略、计费账户、Run/Artifact 与 tasks.json 字段映射**；明确 **云优先 vs 本地优先** 的默认策略。
4. **定价与促销**：任何「SDK 专属折扣」均以 **Cursor 官网 / Dashboard** 当期说明为准，实施前由负责人确认。

## 对产品路线的影响

- **若经 PoC 验证可行**：Cursor SDK / Cloud Agents 可作为 **Cursor 工兵自动化主路线（可选）**，与 **手动任务包** 并存；编排层可「能自动则自动，不能则 fallback」。
- **若验证受限**（成本、合规、仅云仓库、beta 变更频繁等）：**继续以手动任务包为主**，SDK 仅作实验或企业定制。
- **external API worker route**：**保持独立**；SDK 使用的是 Cursor 侧托管能力与计费，不与用户自配 DashScope/OpenAI 等混为一谈。

---

## 调研问题逐条简答

1. **当前是什么？**  
   官方 **TypeScript SDK（`@cursor/sdk`）** + **Cloud Agents API v1（public beta）**，用于程序化创建 Agent、提交 prompt、流式查看执行、管理 Run 与 Artifacts 等。

2. **官方文档或 public examples？**  
   有：[SDK TypeScript 文档](https://cursor.com/docs/sdk/typescript)、[Cloud Agents API 概览](https://cursor.com/docs/background-agent/api/overview)、[Changelog / 公告](https://cursor.com/changelog/sdk-release)、[Blog](https://cursor.com/blog/typescript-sdk)、公开示例仓库 **[github.com/cursor/cookbook](https://github.com/cursor/cookbook)**。

3. **是否支持 programmatically call agents？**  
   **支持**（SDK 与 REST 均体现创建与驱动 Agent/Run 的流程）。

4. **是否支持 CI/CD 调用？**  
   **官方叙述支持**；实现上为在 CI 中运行 Node 并调用 SDK/HTTP，**需自行管理密钥与安全**。

5. **是否支持指定模型（如 Composer 2）？**  
   **支持在 API/SDK 中指定 `model.id`**；文档示例出现 **`composer-2`**；完整列表以 **`GET /v1/models`** 为准。

6. **是否能访问项目文件 / repo context？**  
   **本地模式**：示例使用 **`local: { cwd }`**。  
   **云端模式**：文档要求 **GitHub `repos` URL** 等，Agent 在 **克隆的仓库环境** 中工作。  
   **与「当前打开但未提交的本地工作区」是否一致** 依赖工作流，**未在本文档中实测**。

7. **是否能返回执行结果、diff、summary？**  
   **可获取 SSE 流式文本、工具事件、Run 终态**；**Artifacts 列表与下载**；可选 **自动开 PR** 等。  
   **是否等价于 Chief-of-Staff 所需的「结构化 summary + 可读 diff」** — **部分可行、格式需 PoC 对齐**。

8. **是否能从本地 MCP server 或 Node.js 脚本调用？**  
   **Node.js 脚本：可以**（官方 npm 包）。  
   **MCP server 内：工程上可集成 SDK 或 `fetch` REST**，但属新依赖与密钥流，**需单独安全与架构评审**；**非本仓库当前实现**。

9. **认证方式是什么？**  
   文档：**Basic Authentication**，**用户 API Key**（Dashboard → Integrations）或 **service account API Key**（企业文档链接见 API overview）。

10. **费用 / 折扣信息是什么？**  
    官方 changelog：**按标准 token 消耗计费**。  
    市场「**50% off Composer 2 through the SDK**」类表述：**必须以 Cursor 当期定价与活动规则为准**；历史社区讨论中存在**限时活动**与 **cache-read 计费**导致的「折扣显示」，**不作为长期承诺**写入产品规格。

11. **是否适合未来新增 `dispatch_cursor_worker`？**  
    **部分适合**：方向与官方能力匹配，但需完成 **映射、费用、仓库模型、失败处理** 的 PoC 后才能定案。

12. **能否替代当前手动 Cursor Agent 任务包？**  
    **不能完全替代**：在 **无云权限/无 Key/仅本地未同步变更/策略限制** 等情况下，**手动任务包路径仍应保留**。

13. **当前限制和未知点是什么？**  
    **public beta**、**API 变更**、**云侧以 GitHub 为中心**、**单 Agent 并发 Run 限制**、**与 `.chief` 状态机的精确对齐**、**费用与合规模型**等（详见「关键未知」）。

14. **需要用户确认或进一步实测什么？**  
    组织是否允许使用 **Cursor API Key** 于自动化；**预算与配额**；**PoC 仓库**（公开/私有）与 **GitHub App** 权限；**Run 终态与 Artifacts** 是否满足审计与回滚需求；**SDK 版本锁定**策略。
