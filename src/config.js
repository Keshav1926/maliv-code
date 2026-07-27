// maliv-code — opencode config wiring + mode switching.
//
// Surgically toggles oh-my-opencode in the opencode config while ALWAYS keeping
// the maliv plugin loaded, so /maliv-mode works in both modes:
//   complex: oh-my-opencode ON  (opencode.jsonc + tui.json) + maliv (tui.json)
//   simple : oh-my-opencode OFF                              + maliv (tui.json)
// Preserves every other plugin/key. Atomic writes. Idempotent.
//
// We DEPEND on oh-my-opencode via npm (never bundle its code) and pin a tested
// version. Bump OMO_SPEC in a new maliv-code release after re-testing.

import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const OMO_SPEC = "oh-my-openagent@4.19.1"; // pinned, tested version
export const CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_JSONC = join(CONFIG_DIR, "opencode.jsonc");
const OPENCODE_JSON = join(CONFIG_DIR, "opencode.json");
const TUI_JSON = join(CONFIG_DIR, "tui.json");

// file:// URL to this package's plugin entry (works when installed globally or local).
export const MALIV_PLUGIN_URL = new URL("./plugin.js", import.meta.url).href;

const isOmo = (e) => typeof e === "string" && /oh-my-open(agent|code)/.test(e);
const isMaliv = (e) => typeof e === "string" && e.includes("maliv");

function readJson(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
  } catch { return null; }
}
function writeAtomic(path, obj) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}
const dropOmo = (arr) => (arr || []).filter((e) => !isOmo(e));
const dropMaliv = (arr) => (arr || []).filter((e) => !isMaliv(e));
const ensure = (arr, v) => (arr.includes(v) ? arr : [...arr, v]);

// mode: "simple" | "complex". Idempotent. Returns a short summary.
export function setMode(mode) {
  const complex = mode === "complex";

  // server plugins (opencode.jsonc): toggle oh-my-opencode only (maliv is TUI-only)
  {
    const c = readJson(OPENCODE_JSONC) || { "$schema": "https://opencode.ai/config.json" };
    let arr = dropOmo(Array.isArray(c.plugin) ? c.plugin : []);
    if (complex) arr = ensure(arr, OMO_SPEC);
    c.plugin = arr;
    writeAtomic(OPENCODE_JSONC, c);
  }
  // safety: keep opencode.json in sync only if it already declares plugins
  if (existsSync(OPENCODE_JSON)) {
    const c = readJson(OPENCODE_JSON);
    if (c && Array.isArray(c.plugin)) {
      let arr = dropOmo(c.plugin);
      if (complex) arr = ensure(arr, OMO_SPEC);
      c.plugin = arr;
      writeAtomic(OPENCODE_JSON, c);
    }
  }
  // tui plugins (tui.json): ALWAYS keep maliv; toggle oh-my-opencode
  {
    const c = readJson(TUI_JSON) || {};
    let arr = dropMaliv(dropOmo(Array.isArray(c.plugin) ? c.plugin : []));
    arr = ensure(arr, MALIV_PLUGIN_URL);
    if (complex) arr = ensure(arr, OMO_SPEC);
    c.plugin = arr;
    writeAtomic(TUI_JSON, c);
  }
  return `config set to ${mode} mode`;
}

// Add an MCP server to the opencode config if not already present (in either
// opencode.jsonc or opencode.json). Non-destructive; preserves other mcp entries.
export function ensureMcp(name, spec) {
  const inJson = (() => { const c = readJson(OPENCODE_JSON); return c && c.mcp && c.mcp[name]; })();
  const c = readJson(OPENCODE_JSONC) || { "$schema": "https://opencode.ai/config.json" };
  if ((c.mcp && c.mcp[name]) || inJson) return false; // already configured somewhere
  c.mcp = { ...(c.mcp || {}), [name]: spec };
  writeAtomic(OPENCODE_JSONC, c);
  return true;
}

// Is oh-my-opencode currently wired (i.e., are we in complex on disk)?
export function currentMode() {
  const c = readJson(OPENCODE_JSONC);
  return c && Array.isArray(c.plugin) && c.plugin.some(isOmo) ? "complex" : "simple";
}

export const PATHS = { OPENCODE_JSONC, OPENCODE_JSON, TUI_JSON, CONFIG_DIR };
export { fileURLToPath };
