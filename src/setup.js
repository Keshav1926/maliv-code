// maliv-code — one-command full-stack setup.
//   1. opencode        — official npm package (installed if missing)          [required]
//   2. oh-my-opencode  — pinned version wired into config (npm fetches it)     [required]
//   3. maliv           — plugin wired into tui.json                            [required]
//   4. playwright MCP  — wired into the opencode config                        [extra]
//   5. openspec CLI    — @fission-ai/openspec (npm)                            [extra]
//   6. graphify CLI    — graphifyy (PyPI, via uv/pip)                          [extra]
//   7. bundled skills  — karpathy-guidelines (MIT) + graphify → config/skills  [extra]
// Nothing is bundled/redistributed except the two skills under skills/. Every
// tool is installed from its official source. Use `maliv setup --minimal` to
// skip the extras (4-7).

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { setMode, ensureMcp, OMO_SPEC, PATHS } from "./config.js";

const c = { reset: "\x1b[0m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", red: "\x1b[31m" };
const say = (m) => process.stdout.write(m + "\n");
const step = (m) => say(`${c.cyan}▸${c.reset} ${m}`);
const ok = (m) => say(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => say(`${c.yellow}!${c.reset} ${m}`);
const win = process.platform === "win32";

function has(cmd) {
  return spawnSync(cmd, ["--version"], { stdio: "ignore", shell: win }).status === 0;
}
function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit", shell: win }).status === 0;
}
async function confirm(q, yes) {
  if (yes || !process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await new Promise((r) => rl.question(`${q} ${c.dim}[Y/n]${c.reset} `, r));
  rl.close();
  return !/^n/i.test(a.trim());
}

// Install the graphify (graphifyy on PyPI) Python CLI — prefer uv, fall back to pip.
function installGraphify() {
  if (has("uv")) return run("uv", ["tool", "install", "--upgrade", "graphifyy"]);
  const py = has("python3") ? "python3" : has("python") ? "python" : null;
  if (!py) return false;
  return run(py, ["-m", "pip", "install", "-U", "graphifyy"]) ||
         run(py, ["-m", "pip", "install", "-U", "--break-system-packages", "graphifyy"]);
}

// Copy the skills bundled with this package into ~/.config/opencode/skills/.
function installSkills() {
  const srcDir = fileURLToPath(new URL("../skills", import.meta.url));
  if (!existsSync(srcDir)) return [];
  const dest = join(PATHS.CONFIG_DIR, "skills");
  mkdirSync(dest, { recursive: true });
  const names = readdirSync(srcDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const n of names) cpSync(join(srcDir, n), join(dest, n), { recursive: true });
  return names;
}

export async function runSetup({ yes = false, mode = "complex", minimal = false } = {}) {
  say(`\n${c.cyan}maliv-code setup${c.reset} ${c.dim}— opencode + oh-my-opencode + maliv${minimal ? "" : " + tools + skills"}${c.reset}\n`);

  // 1) opencode (required)
  if (has("opencode")) ok("opencode already installed");
  else {
    warn("opencode not found");
    if (!(await confirm("Install opencode now (npm i -g opencode-ai)?", yes))) {
      say(`${c.red}aborted${c.reset} — install opencode first, then re-run: maliv setup`);
      return 1;
    }
    step("installing opencode…");
    if (!run("npm", ["i", "-g", "opencode-ai"])) { say(`${c.red}✗ opencode install failed${c.reset}`); return 1; }
    ok("opencode installed");
  }

  // 2)+3) wire oh-my-opencode (pinned) + maliv, default complex
  mkdirSync(PATHS.CONFIG_DIR, { recursive: true });
  step(`wiring oh-my-opencode (${OMO_SPEC}) + maliv…`);
  setMode(mode);
  ok(`config wired (${mode} mode)`);

  if (!minimal) {
    // 4) playwright MCP
    if (ensureMcp("playwright", { type: "local", enabled: true, command: "npx", args: ["@playwright/mcp@latest"] }))
      ok("playwright MCP added"); else ok("playwright MCP already configured");

    // 5) openspec CLI
    if (has("openspec")) ok("openspec already installed");
    else { step("installing openspec (@fission-ai/openspec)…"); run("npm", ["i", "-g", "@fission-ai/openspec"]) ? ok("openspec installed") : warn("openspec install skipped/failed"); }

    // 6) graphify CLI (graphifyy on PyPI)
    if (has("graphify")) ok("graphify already installed");
    else { step("installing graphify (graphifyy via uv/pip)…"); installGraphify() ? ok("graphify installed") : warn("graphify install skipped/failed (needs uv or pip)"); }

    // 7) bundled skills → config/skills (loaded by oh-my-opencode in complex mode)
    const skills = installSkills();
    if (skills.length) ok(`skills installed: ${skills.join(", ")}`);
  }

  say(`\n${c.green}done.${c.reset} start with:  ${c.cyan}maliv${c.reset}`);
  say(`${c.dim}  maliv            complex mode, new session`);
  say(`  maliv simple     vanilla opencode`);
  say(`  maliv -c | -s <id>   continue last / specific session${c.reset}\n`);
  return 0;
}
