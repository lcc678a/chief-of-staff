# 在 Cursor 中安装 Chief-of-Staff

英文产品介绍与 Cursor 配置要点见仓库根目录 [README.md](../README.md)。

## 当前状态

- 当前为 **v0.1 candidate**。
- **优先**支持 **Cursor MCP**；不宣称已支持 Claude Code、Trae、Workbody 等其他平台。
- **npm 发布前**：可用本地构建后的 `dist/server.js` 路径安装。
- **npm 发布后**：可用 `npx` + 包名安装（以 `chief-mcp-server/package.json` 的 `name` 为准）。

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
