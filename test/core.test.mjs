// Pure logic tests for maliv-code core. No filesystem / opencode needed.
// Run: npm test   (or: node test/core.test.mjs)
import {
  defaultStore, compileOmoConfig, setModelOverride, clearModelOverride, effectiveModel,
  MAIN_AGENTS, SUB_AGENTS, KNOWN_CATEGORIES, isMainAgent,
} from "../src/core.js";

let pass = 0, fail = 0;
const eq = (a, e, m) => { JSON.stringify(a) === JSON.stringify(e) ? pass++ : (fail++, console.error(`FAIL: ${m}\n  exp ${JSON.stringify(e)}\n  got ${JSON.stringify(a)}`)); };
const ok = (c, m) => { c ? pass++ : (fail++, console.error(`FAIL: ${m}`)); };

const baseline = {
  agents: Object.fromEntries([...MAIN_AGENTS, ...SUB_AGENTS].map((a) => [a.key, { model: "opencode/big-pickle" }])),
  categories: Object.fromEntries(KNOWN_CATEGORIES.map((c) => [c, { model: "opencode/big-pickle" }])),
};

// registry sanity
ok(MAIN_AGENTS.length === 4, "4 main agents");
ok(SUB_AGENTS.length === 7, "7 sub agents");
ok(KNOWN_CATEGORIES.length === 8, "8 categories");
ok(isMainAgent("atlas") && !isMainAgent("oracle"), "atlas is main, oracle is sub");

// no overrides -> baseline
eq(compileOmoConfig(defaultStore(), baseline), baseline, "no overrides restores baseline");

// all=X -> every category + every agent explicitly X
{
  const s = defaultStore(); setModelOverride(s, "all", null, "ollama/gemma4:e4b");
  const out = compileOmoConfig(s, baseline);
  ok(Object.values(out.categories).every((c) => c.model === "ollama/gemma4:e4b"), "all -> all categories");
  ok(Object.keys(baseline.agents).every((a) => out.agents[a]?.model === "ollama/gemma4:e4b"), "all -> every agent explicit");
}

// all + category -> category wins, agents dropped for cascade
{
  const s = defaultStore();
  setModelOverride(s, "all", null, "A/a");
  setModelOverride(s, "category", "deep", "D/d");
  const out = compileOmoConfig(s, baseline);
  eq(out.categories.deep.model, "D/d", "category over all");
  eq(out.categories.quick.model, "A/a", "non-overridden category keeps all");
  ok(Object.keys(baseline.agents).every((a) => !out.agents[a] || !("model" in out.agents[a])), "agents dropped for cascade");
}

// agent leaf wins
{
  const s = defaultStore();
  setModelOverride(s, "all", null, "A/a");
  setModelOverride(s, "agent", "oracle", "opencode/big-pickle");
  eq(compileOmoConfig(s, baseline).agents.oracle.model, "opencode/big-pickle", "agent leaf wins");
}

// clear restores baseline
{
  const s = defaultStore();
  setModelOverride(s, "all", null, "x/y");
  setModelOverride(s, "agent", "oracle", "p/q");
  clearModelOverride(s, "all"); clearModelOverride(s, "agent", "oracle");
  eq(compileOmoConfig(s, baseline), baseline, "clear restores baseline");
}

// precedence via effectiveModel
{
  const s = defaultStore();
  eq(effectiveModel(s, baseline, "agent", "oracle"), "opencode/big-pickle", "effective baseline");
  setModelOverride(s, "all", null, "A/a");
  eq(effectiveModel(s, baseline, "category", "deep"), "A/a", "all reaches category");
  setModelOverride(s, "category", "deep", "C/c");
  eq(effectiveModel(s, baseline, "category", "deep"), "C/c", "category over all");
  setModelOverride(s, "agent", "metis", "M/m");
  eq(effectiveModel(s, baseline, "agent", "metis"), "M/m", "agent leaf effective");
}

console.log(`\nmaliv-code core: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
