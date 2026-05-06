import path from "node:path";

export const PROJECT_ROOT = process.cwd();
export const CHIEF_DIR = path.join(PROJECT_ROOT, ".chief");
export const TASKS_FILE = path.join(CHIEF_DIR, "tasks.json");
export const LOGS_DIR = path.join(CHIEF_DIR, "logs");
export const RESULTS_DIR = path.join(CHIEF_DIR, "results");
export const CONFIG_FILE = path.join(CHIEF_DIR, "config.json");
