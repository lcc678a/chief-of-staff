# npm 发布检查清单

## 发布前必须检查

- `git status` 干净（无意外未提交文件）
- 在 `chief-mcp-server` 下 `npm run build` 通过
- `npm pack --dry-run` 结果只包含必要文件（如 `dist`、`README.md`、`package.json`）
- `package.json` 的 `name` / `version` / `description` / `bin` / `files` 正确
- README 中**没有**假装已经发布到 npm
- 没有提交 `.chief/tasks.json` 等测试污染
- 文档与仓库中**没有** API Key
- Cursor 本地 MCP 配置能启动该 server
- `chief_doctor` 可调用
- `chief_next_action` 可调用

## 不要做

- 不要提交真实 API Key
- 不要在未确认包名的情况下 `npm publish`
- 不要声称支持未实测的平台（如 Claude Code / Trae / Workbody）
- 不要覆盖用户的 `tasks.json` / `config.json`（产品行为上由 `chief_repair` 等保证；发布物本身也不应包含用户数据）

## 发布命令草案

以下仅为草案，**执行任务时不要自动执行** `npm publish`：

```bash
cd chief-mcp-server
npm login
npm publish --access public
```

若使用 **scoped package**（如 `@scope/name`），通常仍需 `--access public` 才能公开安装。
