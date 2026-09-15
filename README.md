# maliv-code

A thin **control layer for [opencode](https://github.com/sst/opencode)** that makes
two things effortless:

1. **Mode switching** — flip between **complex** (full [oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent) — for hard tasks) and **simple** (vanilla opencode — for everyday use) with one command or an in-app menu, **resuming the same session**.
2. **A model tree** — set models across oh-my-opencode's many agents/categories from a single menu instead of hand-editing JSON.

> maliv-code does **not** bundle opencode or oh-my-opencode. It installs / points to
> them from their official sources under their own licenses. All credit for those
> projects belongs to their authors (see [Credits](#credits)).

<img width="1536" height="1024" alt="maliv-code" src="https://github.com/user-attachments/assets/5cc36d79-37d0-4085-b1ed-22084e2e46ac" />

## Install

```sh
npm i -g maliv-code
maliv setup            # full stack (below).  add --minimal to skip the extras
```

`maliv setup` sets up, from each tool's **official source** (nothing but the two
skills is bundled):

| # | Component | How | Type |
|---|-----------|-----|------|
| 1 | **opencode** | `npm i -g opencode-ai` (if missing) | required |
| 2 | **oh-my-opencode** | pinned `oh-my-openagent@4.19.1` wired into config | required |
| 3 | **maliv** plugin | wired into `tui.json` | required |
| 4 | **playwright MCP** | added to the opencode `mcp` config | extra |
| 5 | **openspec** | `npm i -g @fission-ai/openspec` (MIT) | extra |
| 6 | **graphify** | `graphifyy` from PyPI via `uv`/`pip` (MIT) | extra |
| 7 | **skills** | `karpathy-guidelines` (MIT) + `graphify` → `~/.config/opencode/skills/` | extra |

Extras load/run in **complex mode**. `maliv setup --minimal` installs only 1–3.
Bundled skills and their licenses are listed in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
> Note: the bundled `graphify` skill was authored for Claude Code's subagent runtime;
> it drives the `graphify` (graphifyy) CLI and may need tuning under opencode.

## Use

```sh
maliv                 # complex mode, NEW session
maliv simple          # vanilla opencode (oh-my-opencode off; the maliv switcher stays)
maliv complex         # full mode
maliv -c              # continue the last session
maliv -s <id>         # continue a specific session
maliv status          # show current mode
```

Inside opencode:

- `/maliv` — menu (set model · switch mode · reset)
- `/model` — the model tree (below)
- `/maliv-mode` — switch simple ⇄ complex (relaunches, same session)

The home screen shows a **MALIV** wordmark, and the launcher prints a clean
`▸ maliv` line on start and on exit (with the exact `maliv -c` / `maliv -s <id>`
resume commands).

## The model tree (`/model`)

```
Quick
  Main agent — this screen          → opencode's on-screen model (model.json)
  ALL — on-screen + subagents+tiers
Main agents (primary)               → also set the on-screen model
  ★ All main agents (set together)
  sisyphus · prometheus · atlas · hephaestus (GPT-only)
Subagents                           → oh-my-openagent.json (own model each)
  ★ All sub agents (set together)
  oracle · explore · librarian · multimodal-looker · metis · momus · sisyphus-junior
Categories (tiers)                  → oh-my-openagent.json
  ultrabrain · deep · quick · visual-engineering · artistry · writing · unspecified-low · unspecified-high
```

Precedence: **agent > category > all > default**. Each group has a **★ set-together**
row. Changes to subagents/tiers live in `oh-my-openagent.json` and apply on the next
launch (maliv reopens your session automatically after a change).

## How it works

- **Mode switch** toggles `oh-my-openagent` in your opencode config (keeping the maliv
  plugin loaded in both modes) and relaunches opencode. A mode change can't be live —
  oh-my-opencode initializes at startup — so maliv relaunches you into the **same session**.
- **On-screen model** = opencode's picker state (`~/.local/state/opencode/model.json`).
  **Subagent/category models** = `oh-my-openagent.json`. maliv writes the right layer for
  each level of the tree.
- Your original `oh-my-openagent.json` is snapshotted to `~/.maliv/baseline.json`
  (with a byte-copy backup) so **Reset** restores it exactly.

## Compatibility

Tested against: **opencode 1.18.x**, **oh-my-openagent 4.19.x** (pinned in the installer).
opencode auto-updates its own binary; if a release changes internals, open an issue.

## Uninstall

```sh
maliv simple           # (optional) drop back to vanilla first
npm rm -g maliv-code
rm -rf ~/.maliv
```
Then remove the `maliv` / `oh-my-openagent` lines from `~/.config/opencode/tui.json`
and `opencode.jsonc` if you want them gone.

## Credits

Built entirely on the work of others — maliv-code only orchestrates them:

- **[opencode](https://github.com/sst/opencode)** — the AI coding agent this runs on.
- **[oh-my-opencode / oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)** by **code-yeongyu** — the agent harness that "complex" mode enables (Sustainable Use License 1.0).

## License

maliv-code is [MIT](./LICENSE). opencode and oh-my-opencode remain under their own licenses.
