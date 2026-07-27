// maliv-code — opencode TUI plugin. Loaded in complex mode (oh-my-opencode on).
// Plain ESM, no JSX: host UI components are plain functions from api.ui.*, so
// dialogs are nested calls. Everything is wrapped so it can never throw at init.
//
// Commands:
//   /maliv        umbrella menu (set model / switch mode / reset)
//   /model        nested model tree: level (main / all / group / agent / category) -> model
//   /maliv-mode   switch complex <-> simple: queues a marker + quits (app.exit);
//                 the `maliv` launcher relaunches in the queued mode, same session.

import {
  loadStore, saveStore, applyStore, loadBaseline, ensureBaseline,
  setModelOverride, clearModelOverride, effectiveModel, writeNextMode,
  setMainModel, currentMainModel, isMainAgent,
  KNOWN_CATEGORIES, MAIN_AGENTS, SUB_AGENTS,
} from "./core.js";
import { registerLogo } from "./logo.js";

function listModels(api) {
  const out = [];
  const providers = (api && api.state && api.state.provider) || [];
  for (const p of providers) {
    const pid = p?.id || p?.providerID || p?.name;
    if (!pid) continue;
    const models = p.models;
    const entries = Array.isArray(models) ? models.map((m) => [m?.id || m?.modelID, m]) : Object.entries(models || {});
    for (const [mid, m] of entries) {
      if (!mid) continue;
      out.push({ id: `${pid}/${mid}`, providerID: pid, label: `${pid}/${mid}`, name: (m && (m.name || m.id)) || mid });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

function toast(api, message, variant = "info") {
  try { api.ui.toast({ message, variant }); } catch {}
}

// Queue a mode switch and quit; the launcher relaunches (same session, --continue).
async function switchMode(api, mode) {
  // Only target a REAL session (one with messages). A brand-new/empty session has
  // no persisted id yet, so we leave it null and the launcher opens a fresh session.
  let sessionID = null;
  try {
    const cur = api?.route?.current;
    if (cur && cur.name === "session" && cur.params && cur.params.sessionID) {
      const id = cur.params.sessionID;
      const msgs = api?.state?.session?.messages?.(id);
      if (msgs && msgs.length > 0) sessionID = id;
    }
  } catch {}
  try { writeNextMode(mode, sessionID); }
  catch (e) { toast(api, `could not queue switch: ${String(e?.message || e)}`, "error"); return; }
  toast(api, `Switching to ${mode.toUpperCase()} — reopening this session…`, "info");
  let exited = false;
  for (const cmd of ["app.exit", "app.quit", "quit", "exit"]) {
    try { await api.keymap.dispatchCommand(cmd); exited = true; break; } catch {}
  }
  if (!exited) toast(api, `Quit opencode — it relaunches in ${mode} mode (maliv launcher).`, "warning");
}

// ---- model tree ----------------------------------------------------------

function openModelPicker(api, level, target) {
  const models = listModels(api);
  const current = level === "main" ? currentMainModel()
    : (level === "agent" || level === "category") ? effectiveModel(loadStore(), loadBaseline(), level, target)
    : null;
  const label = level === "main" ? "MAIN agent (this screen)"
    : level === "all" ? "ALL (on-screen + subagents)"
    : level === "main-group" ? "ALL main agents"
    : level === "sub-group" ? "ALL sub agents"
    : `${level}: ${target}`;

  const options = [
    { title: "↺ Clear override (use default)", value: { clear: true }, category: "Actions" },
    ...models.map((m) => ({
      title: m.id + (m.id === current ? "  ·current" : ""),
      value: { id: m.id }, description: m.name, category: m.providerID,
    })),
  ];

  api.ui.dialog.replace(() =>
    api.ui.DialogSelect({
      title: `maliv · set model for ${label}`,
      placeholder: "filter models…",
      options, current,
      onSelect: async (opt) => {
        const clear = !!opt.value.clear;
        const id = opt.value.id;

        if (level === "main") {
          if (clear) { toast(api, "main agent: pick a model (nothing to clear)", "warning"); return; }
          const r = setMainModel(id);
          api.ui.dialog.clear();
          if (!r.ok) { toast(api, `main set failed: ${r.error}`, "error"); return; }
          toast(api, `${label} → ${id} · applying (reopening session)…`, "info");
          await switchMode(api, "complex");
          return;
        }

        const s = loadStore();
        const setKeys = (keys) => keys.forEach((k) => clear ? clearModelOverride(s, "agent", k) : setModelOverride(s, "agent", k, id));
        let touchesMainScreen = false;

        if (level === "main-group") { setKeys(MAIN_AGENTS.map((a) => a.key)); touchesMainScreen = true; }
        else if (level === "sub-group") { setKeys(SUB_AGENTS.map((a) => a.key)); }
        else if (level === "all") { clear ? clearModelOverride(s, "all") : setModelOverride(s, "all", null, id); touchesMainScreen = true; }
        else {
          clear ? clearModelOverride(s, level, target) : setModelOverride(s, level, target, id);
          if (level === "agent" && isMainAgent(target)) touchesMainScreen = true;
        }

        saveStore(s);
        const r = applyStore(s);
        if (!clear && touchesMainScreen) setMainModel(id);
        api.ui.dialog.clear();
        if (!r.ok) { toast(api, `apply failed: ${r.error}`, "error"); return; }
        toast(api, `${label} → ${clear ? "default" : id} · applying (reopening session)…`, "info");
        await switchMode(api, "complex");
      },
    }),
  );
}

function openLevelPicker(api) {
  ensureBaseline();
  const store = loadStore();
  const baseline = loadBaseline();
  const fmt = (lvl, tgt) => {
    const m = lvl === "main" ? currentMainModel() : effectiveModel(store, baseline, lvl, tgt);
    return m ? `→ ${m}` : "→ (default)";
  };
  const groupModel = (keys) => {
    const uniq = [...new Set(keys.map((k) => effectiveModel(store, baseline, "agent", k)))];
    return uniq.length === 1 ? (uniq[0] ? `→ all: ${uniq[0]}` : "→ (default)") : "→ (mixed)";
  };
  const options = [
    { title: "Main agent — this screen", description: fmt("main"), value: { level: "main" }, category: "Quick" },
    { title: "ALL — on-screen + every subagent + tier", description: fmt("all"), value: { level: "all" }, category: "Quick" },

    { title: "★ All main agents (set together)", description: groupModel(MAIN_AGENTS.map((a) => a.key)), value: { level: "main-group" }, category: "Main agents (primary)" },
    ...MAIN_AGENTS.map((a) => ({ title: a.label, description: fmt("agent", a.key), value: { level: "agent", target: a.key }, category: "Main agents (primary)" })),

    { title: "★ All sub agents (set together)", description: groupModel(SUB_AGENTS.map((a) => a.key)), value: { level: "sub-group" }, category: "Subagents" },
    ...SUB_AGENTS.map((a) => ({ title: a.label, description: fmt("agent", a.key), value: { level: "agent", target: a.key }, category: "Subagents" })),

    ...KNOWN_CATEGORIES.map((c) => ({ title: c, description: fmt("category", c), value: { level: "category", target: c }, category: "Categories (tiers)" })),
  ];
  api.ui.dialog.replace(() =>
    api.ui.DialogSelect({
      title: "maliv · set model — pick a level (most-specific wins)",
      placeholder: "filter…", options,
      onSelect: (opt) => openModelPicker(api, opt.value.level, opt.value.target),
    }),
  );
}

function openModeMenu(api) {
  api.ui.dialog.replace(() =>
    api.ui.DialogSelect({
      title: "maliv · mode (you are in COMPLEX mode)",
      options: [
        { title: "→ Simple mode (vanilla opencode, fast)", value: "simple", description: "quits & relaunches vanilla, same session" },
        { title: "→ Complex mode (relaunch to apply model changes)", value: "complex", description: "quits & relaunches full, same session" },
      ],
      onSelect: (opt) => { api.ui.dialog.clear(); switchMode(api, opt.value); },
    }),
  );
}

function openUmbrella(api) {
  api.ui.dialog.replace(() =>
    api.ui.DialogSelect({
      title: "maliv-code",
      options: [
        { title: "Set model (main / all / groups / agent / tier)", value: "model" },
        { title: "Switch mode (simple / complex)", value: "mode" },
        { title: "Reset all model overrides", value: "reset" },
      ],
      onSelect: (opt) => {
        if (opt.value === "model") openLevelPicker(api);
        else if (opt.value === "mode") openModeMenu(api);
        else if (opt.value === "reset") {
          const s = loadStore();
          s.modelOverrides = { all: null, categories: {}, agents: {} };
          saveStore(s);
          const r = applyStore(s);
          api.ui.dialog.clear();
          toast(api, r.ok ? "overrides cleared (baseline restored) · relaunch to apply" : `reset failed: ${r.error}`, r.ok ? "success" : "error");
        }
      },
    }),
  );
}

const MalivTui = async (api) => {
  try {
    const reg = api && api.command && api.command.register;
    if (typeof reg !== "function") {
      try { api.ui.toast({ message: "maliv-code: command API unavailable", variant: "warning" }); } catch {}
      return;
    }
    reg(() => [
      { title: "maliv-code", value: "maliv.menu", description: "model tree + mode switch", category: "maliv-code", slash: { name: "maliv", aliases: ["maliv-code"] }, onSelect: () => openUmbrella(api) },
      { title: "maliv · set model", value: "maliv.model", description: "set model by level (main / all / groups / agent / tier)", category: "maliv-code", slash: { name: "model", aliases: ["malivmodel"] }, onSelect: () => openLevelPicker(api) },
      { title: "maliv · switch mode", value: "maliv.mode", description: "complex <-> simple (relaunch, same session)", category: "maliv-code", slash: { name: "maliv-mode", aliases: ["malivmode"] }, onSelect: () => openModeMenu(api) },
    ]);
    registerLogo(api); // v2 — MALIV wordmark in home_logo (self-guarded, test-constructed)
  } catch (e) {
    try { api.ui.toast({ message: `maliv-code init failed: ${String(e?.message || e)}`, variant: "error" }); } catch {}
  }
};

export default { id: "maliv-code", tui: MalivTui };
export const MalivPlugin = MalivTui;
