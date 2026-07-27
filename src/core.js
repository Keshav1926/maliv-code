// maliv-code — core engine (pure Node/Bun ESM, no opencode deps).
//
// Owns:
//   1. The model-tree store + resolver, compiled into oh-my-opencode's
//      oh-my-openagent.json (subagent/category models). Applied on next launch.
//   2. The on-screen (primary agent) model = opencode's picker state model.json.
//   3. The mode marker used to hand an in-app simple/complex switch to the CLI.
//
// Model resolution tree (most specific wins):
//   agent override  >  category override  >  "all" override  >  baseline

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync, rmSync } from "node:fs";

const HOME = homedir();
export const CONFIG_DIR = join(HOME, ".config", "opencode");
export const OMO_CONFIG = join(CONFIG_DIR, "oh-my-openagent.json");
export const STORE_DIR = join(HOME, ".maliv");
export const STORE_FILE = join(STORE_DIR, "overrides.json");
export const BASELINE_FILE = join(STORE_DIR, "baseline.json");
export const OMO_BACKUP = join(STORE_DIR, "oh-my-openagent.first-backup.json");
export const MODE_MARKER = join(STORE_DIR, "next-mode");
export const SESSION_MARKER = join(STORE_DIR, "next-session");
// opencode's native model-picker state — recent[0] is the current on-screen model.
export const MODEL_STATE = join(HOME, ".local", "state", "opencode", "model.json");

// Authoritative from oh-my-opencode's BuiltinCategoryNameSchema — 8 tiers.
export const KNOWN_CATEGORIES = [
  "ultrabrain", "deep", "quick", "visual-engineering",
  "artistry", "writing", "unspecified-low", "unspecified-high",
];

// Authoritative agent registry (BuiltinAgentNameSchema + live /agent modes).
// MAIN = primary mode (Tab-between; use the on-screen/UI-selected model).
// SUB  = subagent mode (spawned via task; own model from oh-my-openagent.json).
export const MAIN_AGENTS = [
  { key: "sisyphus",   label: "Sisyphus — ultraworker" },
  { key: "prometheus", label: "Prometheus — plan builder" },
  { key: "atlas",      label: "Atlas — plan executor" },
  { key: "hephaestus", label: "Hephaestus — deep (GPT-only)" },
];
export const SUB_AGENTS = [
  { key: "oracle",            label: "Oracle — deep reasoning / debugging" },
  { key: "explore",           label: "Explore — codebase search" },
  { key: "librarian",         label: "Librarian — external docs" },
  { key: "multimodal-looker", label: "Multimodal-looker — images / visual" },
  { key: "metis",             label: "Metis — plan consultant" },
  { key: "momus",             label: "Momus — plan critic" },
  { key: "sisyphus-junior",   label: "Sisyphus-Junior — worker" },
];
export const MAIN_KEYS = MAIN_AGENTS.map((a) => a.key);
export const ALL_AGENTS = [...MAIN_AGENTS, ...SUB_AGENTS].map((a) => a.key);
export function isMainAgent(key) { return MAIN_KEYS.includes(key); }

export function defaultStore() {
  return { version: 1, modelOverrides: { all: null, categories: {}, agents: {} } };
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    const raw = readFileSync(path, "utf8");
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(stripped);
  } catch { return fallback; }
}

