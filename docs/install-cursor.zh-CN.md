# 在 Cursor 中安装 Chief-of-Staff

英文产品介绍与 Cursor 配置要点见仓库根目录 [README.md](../README.md)。

**推荐方式不是「只安装 MCP」**，而是**初始化整个 Chief-of-Staff 项目工作区**（MCP + 默认 Cursor rule + `.chief/`）。否则 Agent 很容易仍表现为**普通编程助手**。

## 当前状态

- npm 包当前版本以 `chief-mcp-server/package.json` 为准；**v0.1.1** 起提供 **`npx chief-of-staff-mcp init`** 一键初始化。
- **优先**支持 **Cursor MCP**；不宣称已支持 Claude Code、Trae、Workbody 等其他平台。
- **npm 发布前**：可用本地构建后的 `dist/server.js` 路径安装。
- **npm 发布后**：推荐在**每个新项目根目录**运行一次 `init`；亦可手动配置 `npx`（见下文方式 B）。

## 推荐方式（npm）：`init` 一键初始化

在**要被参谋管理的目标项目根目录**执行（将路径换成你的项目）：

```powershell
cd 你的项目
npx chief-of-staff-mcp init
```

`init` 会在当前目录（`process.cwd()`）下按需创建（已存在则**跳过、不覆盖**）：

```text
.cursor/mcp.json
.cursor/rules/chief-of-staff.mdc
.chief/
```

具体包括：`.cursor/mcp.json`（可与其他 MCP **合并**）、`.cursor/rules/chief-of-staff.mdc`（`alwaysApply: true`）、`.chief/tasks.json`、`.chief/agent-tasks/`、`.chief/results/`、默认 `.chief/config.json`（**不**写入任何 API Key）。

必须强调：

```text
只装 MCP 不等于进入参谋模式。
参谋模式依赖 .cursor/rules/chief-of-staff.mdc。
```

- **主参谋（Chief）默认不直接写应用代码**；默认通过两条**工兵**路线落地实现：
  1. **Cursor Agent Worker**：参谋用 `prepare_cursor_agent_task` 准备任务包；你在 Cursor 里**新开 Agent 窗口**，把任务包交给工兵执行。
  2. **External API Worker**：你在环境变量等配置**自己的模型 API** 后，参谋通过 `chief_external_preflight` / `dispatch_worker` 派发（工具**不显示**密钥值）。
- 新 Agent Chat 的期望开场顺序：先说明参谋工作方式（主参谋角色、默认不直接写代码、两条工兵路线、后续可切换路线）→ 再问当前目标的关键选择 → 再给建议。
- 路线选择应中性说明差异：  
  - **Cursor Agent Worker**：参谋准备任务包，你在单独 Cursor Agent 窗口执行本地实现；完成后把工兵摘要带回主参谋。  
  - **External API Worker**：你已配置 provider/model/API 时，参谋可先 preflight 再 dispatch，经 Chief-of-Staff 流程返回结果。  
  请由用户明确选择路线；不要默认替用户拍板。
- **“好 / 可以 / 继续 / 嗯”不等于批准执行**：这些短确认仅表示继续对话，不自动等于允许登记任务、准备任务包、派发工兵或改文件。进入实施前应先总结方向并取得明确确认。
- **每个项目初始化一次**即可；重复执行安全，已存在文件会显示为 skipped。
- 初始化后请在 Cursor 中**打开该项目**，**重启或重载** MCP 如有需要，并在**该项目窗口内**新建 Agent Chat 验证。**Cursor Home / 全局 Agent** 仍可能无法加载项目级 MCP（见下文）。

运行 `init` 后，请**重启 / Reload Cursor**，并在 Cursor 的 **MCP 设置**里确认 **`chief-of-staff` 已启用**。部分 Cursor 版本会把新添加的 MCP server **默认置为未启用**，需要用户**手动打开**后，Agent Chat 才能看到 Chief-of-Staff 工具。这是 Cursor 的**正常权限/安全行为**，**不代表** Chief-of-Staff 安装失败。

### 如果 MCP 第一次是关闭的

这是正常情况。请在 Cursor **MCP 设置**里手动**启用** `chief-of-staff`，然后 **Reload / Restart Cursor**。

## 模型使用建议：强模型做参谋，其他模型做工兵

Chief-of-Staff 的**常见用法**（非硬性规定）是：

- **主参谋 Chief** 使用**更强的推理模型**，负责方向、记忆、决策、拆解、派工和验收。
- **Cursor Agent Worker** 可以在**单独的 Cursor Agent 窗口**里选择**适合执行**的模型（例如更快、更便宜或更偏代码实现的模型）。
- **External API Worker** 可以通过 **provider/model/API** 配置选择**外部工兵**模型。

这样可以把**高质量思考与协调**留给主参谋，把**具体执行**交给更快、更便宜或更专门的工兵模型。

