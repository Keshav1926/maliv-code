// maliv-code — home-screen wordmark in opencode's TUI.
//
// Renders a big <ascii_font> "MALIV" (block font, clean outline) into the
// `home_logo` slot. A @opentui/core renderable is a valid slot node, so there's
// no JSX build step. We probe-construct once at register time (inside try/catch,
// OUTSIDE opencode's render loop) so any failure aborts gracefully instead of
// crashing the home screen — the slot is only registered if the probe succeeds.

const TEXT = "maliv";     // ascii_font uppercases it
const FONT = "block";     // tiny | slick | block | huge | shade | grid | pallet
const COLOR = "#7c3aed";  // violet

export async function registerLogo(api) {
  try {
    if (!api || !api.slots || typeof api.slots.register !== "function") return;
    const rnd = api.renderer;
    let rctx = null;
    try { rctx = (rnd && rnd.renderContext) || (rnd && rnd.root && rnd.root.ctx) || null; } catch {}
    if (!rctx) return;

    let AsciiFont;
    try { AsciiFont = (await import("@opentui/core")).ASCIIFontRenderable; } catch { return; }
    if (typeof AsciiFont !== "function") return;

    const make = () => new AsciiFont(rctx, { text: TEXT, font: FONT, color: COLOR });

    // Prove construction works before registering (a throw here is caught → no crash).
    try {
      const probe = make();
      if (probe && typeof probe.destroyRecursively === "function") probe.destroyRecursively();
    } catch { return; }

    api.slots.register({ slots: { home_logo: () => make() } });
  } catch {
    // never break the home screen
  }
}
