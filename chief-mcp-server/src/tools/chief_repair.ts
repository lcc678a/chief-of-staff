import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ensureChiefBaseline } from "../lib/ensure_chief_baseline.js";
import { PROJECT_ROOT } from "../lib/paths.js";

export const chiefRepairInputSchema = z.object({
  dry_run: z.boolean().optional()
});

const RULES_FILE = path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function chiefRepair(rawInput: unknown): Promise<string> {
  const input = chiefRepairInputSchema.parse(rawInput);
  const dryRun = input.dry_run === true;

  const baselineItems = await ensureChiefBaseline(PROJECT_ROOT, { dryRun });

  const repaired: string[] = [];
  const planned: string[] = [];
  const ok: string[] = [];
  const manual: string[] = [];

  for (const item of baselineItems) {
    if (item.kind === "created") {
      repaired.push(item.display);
    } else if (item.kind === "planned") {
      planned.push(item.display);
    } else if (item.kind === "skipped_ok") {
      ok.push(item.display);
    } else if (item.kind === "manual") {
      manual.push(item.display);
    }
  }

  if (await pathExists(RULES_FILE)) {
    ok.push("`.cursor/rules/chief-of-staff.mdc`：存在");
  } else {
    manual.push(
      "`.cursor/rules/chief-of-staff.mdc`：**不存在**，不自动生成；请从仓库或备份恢复规则文件，或运行 `npx chief-of-staff-mcp init`。"
    );
  }

  const modeLine = dryRun ? "模式：预演（`dry_run=true`，不写入磁盘）" : "模式：实际修复";
  const lines: string[] = [`# Chief-of-Staff 修复`, ``, modeLine, ``];

  const actionSectionTitle = dryRun ? "## 预演：将执行的操作" : "## 已修复";
  const actionItems = dryRun ? planned : repaired;

  if (actionItems.length > 0) {
    lines.push(actionSectionTitle, "");
    for (const item of actionItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (ok.length > 0) {
    lines.push("## 正常", "");
    for (const item of ok) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (manual.length > 0) {
    lines.push("## 需要人工处理", "");
    for (const item of manual) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (actionItems.length === 0 && ok.length > 0 && manual.length === 0) {
    lines.push("当前检查路径均已就绪，无需创建或修复。", "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