**注意：** Chief-of-Staff **不会**强制替你切换 Cursor 里的模型。Cursor 侧模型仍由你在 **Cursor 界面**中选择；本产品负责组织工作流，不伪装成能自动控制所有模型选择。

## 方式 A：本地开发安装

1. 克隆或下载本仓库。
2. 进入 `chief-mcp-server` 目录。
3. 运行 `npm install`。
4. 运行 `npm run build`。
5. 在 Cursor 的 MCP 配置中加入 `node` + 本机上的 `dist/server.js` 绝对路径。推荐：复制仓库根目录下的 `.cursor/mcp.json.example` 为 `.cursor/mcp.json`，再把其中的占位路径全部替换为你本机的真实路径（**不要**把含个人绝对路径的 `mcp.json` 提交到团队仓库）。

示例（请把路径换成你的实际路径；`cwd` 必须指向本仓库**根目录**，`args` 必须指向 `chief-mcp-server/dist/server.js`）：

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "node",
      "args": ["C:/Users/<you>/path/to/chief-of-staff/chief-mcp-server/dist/server.js"],
      "cwd": "C:/Users/<you>/path/to/chief-of-staff"
    }
  }
}
```

Windows 上请使用你的真实盘符与目录；反斜杠可写成 `/` 或按 Cursor 要求转义。macOS / Linux 用户请将上述路径改为本机风格（例如 `/home/<you>/path/to/chief-of-staff/...`），规则相同：`cwd` 为仓库根，`args` 指向该仓库内 `chief-mcp-server/dist/server.js`。

## 方式 B：npm 发布后安装

**重要：** 只有包**已在 npm 发布**、且你能在 registry 上查到该包名之后，才可以使用 `npx` + 包名安装。**发布前**请始终使用上文「方式 A：本地开发安装」，不要依赖 `npx`。

包发布且名称确认后，可使用 `npx`（以下示例与当前 `chief-mcp-server/package.json` 中的 `name` 一致；若将来改名，以 `package.json` 为准）：

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "npx",
      "args": ["-y", "chief-of-staff-mcp"]
    }
  }
}
```

**注意**：本文档不表示包已在 npm 上发布；发布前请参见 [docs/npm-release-checklist.zh-CN.md](./npm-release-checklist.zh-CN.md)。

## 重要：在项目窗口内测试 MCP

- **项目级** `.cursor/mcp.json` 只在**打开该项目文件夹之后**才会被 Cursor 可靠加载并与该项目绑定。
- 请先**用 Cursor 打开目标项目**（打开本仓库根目录或你的 Chief-of-Staff 工作副本）。
- 在**该项目窗口内**新建 **Agent Chat / Agent Window** 再测试 MCP 工具。
- **不要**从 **Cursor Home / 全局 Agent** 界面新建对话来测试**项目级** MCP：该环境可能没有当前项目上下文，工具列表里可能**看不到**本项目的 MCP；这**不代表** MCP 未安装成功。
- 若看不到 Chief-of-Staff 工具，请先确认：当前 Agent 是否属于**已打开目标项目**的那一个窗口。

### 使用 `mcp.json.example`（本地路径）

1. 复制 `.cursor/mcp.json.example` 为 `.cursor/mcp.json`。
2. 将 JSON 中的占位路径改为你**自己机器上**的绝对路径；**勿**将含个人隐私路径的 `mcp.json` 提交到远程仓库。
3. **`cwd`** 必须指向 **Chief-of-Staff 项目根目录**（与 `package.json` / `.chief` 所在层级一致）。
4. **`args`** 中的脚本路径必须指向 **`chief-mcp-server/dist/server.js`**（须先在该目录执行 `npm run build`）。
5. 修改 MCP 配置后**重启 Cursor**，再在**项目窗口内**的 Agent 中验证工具是否出现。

## 安装后测试

在 Cursor 中对话：

```text
检查 Chief-of-Staff 项目状态。
```

预期会调用 `chief_doctor`。

也可以问：

```text
下一步做什么？
```

预期会调用 `chief_next_action`。

## 常见问题

**Cursor 里看不到 MCP 工具？**

- 重启 Cursor。
- 核对 MCP 配置里的 `node` 路径与 `dist/server.js` 是否存在。
- 确认已在 `chief-mcp-server` 下执行过 `npm run build` 且无报错。

**是否需要 API Key？**

- 仅使用 Cursor 工兵路线时，**不需要**外部 API Key。
- 使用外部 API 工兵（`dispatch_worker` 等）时，需在环境变量中配置对应 Key；工具不会把 Key 显示在输出里。

**能不能自动打开 Cursor Agent 子窗口？**

- **不能**。

**能不能自动 Rename Agent？**

- **不能**；需在 Cursor 中**手动**右键 Rename。
