import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function safeParse(jsonText) {
  try { return JSON.parse(jsonText); } catch { return null; }
}

const inputText = fs.readFileSync(0, "utf8");
const payload = safeParse(inputText);
if (!payload) process.exit(0);

const toolName = payload.tool_name;
if (toolName !== "Write" && toolName !== "Edit") process.exit(0);

const abs = payload?.tool_input?.file_path;
if (!abs || typeof abs !== "string") process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
try { process.chdir(projectDir); } catch {}

const rel = path.relative(projectDir, abs);
// Only format files inside the project directory
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);

spawnSync("./scripts/format.sh", [rel], {
  stdio: "ignore",
  env: process.env
});

// Never fail Claude's flow because formatting failed
process.exit(0);