function writeJsonAtomic(path, obj) {
  mkdirSync(STORE_DIR, { recursive: true });
  const tmp = `${path}.tmp-${process.pid}-${globalThis.performance ? Math.floor(performance.now()) : "t"}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

export function loadStore() {
  const s = readJson(STORE_FILE, null);
  if (!s) return defaultStore();
  return {
    version: s.version || 1,
    modelOverrides: {
      all: s.modelOverrides?.all ?? null,
      categories: { ...(s.modelOverrides?.categories || {}) },
      agents: { ...(s.modelOverrides?.agents || {}) },
    },
  };
}

export function saveStore(store) { writeJsonAtomic(STORE_FILE, store); }

export function ensureBaseline() {
  mkdirSync(STORE_DIR, { recursive: true });
  if (!existsSync(BASELINE_FILE)) {
    const current = readJson(OMO_CONFIG, {});
    writeJsonAtomic(BASELINE_FILE, current);
    try { if (existsSync(OMO_CONFIG)) copyFileSync(OMO_CONFIG, OMO_BACKUP); } catch {}
  }
  return readJson(BASELINE_FILE, {});
}

export function loadBaseline() { return readJson(BASELINE_FILE, {}); }

// ---- resolution ----------------------------------------------------------

export function resolveCategoryModel(store, baseline, cat) {
  return (
    store.modelOverrides.categories[cat] ??
    store.modelOverrides.all ??
    baseline?.categories?.[cat]?.model ??
    null
  );
}

function hasAnyCategoryOverride(store) {
  return Object.keys(store.modelOverrides.categories || {}).length > 0;
}

// Compile store + baseline -> oh-my-openagent.json content. Non-destructive.
export function compileOmoConfig(store, baseline) {
  const out = structuredClone(baseline || {});
  out.categories = { ...(out.categories || {}) };
  out.agents = { ...(out.agents || {}) };

  for (const c of new Set([...KNOWN_CATEGORIES, ...Object.keys(out.categories)])) {
    const model = resolveCategoryModel(store, baseline, c);
    if (model) out.categories[c] = { ...(out.categories[c] || {}), model };
  }

  const hasCat = hasAnyCategoryOverride(store);
  const hasAll = store.modelOverrides.all != null;
  for (const a of new Set([...ALL_AGENTS, ...Object.keys(out.agents)])) {
    const leaf = store.modelOverrides.agents[a];
    if (leaf) {
      out.agents[a] = { ...(out.agents[a] || {}), model: leaf };
    } else if (hasCat) {
      // category overrides active: drop the agent model, let oh-my-opencode cascade from its category
      if (out.agents[a] && "model" in out.agents[a]) {
        const { model, ...rest } = out.agents[a];
        if (Object.keys(rest).length) out.agents[a] = rest; else delete out.agents[a];
      }
    } else if (hasAll) {
      out.agents[a] = { ...(out.agents[a] || {}), model: store.modelOverrides.all };
    } else {
      const base = baseline?.agents?.[a];
      if (base) out.agents[a] = structuredClone(base); else delete out.agents[a];
    }
  }
  return out;
}

export function applyStore(store) {
  try {
    const baseline = ensureBaseline();
    if (!baseline || !baseline.agents || Object.keys(baseline.agents).length === 0) {
      return { ok: false, error: "baseline not captured (oh-my-openagent.json empty/missing); refusing to write" };
    }
    writeJsonAtomic(OMO_CONFIG, compileOmoConfig(store, baseline));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ---- mutations -----------------------------------------------------------

export function setModelOverride(store, level, target, modelId) {
  if (level === "all") store.modelOverrides.all = modelId || null;
  else if (level === "category") store.modelOverrides.categories[target] = modelId;
  else if (level === "agent") store.modelOverrides.agents[target] = modelId;
  return store;
}

export function clearModelOverride(store, level, target) {
  if (level === "all") store.modelOverrides.all = null;
  else if (level === "category") delete store.modelOverrides.categories[target];
  else if (level === "agent") delete store.modelOverrides.agents[target];
  return store;
}

export function effectiveModel(store, baseline, level, target) {
  if (level === "all") return store.modelOverrides.all ?? null;
  if (level === "category") return resolveCategoryModel(store, baseline, target);
  if (level === "agent") return store.modelOverrides.agents[target] ?? baseline?.agents?.[target]?.model ?? null;
  return null;
}

// ---- on-screen (primary) model = model.json recent[0] --------------------

function splitModelId(idStr) {
  const i = String(idStr).indexOf("/");
  if (i < 0) return null;
  return { providerID: idStr.slice(0, i), modelID: idStr.slice(i + 1) };
}

export function currentMainModel() {
  try {
    const s = JSON.parse(readFileSync(MODEL_STATE, "utf8"));
    const m = s?.recent?.[0];
    return m ? `${m.providerID}/${m.modelID}` : null;
  } catch { return null; }
}

export function setMainModel(idStr) {
  try {
    const parts = splitModelId(idStr);
    if (!parts) return { ok: false, error: "bad model id (expected provider/model)" };
    let state = {};
    try { state = JSON.parse(readFileSync(MODEL_STATE, "utf8")); } catch {}
    if (!Array.isArray(state.recent)) state.recent = [];
    state.recent = state.recent.filter((m) => !(m.providerID === parts.providerID && m.modelID === parts.modelID));
    state.recent.unshift(parts);
    mkdirSync(join(HOME, ".local", "state", "opencode"), { recursive: true });
    const tmp = `${MODEL_STATE}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(state), "utf8");
    renameSync(tmp, MODEL_STATE);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ---- mode marker (in-app switch handshake with the `maliv` launcher) ------

export function writeNextMode(mode, session) {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(MODE_MARKER, `${mode}\n`, "utf8");
  // Record the exact session to reopen so the relaunch returns HERE. A new/empty
  // session has no id yet → no marker → the launcher opens a fresh session
  // (never --continue, which would reopen the last saved conversation).
  if (session) writeFileSync(SESSION_MARKER, `${session}\n`, "utf8");
  else { try { rmSync(SESSION_MARKER, { force: true }); } catch {} }
}
export function readNextMode() {
  try { return existsSync(MODE_MARKER) ? readFileSync(MODE_MARKER, "utf8").trim() : null; } catch { return null; }
}
export function readNextSession() {
  try { return existsSync(SESSION_MARKER) ? readFileSync(SESSION_MARKER, "utf8").trim() : null; } catch { return null; }
}
export function clearNextMode() {
  try { rmSync(MODE_MARKER, { force: true }); } catch {}
  try { rmSync(SESSION_MARKER, { force: true }); } catch {}
}
