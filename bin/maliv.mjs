#!/usr/bin/env node
// maliv-code launcher — cross-shell CLI (replaces the old zsh function).
//   maliv                complex mode, NEW session
//   maliv simple         vanilla opencode (oh-my-opencode off, switcher kept)
//   maliv complex        full mode
//   maliv -c             continue the last session
//   maliv -s <id>        continue a specific session
//   maliv new            fresh session (default)
//   maliv setup          install opencode (if missing) + wire oh-my-opencode + maliv
//   maliv status         show current mode + any queued in-app switch
//
// Default is a fresh session. In-app /maliv-mode queues a switch + quits; this
// loop relaunches in the queued mode with --continue (same session).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setMode, currentMode } from "../src/config.js";
import { readNextMode, readNextSession, clearNextMode } from "../src/core.js";
import { runSetup } from "../src/setup.js";

const C = {
  reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m",
  violet: "\x1b[38;2;124;58;237m", // #7c3aed
  white: "\x1b[97m",
};
let VERSION = "0.1.0";
try { VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version || VERSION; } catch {}

// One clean line before launch — the big MALIV wordmark lives INSIDE the TUI
// (a multi-line terminal banner just gets wiped by opencode's full-screen redraw).
function banner(mode, resuming) {
  const { reset: R, violet, white } = C;
  process.stdout.write(`${violet}▸ maliv${R}${white} · ${mode} mode${resuming ? " · resuming session" : ""}${R}\n`);
}

function help() {
  process.stdout.write(
    `maliv-code v${VERSION}\n\n` +
    `usage: maliv [simple|complex] [-c | -s <id>] [project]\n` +
    `       maliv setup     install opencode + oh-my-opencode + maliv\n` +
    `       maliv status    show current mode\n\n` +
    `default: complex mode, new session. -c continue last, -s <id> continue specific.\n`,
  );
}

function runOpencode(args) {
  return spawnSync("opencode", args, { stdio: "inherit", shell: process.platform === "win32" }).status ?? 0;
}

// Newest session id (the one just used) — `opencode session list` is newest-first.
function lastSessionId() {
  try {
    const r = spawnSync("opencode", ["session", "list"], { encoding: "utf8", shell: process.platform === "win32", timeout: 2500 });
    const m = (r.stdout || "").match(/ses_[A-Za-z0-9]+/);
    return m ? m[0] : null;
  } catch { return null; }
}

async function main() {
  const argv = process.argv.slice(2);

  // subcommands
  if (argv[0] === "setup") { process.exit(await runSetup({ yes: argv.includes("--yes") || argv.includes("-y"), minimal: argv.includes("--minimal") })); }
  if (argv[0] === "status") {
    const q = readNextMode();
    process.stdout.write(`maliv: ${currentMode()} mode${q ? ` · queued → ${q}` : ""}\n`);
    process.exit(0);
  }
  if (argv.includes("-h") || argv.includes("--help")) { help(); process.exit(0); }

  // parse launch args — fresh session by default
  let mode = "complex";
  let contArgs = [];
  const passthru = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "simple" || a === "--simple") mode = "simple";
    else if (a === "complex" || a === "full" || a === "--complex") mode = "complex";
    else if (a === "-c" || a === "--continue" || a === "continue") contArgs = ["--continue"];
    else if (a === "-s" || a === "--session") { const id = argv[++i]; contArgs = id ? ["--session", id] : ["--continue"]; }
    else if (a === "new" || a === "-n" || a === "--new") contArgs = [];
    else passthru.push(a);
  }

  clearNextMode();
  // relaunch loop: honor an in-app queued mode switch, preserving the session
  for (;;) {
    setMode(mode);
    banner(mode, contArgs.length > 0);
    runOpencode([...contArgs, ...passthru]);
    const next = readNextMode();
    if (next) {
      const sess = readNextSession();
      clearNextMode();
      mode = next;
      contArgs = sess ? ["--session", sess] : []; // recorded session, else fresh (never --continue)
      passthru.length = 0;
      continue;
    }
    break;
  }

  // maliv-branded exit hint — the RIGHT resume commands (opencode prints its own
  // "opencode -s ..." above; these are the maliv equivalents that actually work).
  const { white, reset, violet } = C;
  const id = lastSessionId();
  const sCmd = id ? `maliv -s ${id}` : "maliv -s <id>";
  process.stdout.write(
    `\n${violet}▸ maliv${reset}${white} · resume: maliv -c  ·  ${sCmd}  ·  new: maliv${reset}\n`,
  );
}

main().catch((e) => { process.stderr.write(`maliv error: ${String(e?.message || e)}\n`); process.exit(1); });
