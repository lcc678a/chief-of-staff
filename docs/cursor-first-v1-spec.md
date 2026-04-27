# Chief-of-Staff Cursor-first v1 产品规格

## 1. 产品定位

Chief-of-Staff 是一个面向 Cursor 用户的 AI 项目参谋系统，核心目标是帮助用户在 Cursor 内持续推进项目，而不是替代 Cursor 本身。目标用户是 vibe coding 业余创新者：愿意尝试新工具，但不希望把大量时间耗在配置、报错排查、上下文整理和流程管理上。

在 v1 阶段，用户主要通过 `@chief-of-staff` 在一个参谋窗口中进行交互。参谋负责把需求拆分为可执行任务、选择合适的工兵路线、追踪执行状态，并将结果和下一步行动建议汇总回主窗口。

## 2. 一句话定义

Chief-of-Staff 是 Cursor 里的 AI 参谋长，负责把用户的想法拆成任务，选择合适的工兵路线执行，并把状态、结果和下一步行动带回主窗口。

## 3. 核心用户痛点

- 上下文混乱：需求、报错、改动和结论分散在多个对话或文件中，难以持续推进。
- 不知道下一步做什么：用户经常停在“该先做哪件事”的决策点，推进节奏中断。
- 安装和配置容易卡住：外部依赖、密钥、环境变量和接口兼容性让新手高频受挫。
- 任务没有状态：做了什么、做到哪一步、谁在执行、是否完成缺乏统一可追踪视图。
- 主模型窗口承担太多职责：既要分析、又要执行、还要管理流程，导致负担过重。
- 小问题消耗大量时间：低价值摩擦（报错定位、重复确认、切换上下文）持续放大总耗时。
- 多模型能力不会组织使用：用户知道有多种模型可选，但不知道何时选谁、如何协同。

## 4. 产品原则

- 用户本质只在一个参谋窗口推进：默认交互中心始终是 `@chief-of-staff` 主窗口。
- 工兵可以有多种执行路线：根据任务性质、成本和配置状态动态选择执行模式。
- 默认减少麻烦，而不是暴露复杂度：优先提供低门槛路径，再允许高级用户深入配置。
- 参谋必须透明说明使用哪种工兵路线：每次派发都要明确模式、模型来源和预期成本。
- 高风险操作必须确认：涉及覆盖、删除、批量修改、外部调用开销时需要显式确认。
- 配置失败必须可诊断：失败时给出可执行的定位信息、日志线索和下一步修复建议。
- 中英文从 v1 起纳入设计：提示语、任务包、状态说明和汇报结果支持双语表达能力。

## 5. 三种工兵路线

### 5.1 Cursor Agent Worker

Cursor Agent Worker 是 Cursor-first 的默认推荐路线。参谋先创建任务包，再引导用户在 Cursor Agents Window 或新 Agent 中打开工兵执行任务。用户可以在该工兵窗口选择 Cursor 自带模型（例如 Auto、Composer、Sonnet、Opus）。工兵完成后，通过 `submit_worker_result` 或写入 `.chief/outbox/task-id.md` 回传结果，主参谋读取后在主窗口统一汇报。

优点：
- 可使用 Cursor 自带模型和额度。
- 不需要外部 API key。
- 更适合新手快速上手。
- 可利用 Cursor 3+ 多 Agent 能力协作推进。

限制：
- 目前不是完全自动流程。
- 需要用户手动开工兵窗口或确认任务包。
- MCP server 不能直接控制 Cursor UI 或直接调用 Cursor 模型。
- 实际模型信息可能需要用户或工兵在结果中回填。

### 5.2 External Worker

External Worker 是当前已实现雏形的后台工兵路线。MCP server 启动本地 worker 子进程，worker 调用 DashScope、OpenAI-compatible、DeepSeek 等外部 API，过程中写日志、回填状态，并返回摘要结果给主参谋。

优点：
- 真后台执行。
- 可自动化调度。
- 可并发处理多个任务。
- 状态与日志可控且可追踪。
- 适合批量任务和长任务。

限制：
- 需要配置 API key。
- 可能产生额外费用。
- 对新手有较高配置门槛。

### 5.3 Host-assisted Worker

Host-assisted Worker 指当前参谋窗口里的模型临时扮演工兵执行任务。相关工具负责任务登记和结果归档，适合非常小的任务或追求零配置体验的场景。

优点：
- 不用 API key。
- 不用新窗口。
- 上手最快。

限制：
- 不是真后台。
- 不是真并发。
- 会占用主窗口上下文。
- 不适合长任务。

## 6. 用户视角流程

### 6.1 默认 Cursor Agent Worker 流程

示例：

用户：  
`@chief-of-staff 帮我分析这个报错，派一个 Cursor 工兵，用 Sonnet。`

参谋流程：
- 登记 `task-001`。
- 生成工兵任务包（目标、上下文、交付格式、回传方式）。
- 提示用户在 Cursor Agents Window 新建 Agent 并选择 Sonnet。
- 工兵执行后通过 `submit_worker_result` 或 `.chief/outbox/task-001.md` 提交结果。
- 主窗口读取结果并汇报结论、风险与下一步动作。

### 6.2 External Worker 流程

示例：

用户：  
`@chief-of-staff 帮我用 cheap 外部工兵总结 README 结构。`

参谋流程：
- 登记 `task-001`。
- 派发 external worker。
- 显示 provider / model 信息。
- 查询执行状态与日志摘要。
- 汇报最终摘要与后续建议。

## 7. 主模型与工兵模型边界

- 主模型由 Cursor 用户自己选择，并在参谋主窗口承担参谋角色。
- 主模型职责是拆任务、派工、追踪状态、整合结果和给出下一步建议。
- MCP server 不能直接调用 Cursor Auto、Composer、Sonnet、Opus 等 Cursor 内置模型。
- Cursor Agent Worker 是通过另开 Cursor Agent 窗口，曲线使用 Cursor 模型能力。
- External Worker 使用外部 API 模型，模型来源和费用归属与 Cursor 内置模型不同。
- 最终汇报必须显示工兵路线和模型信息，确保用户可理解、可追溯、可复盘。

## 8. 配置目标

未来配置目标应支持如下结构：

```json
{
  "version": 1,
  "locale": "zh-CN",
  "host": "cursor",
  "preferred_worker_mode": "cursor_agent",
  "external_worker": {
    "default_provider": "dashscope"
  },
  "toolpacks": {
    "enabled": ["core"]
  }
}
```
