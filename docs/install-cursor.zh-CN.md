# 在 Cursor 中安装 Chief-of-Staff

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
5. 在 Cursor 的 MCP 配置中加入 `node` + 本机上的 `dist/server.js` 绝对路径。

示例（请把路径换成你的实际路径）：

```json
{
  "mcpServers": {
    "chief-of-staff": {
      "command": "node",
      "args": ["C:/Users/<you>/path/to/chief-of-staff/chief-mcp-server/dist/server.js"]
    }
  }
}
```

Windows 上请使用你的真实盘符与目录；反斜杠可写成 `/` 或按 Cursor 要求转义。

## 方式 B：npm 发布后安装

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
